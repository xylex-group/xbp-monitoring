use std::path::PathBuf;
use std::sync::RwLockWriteGuard;
use std::{collections::HashMap, sync::Arc, sync::RwLock};

use crate::{
    config::Config,
    config::load_config_from_sources,
    otel::metrics::Metrics,
    probe::{
        model::{ProbeResult, StoryResult},
        schedule::{schedule_probes, schedule_stories},
    },
};

// Limits the number of results we store per probe. Once we go over this amount we remove the earliest.
const PROBE_RESULT_LIMIT: usize = 100;

pub struct AppState {
    pub probe_results: RwLock<HashMap<String, Vec<ProbeResult>>>,
    pub story_results: RwLock<HashMap<String, Vec<StoryResult>>>,
    pub config: RwLock<Config>,
    pub config_path: PathBuf,
    pub monitor_tasks: RwLock<Vec<tokio::task::JoinHandle<()>>>,
    pub metrics: Metrics,
}

impl AppState {
    pub fn new<P: Into<PathBuf>>(config: Config, config_path: P) -> AppState {
        AppState {
            probe_results: RwLock::new(HashMap::new()),
            story_results: RwLock::new(HashMap::new()),
            config: RwLock::new(config),
            config_path: config_path.into(),
            monitor_tasks: RwLock::new(Vec::new()),
            metrics: Metrics::new(),
        }
    }

    pub fn start_monitoring(self: &Arc<Self>) {
        let config = self.config.read().unwrap().clone();
        let mut handles = Vec::new();
        handles.extend(schedule_probes(&config.probes, self.clone()));
        handles.extend(schedule_stories(&config.stories, self.clone()));
        *self.monitor_tasks.write().unwrap() = handles;
    }

    pub fn stop_monitoring(&self) {
        let mut tasks = self.monitor_tasks.write().unwrap();
        for task in tasks.drain(..) {
            task.abort();
        }
    }

    pub async fn reload(self: &Arc<Self>) -> Result<Config, Box<dyn std::error::Error>> {
        let new_config = load_config_from_sources(self.config_path.clone()).await?;

        self.stop_monitoring();

        {
            let mut write_config = self.config.write().unwrap();
            *write_config = new_config.clone();
        }

        self.prune_results(&new_config);
        self.start_monitoring();

        Ok(new_config)
    }

    fn prune_results(&self, new_config: &Config) {
        let allowed_probes: std::collections::HashSet<String> =
            new_config.probes.iter().map(|p| p.name.clone()).collect();
        let allowed_stories: std::collections::HashSet<String> =
            new_config.stories.iter().map(|s| s.name.clone()).collect();

        {
            let mut probes = self.probe_results.write().unwrap();
            probes.retain(|name, _| allowed_probes.contains(name));
        }

        {
            let mut stories = self.story_results.write().unwrap();
            stories.retain(|name, _| allowed_stories.contains(name));
        }
    }

    pub fn add_probe_result(&self, probe_name: String, result: ProbeResult) {
        let mut write_lock: RwLockWriteGuard<'_, HashMap<String, Vec<_>>> =
            self.probe_results.write().unwrap();

        let results = write_lock.entry(probe_name).or_default();
        results.push(result);

        // Ensure only the latest 100 elements are kept
        while results.len() > PROBE_RESULT_LIMIT {
            results.remove(0);
        }
    }

    pub fn add_story_result(&self, story_name: String, result: StoryResult) {
        let mut write_lock: RwLockWriteGuard<'_, HashMap<String, Vec<_>>> =
            self.story_results.write().unwrap();

        let results = write_lock.entry(story_name).or_default();
        results.push(result);

        // Ensure only the latest 100 elements are kept
        while results.len() > PROBE_RESULT_LIMIT {
            results.remove(0);
        }
    }
}
