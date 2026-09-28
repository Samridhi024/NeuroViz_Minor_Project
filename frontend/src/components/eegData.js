// File: src/components/eegData.js

export const CHANNEL_COLORS = {
  T7: "#3b82f6",
  F8: "#10b981",
  F3: "#06b6d4",
  F4: "#8b5cf6",
  Cz: "#ef4444",
  P4: "#f59e0b",
};

const DYNAMIC_CHANNEL_PALETTE = [
  "#2563eb", "#059669", "#7c3aed", "#ea580c",
  "#0891b2", "#db2777", "#65a30d", "#4f46e5",
  "#dc2626", "#0d9488", "#9333ea", "#ca8a04",
];

// Known headset channels keep the submitted colours. Clinical derivations get
// a stable colour based on their name, so C4-A1 is identical in every view.
export const getChannelColor = (channel = "") => {
  if (CHANNEL_COLORS[channel]) return CHANNEL_COLORS[channel];

  const hash = Array.from(channel).reduce(
    (total, character) => ((total * 31) + character.charCodeAt(0)) >>> 0,
    0
  );
  return DYNAMIC_CHANNEL_PALETTE[hash % DYNAMIC_CHANNEL_PALETTE.length];
};

export const SENSOR_DATA = [
  { name: "T7", position: [-27.0, 24.0, 0.0], color: CHANNEL_COLORS.T7 },
  { name: "F8", position: [21.0, 20.0, 13.0], color: CHANNEL_COLORS.F8 },
  { name: "F3", position: [-21.0, 20.0, 13.0], color: CHANNEL_COLORS.F3 },
  { name: "F4", position: [15.0, 23.0, 16.0], color: CHANNEL_COLORS.F4 },
  { name: "Cz", position: [0.0, 56.5, 0.0], color: CHANNEL_COLORS.Cz },
  { name: "P4", position: [16.0, 44.0, -20.0], color: CHANNEL_COLORS.P4 },
];
