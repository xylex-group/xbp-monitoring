use regex::Regex;
use serde::{Deserialize, Serialize};
use std::borrow::Cow;
use std::io::ErrorKind;
use std::path::PathBuf;
use tracing::warn;

use crate::probe::model::{Probe, Story};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    #[serde(default)]
    pub probes: Vec<Probe>,
    #[serde(default)]
    pub stories: Vec<Story>,
}

pub async fn load_config<P: Into<PathBuf>>(path: P) -> Result<Config, Box<dyn std::error::Error>> {
    let path: PathBuf = path.into();
    eprintln!("Loading config from: {:?}", path);
    let config: String = match tokio::fs::read_to_string(path.clone()).await {
        Ok(content) => content,
        Err(ref e) if e.kind() == ErrorKind::NotFound => {
            panic!("Config file not found: {:?}", path)
        }
        Err(e) => {
            panic!("Failed to read config file: {:?}, err {}", path, e)
        }
    };
    let config = replace_env_vars(&config);
    let config: Config = serde_yaml::from_str(&config)?;
    Ok(config)
}

pub fn replace_env_vars(content: &str) -> String {
    let re: Regex = Regex::new(r"\$\{\{\s*env\.(.*?)\s*\}\}").unwrap();
    let replaced: Cow<'_, str> = re.replace_all(content, |caps: &regex::Captures| {
        let var_name: &str = &caps[1];
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
    use crate::config::{load_config, Config};
    use crate::XBP_YAML;
    use std::env;

    #[tokio::test]
    async fn test_app_yaml_can_load() {
        let config_result: Result<Config, Box<dyn std::error::Error>> = load_config(XBP_YAML).await;

        // Assert that the config is successfully loaded
        assert!(config_result.is_ok(), "Failed to load config");

        // Borrow the config for subsequent operations
        let config: &Config = config_result.as_ref().unwrap();

        // Perform multiple tests using borrowed references
        assert_eq!(2, config.probes.len(), "Probes length should be 2");
        assert_eq!(0, config.stories.len(), "Stories length should be 0");

        // Current file path: src/config.rs
    }

    #[tokio::test]
    async fn test_env_substitution() {
        env::set_var("TEST_ENV_VAR", "test_value");
        let content: &str = "Environment variable ${{ env.TEST_ENV_VAR }} should be replaced even with varying whitespace ${{env.TEST_ENV_VAR}}${{ env.TEST_ENV_VAR}}  ${{env.TEST_ENV_VAR }}${{ env.TEST_ENV_VAR     }}, missing ${{ env.MISSING_VAR }} should be empty";
        let replaced: String = super::replace_env_vars(content);
        assert_eq!(
            "Environment variable test_value should be replaced even with varying whitespace test_valuetest_value  test_valuetest_value, missing  should be empty",
            replaced
        );
    }
}
