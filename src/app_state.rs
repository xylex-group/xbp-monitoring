use std::sync::RwLockWriteGuard;
use std::{collections::HashMap, path::PathBuf, sync::RwLock};

use crate::{
    config::Config,
    otel::metrics::Metrics,
    probe::model::{ProbeResult, StoryResult},
};

// Limits the number of results we store per probe. Once we go over this amount we remove the earliest.
const PROBE_RESULT_LIMIT: usize = 100;

pub struct AppState {
    pub probe_results: RwLock<HashMap<String, Vec<ProbeResult>>>,
    pub story_results: RwLock<HashMap<String, Vec<StoryResult>>>,
    pub config: Config,
    pub config_path: PathBuf,
    pub metrics: Metrics,
    pub prometheus_registry: Option<std::sync::Arc<prometheus::Registry>>,
}

impl AppState {
    pub fn new(
        config: Config,
        config_path: PathBuf,
        prometheus_registry: Option<std::sync::Arc<prometheus::Registry>>,
    ) -> AppState {
        AppState {
            probe_results: RwLock::new(HashMap::new()),
            story_results: RwLock::new(HashMap::new()),
            config,
            config_path,
            metrics: Metrics::new(),
            prometheus_registry,
        }
    }

    pub fn add_probe_result(&self, probe_name: String, result: ProbeResult) {
        let mut write_lock: RwLockWriteGuard<'_, HashMap<String, Vec<_>>> =
            self.probe_results.write().unwrap();

        let results: &mut Vec<ProbeResult> = write_lock.entry(probe_name).or_default();
        results.push(result);

        // Ensure only the latest 100 elements are kept
        while results.len() > PROBE_RESULT_LIMIT {
            results.remove(0);
        }
    }

    pub fn add_story_result(&self, story_name: String, result: StoryResult) {
        let mut write_lock: RwLockWriteGuard<'_, HashMap<String, Vec<_>>> =
            self.story_results.write().unwrap();

        let results: &mut Vec<StoryResult> = write_lock.entry(story_name).or_default();
        results.push(result);

        // Ensure only the latest 100 elements are kept
        while results.len() > PROBE_RESULT_LIMIT {
            results.remove(0);
        }
    }
}
