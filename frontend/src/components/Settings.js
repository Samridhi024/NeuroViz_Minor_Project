import React, { useEffect, useState } from "react";
import {
  Settings as SettingsIcon,
  Type,
  Sparkles,
  Save,
  RotateCcw,
  ShieldCheck,
  Activity,
  Moon,
  Info,
} from "lucide-react";

const DEFAULT_UI_SETTINGS = {
  textSize: "normal",
  reduceMotion: false,
};

const Settings = ({ currentSettings = {}, onSave = () => {} }) => {
  const [config, setConfig] = useState(() => {
    let savedSettings = {};

    if (typeof window !== "undefined") {
      try {
        savedSettings = JSON.parse(
          localStorage.getItem("neuroviz-ui-settings") || "{}"
        );
      } catch {
        savedSettings = {};
      }
    }

    return {
      ...currentSettings,
      ...savedSettings,

      textSize:
        savedSettings.textSize ||
        currentSettings.textSize ||
        DEFAULT_UI_SETTINGS.textSize,

      reduceMotion:
        savedSettings.reduceMotion ??
        currentSettings.reduceMotion ??
        DEFAULT_UI_SETTINGS.reduceMotion,
    };
  });

  const [saved, setSaved] = useState(false);

  const applyInterfacePreferences = (nextConfig) => {
    const root = document.documentElement;

    root.style.fontSize =
      nextConfig.textSize === "large" ? "18px" : "16px";

    root.classList.toggle(
      "neuroviz-reduce-motion",
      Boolean(nextConfig.reduceMotion)
    );
  };

  useEffect(() => {
    applyInterfacePreferences(config);
  }, [config.textSize, config.reduceMotion]);

  const updateSetting = (key, value) => {
    setSaved(false);

    setConfig((previous) => ({
      ...previous,
      [key]: value,
    }));
  };

  const handleSave = () => {
    applyInterfacePreferences(config);

    localStorage.setItem(
      "neuroviz-ui-settings",
      JSON.stringify(config)
    );

    onSave(config);
    setSaved(true);
  };

  const handleReset = () => {
    const resetConfig = {
      ...config,
      ...DEFAULT_UI_SETTINGS,
    };

    setConfig(resetConfig);
    applyInterfacePreferences(resetConfig);

    localStorage.removeItem("neuroviz-ui-settings");

    onSave(resetConfig);
    setSaved(false);
  };

  return (
    <div className="fade-in mt-4">
      {/* Used only for the Reduce Animation preference */}
      <style>
        {`
          .neuroviz-reduce-motion *,
          .neuroviz-reduce-motion *::before,
          .neuroviz-reduce-motion *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
            scroll-behavior: auto !important;
          }
        `}
      </style>

      {/* Page heading */}
      <div className="d-flex align-items-center gap-2 mb-2">
        <SettingsIcon size={28} className="text-primary" />

        <h2 className="fw-bold mb-0">
          Settings
        </h2>
      </div>

      <p className="text-muted mb-4">
        Change simple display preferences. EEG processing and the sleep
        model remain fixed so that analysis stays consistent.
      </p>

      <div className="row g-4">
        {/* Display settings */}
        <div className="col-lg-7">
          <div className="card border-0 shadow-sm rounded-4 p-4 bg-white h-100">
            <h6 className="fw-bold text-muted text-uppercase small mb-4 d-flex align-items-center gap-2">
              <Type size={18} />
              Display preferences
            </h6>

            {/* Text-size preference */}
            <div className="mb-4">
              <label className="form-label fw-bold mb-2">
                Text size
              </label>

              <p className="small text-muted mb-3">
                Increase the text size if dashboard labels are difficult
                to read.
              </p>

              <div className="d-flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    updateSetting("textSize", "normal")
                  }
                  className={`btn rounded-pill px-4 ${
                    config.textSize === "normal"
                      ? "btn-primary"
                      : "btn-outline-secondary"
                  }`}
                >
                  Standard
                </button>

                <button
                  type="button"
                  onClick={() =>
                    updateSetting("textSize", "large")
                  }
                  className={`btn rounded-pill px-4 ${
                    config.textSize === "large"
                      ? "btn-primary"
                      : "btn-outline-secondary"
                  }`}
                >
                  Large
                </button>
              </div>
            </div>

            <hr className="my-4" />

            {/* Animation preference */}
            <div className="d-flex justify-content-between align-items-start gap-4">
              <div>
                <div className="fw-bold d-flex align-items-center gap-2">
                  <Sparkles
                    size={18}
                    className="text-primary"
                  />

                  Reduce animation
                </div>

                <p className="small text-muted mb-0 mt-1">
                  Minimizes interface movement. This does not change EEG
                  data or graph values.
                </p>
              </div>

              <div className="form-check form-switch m-0">
                <input
                  id="reduceMotion"
                  className="form-check-input"
                  type="checkbox"
                  role="switch"
                  checked={Boolean(config.reduceMotion)}
                  onChange={(event) =>
                    updateSetting(
                      "reduceMotion",
                      event.target.checked
                    )
                  }
                />

                <label
                  className="visually-hidden"
                  htmlFor="reduceMotion"
                >
                  Reduce animation
                </label>
              </div>
            </div>

            {/* Action buttons */}
            <div className="d-flex flex-wrap justify-content-end gap-2 mt-5">
              <button
                type="button"
                onClick={handleReset}
                className="btn btn-light border rounded-pill px-4 d-inline-flex align-items-center gap-2"
              >
                <RotateCcw size={17} />
                Reset
              </button>

              <button
                type="button"
                onClick={handleSave}
                className="btn btn-primary rounded-pill px-4 d-inline-flex align-items-center gap-2 fw-bold"
              >
                <Save size={17} />
                Save preferences
              </button>
            </div>

            {saved && (
              <div
                className="alert alert-success py-2 mt-3 mb-0 rounded-3"
                role="status"
              >
                Preferences saved successfully.
              </div>
            )}
          </div>
        </div>

        {/* System information */}
        <div className="col-lg-5">
          <div className="card border-0 shadow-sm rounded-4 p-4 bg-white mb-4">
            <h6 className="fw-bold text-muted text-uppercase small mb-3 d-flex align-items-center gap-2">
              <Activity size={18} />
              Analysis configuration
            </h6>

            <div className="d-flex justify-content-between gap-3 py-2 border-bottom">
              <span className="text-muted">
                General EEG cleaning
              </span>

              <span className="fw-semibold text-end">
                0.5–45 Hz
              </span>
            </div>

            <div className="d-flex justify-content-between gap-3 py-2 border-bottom">
              <span className="text-muted">
                Power-line removal
              </span>

              <span className="fw-semibold text-end">
                50 Hz when valid
              </span>
            </div>

            <div className="d-flex justify-content-between gap-3 py-2 border-bottom">
              <span className="text-muted">
                Sleep EEG channel
              </span>

              <span className="fw-semibold text-end">
                C4-A1
              </span>
            </div>

            <div className="d-flex justify-content-between gap-3 py-2 border-bottom">
              <span className="text-muted">
                Sleep segment length
              </span>

              <span className="fw-semibold text-end">
                30 seconds
              </span>
            </div>

            <div className="d-flex justify-content-between gap-3 pt-2">
              <span className="text-muted">
                Sleep stages evaluated
              </span>

              <span className="fw-semibold text-end">
                N2 and N3
              </span>
            </div>

            <div className="alert alert-light border mt-4 mb-0 small d-flex gap-2">
              <ShieldCheck
                size={18}
                className="text-success flex-shrink-0"
              />

              <span>
                These values are locked because changing them would make
                the uploaded signal inconsistent with the trained
                research model.
              </span>
            </div>
          </div>

          {/* Sleep-model notice */}
          <div className="card border-0 shadow-sm rounded-4 p-4 bg-white">
            <h6 className="fw-bold mb-2 d-flex align-items-center gap-2">
              <Moon size={18} className="text-primary" />
              Sleep model notice
            </h6>

            <p className="small text-muted mb-0 d-flex gap-2">
              <Info
                size={17}
                className="flex-shrink-0 mt-1"
              />

              <span>
                The sleep module identifies CAP A-like EEG patterns for
                research demonstration. It does not diagnose insomnia or
                another medical condition.
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;