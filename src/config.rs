use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tracing::{info, warn};

use crate::probe::model::Probe;
use crate::probe::model::Story;

const DEFAULT_CONFIG_FILE: &str = "xbp.yaml";
const LEGACY_CONFIG_FILE: &str = "xbp.yml";
const DEFAULT_CONFIG_TEMPLATE: &str = include_str!("../xbp.yaml");

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    #[serde(default)]
    pub probes: Vec<Probe>,
    #[serde(default)]
    pub stories: Vec<Story>,
}

pub async fn load_config<P: Into<PathBuf>>(path: P) -> Result<Config, Box<dyn std::error::Error>> {
    let requested_path = path.into();

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
            format!("Config file not found: {}", requested_path.display()),
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

    use crate::config::load_config;

    #[tokio::test]
    async fn test_app_yaml_can_load() {
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
        let dir =
            std::env::temp_dir().join(format!("xbp-monitoring-test-{}", uuid::Uuid::new_v4()));
        tokio::fs::create_dir_all(&dir).await.unwrap();

        let target = dir.join("xbp.yaml");
        let config = load_config(target.clone()).await.unwrap();
        assert!(tokio::fs::metadata(&target).await.is_ok());
        assert_eq!(1, config.probes.len());
        assert_eq!(1, config.stories.len());
    }
}
