"use client";

import { useEffect, useState } from "react";

type ProbeSummary = {
  name: string;
  status: string;
  last_probed?: string | null;
};

type StorySummary = {
  name: string;
  status: string;
  last_probed?: string | null;
};

type StatusMessage = {
  config?: string;
  probe?: string;
  story?: string;
  restart?: string;
};

export default function DashboardPage() {
  const [probes, setProbes] = useState<ProbeSummary[]>([]);
  const [stories, setStories] = useState<StorySummary[]>([]);
  const [selectedProbe, setSelectedProbe] = useState("");
  const [selectedStory, setSelectedStory] = useState("");
  const [probeResults, setProbeResults] = useState("Select a probe to view the latest results.");
  const [storyResults, setStoryResults] = useState("Select a story to inspect recent executions.");
  const [configContent, setConfigContent] = useState("");
  const [statusMessage, setStatusMessage] = useState<StatusMessage>({});

  useEffect(() => {
    refreshOverview();
    loadConfig();
    const interval = setInterval(refreshOverview, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (probes.length && !probes.some((probe) => probe.name === selectedProbe)) {
      setSelectedProbe(probes[0].name);
    }
  }, [probes, selectedProbe]);

  useEffect(() => {
    if (stories.length && !stories.some((story) => story.name === selectedStory)) {
      setSelectedStory(stories[0].name);
    }
  }, [stories, selectedStory]);

  useEffect(() => {
    if (selectedProbe) {
      loadProbeResults(selectedProbe);
    }
  }, [selectedProbe]);

  useEffect(() => {
    if (selectedStory) {
      loadStoryResults(selectedStory);
    }
  }, [selectedStory]);

  async function refreshOverview() {
    await Promise.all([loadProbes(), loadStories()]);
  }

  async function fetchJson<T>(url: string): Promise<T> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(await response.text());
    }
    return response.json();
  }

  function formatTimestamp(value?: string | null) {
    return value ? new Date(value).toLocaleString() : "Never";
  }

  async function loadProbes() {
    try {
      const data = await fetchJson<ProbeSummary[]>("/probes");
      setProbes(data);
    } catch (error) {
      setProbeResults(`Unable to load probes: ${error}`);
      setProbes([]);
    }
  }

  async function loadStories() {
    try {
      const data = await fetchJson<StorySummary[]>("/stories");
      setStories(data);
    } catch (error) {
      setStoryResults(`Unable to load stories: ${error}`);
      setStories([]);
    }
  }

  async function loadProbeResults(name: string) {
    try {
      const response = await fetch(`/probes/${encodeURIComponent(name)}/results?show_response=true`);
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const payload = await response.json();
      setProbeResults(JSON.stringify(payload, null, 2));
    } catch (error) {
      setProbeResults(`Error fetching probe results: ${error}`);
    }
  }

  async function loadStoryResults(name: string) {
    try {
      const response = await fetch(`/stories/${encodeURIComponent(name)}/results?show_response=true`);
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const payload = await response.json();
      setStoryResults(JSON.stringify(payload, null, 2));
    } catch (error) {
      setStoryResults(`Error fetching story results: ${error}`);
    }
  }

  async function triggerProbe(name: string) {
    if (!name) return;
    setStatusMessage((prev) => ({ ...prev, probe: "Triggering probe…" }));
    try {
      const payload = await fetchJson<{ timestamp_started?: string }>(`/probes/${encodeURIComponent(name)}/trigger`);
      setStatusMessage((prev) => ({
        ...prev,
        probe: payload.timestamp_started
          ? `Probe triggered at ${new Date(payload.timestamp_started).toLocaleTimeString()}.`
          : "Probe triggered."
      }));
      await refreshOverview();
      await loadProbeResults(name);
    } catch (error) {
      setStatusMessage((prev) => ({ ...prev, probe: `Trigger failed: ${error}` }));
    }
  }

  async function triggerStory(name: string) {
    if (!name) return;
    setStatusMessage((prev) => ({ ...prev, story: "Triggering story…" }));
    try {
      const payload = await fetchJson<{ timestamp_started?: string }>(`/stories/${encodeURIComponent(name)}/trigger`);
      setStatusMessage((prev) => ({
        ...prev,
        story: payload.timestamp_started
          ? `Story triggered at ${new Date(payload.timestamp_started).toLocaleTimeString()}.`
          : "Story triggered."
      }));
      await refreshOverview();
      await loadStoryResults(name);
    } catch (error) {
      setStatusMessage((prev) => ({ ...prev, story: `Trigger failed: ${error}` }));
    }
  }

  async function loadConfig() {
    try {
      const response = await fetch("/api/config");
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const text = await response.text();
      setConfigContent(text);
      setStatusMessage((prev) => ({ ...prev, config: "Config loaded." }));
    } catch (error) {
      setStatusMessage((prev) => ({ ...prev, config: `Unable to load config: ${error}` }));
    }
  }

  async function saveConfig() {
    setStatusMessage((prev) => ({ ...prev, config: "Saving config…" }));
    try {
      const response = await fetch("/api/config", {
        method: "PUT",
        headers: {
          "Content-Type": "text/yaml"
        },
        body: configContent
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      setStatusMessage((prev) => ({ ...prev, config: "Config saved. Restart required to apply changes." }));
    } catch (error) {
      setStatusMessage((prev) => ({ ...prev, config: `Save failed: ${error}` }));
    }
  }

  async function restartServer() {
    setStatusMessage((prev) => ({ ...prev, restart: "Sending restart request…" }));
    try {
      const response = await fetch("/api/restart", {
        method: "POST"
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      setStatusMessage((prev) => ({ ...prev, restart: "Restart requested." }));
    } catch (error) {
      setStatusMessage((prev) => ({ ...prev, restart: `Restart failed: ${error}` }));
    }
  }

  return (
    <>
      <header>
        <p>Lightweight control center for the monitoring runtime.</p>
        <h1>XBP Monitoring</h1>
      </header>
      <main className="page-container">
        <section className="panel">
          <h2>Overview</h2>
          <div className="grid">
            <div>
              <h3>Probes</h3>
              <div className="overview-grid">
                {probes.length === 0 && <p>Loading probes…</p>}
                {probes.map((probe) => (
                  <div className={`overview-card ${probe.status.toLowerCase()}`} key={probe.name}>
                    <div>
                      <div className="card-title">{probe.name}</div>
                      <div className="card-subtitle">Last probed {formatTimestamp(probe.last_probed)}</div>
                    </div>
                    <span className="status-badge">{probe.status}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3>Stories</h3>
              <div className="overview-grid">
                {stories.length === 0 && <p>Loading stories…</p>}
                {stories.map((story) => (
                  <div className={`overview-card ${story.status.toLowerCase()}`} key={story.name}>
                    <div>
                      <div className="card-title">{story.name}</div>
                      <div className="card-subtitle">Last probed {formatTimestamp(story.last_probed)}</div>
                    </div>
                    <span className="status-badge">{story.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="panel" aria-live="polite">
          <h2>Probe details</h2>
          <div className="controls">
            <label>
              <span>Probe</span>
              <select value={selectedProbe} onChange={(event) => setSelectedProbe(event.target.value)}>
                <option value="">Select a probe</option>
                {probes.map((probe) => (
                  <option key={probe.name} value={probe.name}>
                    {probe.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="controls">
              <button type="button" onClick={() => triggerProbe(selectedProbe)} disabled={!selectedProbe}>
                Trigger probe
              </button>
              <span className="status-message">{statusMessage.probe}</span>
            </div>
          </div>
          <pre>{probeResults}</pre>
        </section>

        <section className="panel" aria-live="polite">
          <h2>Story details</h2>
          <div className="controls">
            <label>
              <span>Story</span>
              <select value={selectedStory} onChange={(event) => setSelectedStory(event.target.value)}>
                <option value="">Select a story</option>
                {stories.map((story) => (
                  <option key={story.name} value={story.name}>
                    {story.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="controls">
              <button type="button" onClick={() => triggerStory(selectedStory)} disabled={!selectedStory}>
                Trigger story
              </button>
              <span className="status-message">{statusMessage.story}</span>
            </div>
          </div>
          <pre>{storyResults}</pre>
        </section>

        <section className="panel">
          <h2>Configuration editor</h2>
          <div className="controls">
            <button type="button" onClick={saveConfig}>
              Save config
            </button>
            <span className="status-message">{statusMessage.config}</span>
          </div>
          <textarea
            value={configContent}
            onChange={(event) => setConfigContent(event.target.value)}
            spellCheck={false}
            placeholder="Load config via the button above and edit..."
          />
        </section>

        <section className="panel restart-panel">
          <h2>Restart monitoring</h2>
          <p>Requires <code>XBP_RESTART_CMD</code> to be defined in the environment.</p>
          <button type="button" className="secondary" onClick={restartServer}>
            Restart server
          </button>
          <span className="status-message">{statusMessage.restart}</span>
        </section>
      </main>
      <footer>
        <p>Changes take effect after the process restarts.</p>
      </footer>
    </>
  );
}
