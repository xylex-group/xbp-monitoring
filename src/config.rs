use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tracing::{info, warn};

use crate::probe::model::Probe;
use crate::probe::model::Story;

const DEFAULT_CONFIG_FILE: &str = "xbp.yaml";
const LEGACY_CONFIG_FILE: &str = "xbp.yml";
const DEFAULT_CONFIG_TEMPLATE: &str = include_str!("../xbp.yaml");
const REMOTE_CONFIG_URL_ENV: &str = "XBP_REMOTE_CONFIG_URL";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    #[serde(default)]
    pub probes: Vec<Probe>,
    #[serde(default)]
    pub stories: Vec<Story>,
}

pub async fn load_config_from_sources<P: Into<PathBuf>>(
    path: P,
) -> Result<Config, Box<dyn std::error::Error>> {
    let remote_url = std::env::var(REMOTE_CONFIG_URL_ENV).ok();
    if let Some(remote_url) = remote_url {
        let remote_url = remote_url.trim().to_owned();
        if !remote_url.is_empty() {
            return load_config_from_remote_url(&remote_url).await;
        }
    }

    load_config(path).await
}

async fn load_config_from_remote_url(url: &str) -> Result<Config, Box<dyn std::error::Error>> {
    let parsed = reqwest::Url::parse(url)?;
    let scheme = parsed.scheme();
    let allowed = scheme == "https"
        || (cfg!(test)
            && scheme == "http"
            && parsed.host_str().is_some_and(|h| h == "127.0.0.1" || h == "localhost"));
    if !allowed {
        return Err(Box::new(std::io::Error::new(
            std::io::ErrorKind::InvalidInput,
            format!(
                "{} must be an https URL, got: {}",
                REMOTE_CONFIG_URL_ENV, url
            ),
        )));
    }

    let response = crate::probe::http_probe::shared_client()
        .get(parsed)
        .send()
        .await?;

    let status = response.status();
    if !status.is_success() {
        return Err(Box::new(std::io::Error::new(
            std::io::ErrorKind::Other,
            format!(
                "Remote config fetch failed ({}): {}",
                status.as_u16(),
                url
            ),
        )));
    }

    let content = response.text().await?;
    let replaced = replace_env_vars(&content);
    let config: Config = serde_json::from_str(&replaced)?;
    Ok(config)
}

pub async fn load_config<P: Into<PathBuf>>(path: P) -> Result<Config, Box<dyn std::error::Error>> {
    let requested_path = path.into();

    if requested_path
        .file_name()
        .is_some_and(|name| name == LEGACY_CONFIG_FILE)
    {
        warn!(
            "Config file {} is deprecated; use {} instead.",
            LEGACY_CONFIG_FILE, DEFAULT_CONFIG_FILE
        );
    }

    let mut candidates = Vec::with_capacity(2);
    candidates.push(requested_path.clone());

    if requested_path
        .file_name()
        .is_some_and(|name| name == LEGACY_CONFIG_FILE)
    {
        candidates.push(requested_path.with_file_name(DEFAULT_CONFIG_FILE));
    }

    for candidate in candidates {
        match tokio::fs::read_to_string(candidate.clone()).await {
            Ok(content) => {
                let replaced = replace_env_vars(&content);
                let config: Config = serde_yaml::from_str(&replaced)?;
                return Ok(config);
            }
            Err(ref e) if e.kind() == std::io::ErrorKind::NotFound => continue,
            Err(e) => return Err(Box::new(e)),
        }
    }

    let is_defaultish = requested_path
        .file_name()
        .is_some_and(|name| name == DEFAULT_CONFIG_FILE || name == LEGACY_CONFIG_FILE);

    if !is_defaultish {
        return Err(Box::new(std::io::Error::new(
            std::io::ErrorKind::NotFound,
            format!(
                "Config file not found: \"{}\" (expected {} or set {}=https://...)",
                requested_path.display(),
                DEFAULT_CONFIG_FILE,
                REMOTE_CONFIG_URL_ENV
            ),
        )));
    }

    let create_in_dir = requested_path
        .parent()
        .map(PathBuf::from)
        .unwrap_or(std::env::current_dir()?);
    let create_path = create_in_dir.join(DEFAULT_CONFIG_FILE);

    if tokio::fs::metadata(&create_path).await.is_err() {
        info!(
            "Config file not found, creating default at {}",
            create_path.display()
        );
        tokio::fs::write(&create_path, DEFAULT_CONFIG_TEMPLATE).await?;
    }

    let replaced = replace_env_vars(DEFAULT_CONFIG_TEMPLATE);
    let config: Config = serde_yaml::from_str(&replaced)?;
    Ok(config)
}

pub fn replace_env_vars(content: &str) -> String {
    let re: regex::Regex = regex::Regex::new(r"\$\{\{\s*env\.(.*?)\s*\}\}").unwrap();
    let replaced = re.replace_all(content, |caps: &regex::Captures| {
        let var_name = &caps[1];
        // panics on missing enivronment variables, probably desirable?
        match std::env::var(var_name) {
            Ok(val) => val,
            Err(_) => {
                warn!(
                    "Environment variable {} not found, defaulting to empty string.",
                    var_name
                );
                "".to_string()
            }
        }
    });
    replaced.to_string()
}

#[cfg(test)]
mod config_tests {
    use std::env;
    use std::sync::{Mutex, OnceLock};

    use crate::config::load_config;

    static ENV_LOCK: OnceLock<Mutex<()>> = OnceLock::new();

    fn env_lock() -> std::sync::MutexGuard<'static, ()> {
        ENV_LOCK.get_or_init(|| Mutex::new(())).lock().unwrap()
    }

    #[tokio::test]
    async fn test_app_yaml_can_load() {
        let _lock = env_lock();
        let config_result = load_config("xbp.yaml").await;

        // Assert that the config is successfully loaded
        assert!(config_result.is_ok(), "Failed to load config");

        // Borrow the config for subsequent operations
        let config = config_result.as_ref().unwrap();

        // Perform multiple tests using borrowed references
        assert_eq!(1, config.probes.len(), "Probes length should be 1");
        assert_eq!(1, config.stories.len(), "Stories length should be 1");
    }

    #[tokio::test]
    async fn test_env_substitution() {
        let _lock = env_lock();
        env::set_var("TEST_ENV_VAR", "test_value");
        let content = "Environment variable ${{ env.TEST_ENV_VAR }} should be replaced even with varying whitespace ${{env.TEST_ENV_VAR}}${{ env.TEST_ENV_VAR}}  ${{env.TEST_ENV_VAR }}${{ env.TEST_ENV_VAR     }}, missing ${{ env.MISSING_VAR }} should be empty";
        let replaced = super::replace_env_vars(content);
        assert_eq!(
            "Environment variable test_value should be replaced even with varying whitespace test_valuetest_value  test_valuetest_value, missing  should be empty",
            replaced
        );
    }

    #[tokio::test]
    async fn test_legacy_xbp_yml_falls_back_to_xbp_yaml_in_same_dir() {
        let _lock = env_lock();
        let dir =
            std::env::temp_dir().join(format!("xbp-monitoring-test-{}", uuid::Uuid::new_v4()));
        tokio::fs::create_dir_all(&dir).await.unwrap();

        let yaml_path = dir.join("xbp.yaml");
        tokio::fs::write(&yaml_path, "probes: []\nstories: []\n")
            .await
            .unwrap();

        let legacy_path = dir.join("xbp.yml");
        let config = load_config(legacy_path).await.unwrap();
        assert_eq!(0, config.probes.len());
        assert_eq!(0, config.stories.len());
    }

    #[tokio::test]
    async fn test_missing_default_creates_xbp_yaml() {
        let _lock = env_lock();
        let dir =
            std::env::temp_dir().join(format!("xbp-monitoring-test-{}", uuid::Uuid::new_v4()));
        tokio::fs::create_dir_all(&dir).await.unwrap();

        let target = dir.join("xbp.yaml");
        let config = load_config(target.clone()).await.unwrap();
        assert!(tokio::fs::metadata(&target).await.is_ok());
        assert_eq!(1, config.probes.len());
        assert_eq!(1, config.stories.len());
    }

    #[tokio::test]
    async fn test_remote_config_rejects_non_https_scheme() {
        let _lock = env_lock();
        let result = super::load_config_from_remote_url("http://example.com/config.json").await;
        assert!(result.is_err());
        let msg = result.err().unwrap().to_string();
        assert!(msg.contains("must be an https URL"));
    }

    #[tokio::test]
    async fn test_remote_config_loads_json_and_substitutes_env_vars() {
        let _lock = env_lock();
        env::set_var("TEST_REMOTE_VALUE", "hello");

        let mock_server = wiremock::MockServer::start().await;
        wiremock::Mock::given(wiremock::matchers::method("GET"))
            .and(wiremock::matchers::path("/config"))
            .respond_with(wiremock::ResponseTemplate::new(200).set_body_string(
                r#"{
  "probes": [
    {
      "name": "${{ env.TEST_REMOTE_VALUE }}",
      "url": "https://example.com/health",
      "http_method": "GET",
      "with": null,
      "expectations": null,
      "schedule": { "initial_delay": 3600, "interval": 3600 },
      "alerts": null,
      "sensitive": false,
      "tags": null
    }
  ],
  "stories": []
}"#,
            ))
            .mount(&mock_server)
            .await;

        let result =
            super::load_config_from_remote_url(&format!("{}/config", mock_server.uri())).await;
        assert!(result.is_ok());
        let config = result.unwrap();
        assert_eq!(1, config.probes.len());
        assert_eq!("hello", config.probes[0].name);
    }
}
