const fs = require("fs");
const path = require("path");

const DATA_DIR = process.env.METRICS_DATA_DIR || path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "metric-snapshots.json");

function ensureStore() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ snapshots: [], attempts: [] }, null, 2));
  }
}

function readStore() {
  ensureStore();
  try {
    const parsed = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    return {
      snapshots: Array.isArray(parsed.snapshots) ? parsed.snapshots : [],
      attempts: Array.isArray(parsed.attempts) ? parsed.attempts : [],
    };
  } catch (error) {
    throw new Error(`Unable to read metric store: ${error.message}`);
  }
}

function writeStore(store) {
  ensureStore();
  const temporaryFile = `${DATA_FILE}.tmp`;
  fs.writeFileSync(temporaryFile, JSON.stringify(store, null, 2));
  fs.renameSync(temporaryFile, DATA_FILE);
}

function normalizeTimestamp(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) throw new Error("Invalid capturedAt timestamp");
  return date.toISOString();
}

function saveSnapshot({ metricKey, value, capturedAt, source = "unknown" }) {
  if (!metricKey) throw new Error("metricKey is required");
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) throw new Error("Metric value must be numeric");

  const store = readStore();
  const timestamp = normalizeTimestamp(capturedAt);
  const day = timestamp.slice(0, 10);
  const existingIndex = store.snapshots.findIndex(
    (item) => item.metricKey === metricKey && item.capturedAt.slice(0, 10) === day
  );

  const snapshot = { metricKey, value: numericValue, capturedAt: timestamp, source };

  if (existingIndex >= 0) {
    const existing = store.snapshots[existingIndex];
    const incomingIsHistorical = String(source).toLowerCase().includes("historical");
    const existingIsHistorical = String(existing.source || "").toLowerCase().includes("historical");

    // Startup history seeding must never replace a live snapshot already
    // collected for the same calendar day.
    if (incomingIsHistorical && !existingIsHistorical) {
      return existing;
    }

    // A live collection should replace a seeded historical value.
    if (!incomingIsHistorical && existingIsHistorical) {
      store.snapshots[existingIndex] = snapshot;
    } else if (new Date(timestamp) >= new Date(existing.capturedAt)) {
      // For snapshots of the same type, keep the newest observation.
      store.snapshots[existingIndex] = snapshot;
    } else {
      return existing;
    }
  } else {
    store.snapshots.push(snapshot);
  }

  store.snapshots.sort((a, b) => new Date(a.capturedAt) - new Date(b.capturedAt));
  writeStore(store);
  return snapshot;
}

function saveAttempt({ metricKey, status, attemptedAt, errorMessage = null }) {
  const store = readStore();
  const attempt = {
    metricKey,
    status,
    attemptedAt: normalizeTimestamp(attemptedAt),
    errorMessage: errorMessage ? String(errorMessage).slice(0, 1000) : null,
  };
  store.attempts.push(attempt);
  store.attempts = store.attempts.slice(-1000);
  writeStore(store);
  return attempt;
}

function getLatest(metricKey) {
  return readStore().snapshots
    .filter((item) => item.metricKey === metricKey)
    .sort((a, b) => new Date(b.capturedAt) - new Date(a.capturedAt))[0] || null;
}

function getHistory(metricKey, days = 365) {
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - Math.max(1, Number(days) || 365));
  return readStore().snapshots
    .filter((item) => item.metricKey === metricKey && new Date(item.capturedAt) >= cutoff)
    .sort((a, b) => new Date(a.capturedAt) - new Date(b.capturedAt));
}

function getLatestAttempt(metricKey) {
  return readStore().attempts
    .filter((item) => item.metricKey === metricKey)
    .sort((a, b) => new Date(b.attemptedAt) - new Date(a.attemptedAt))[0] || null;
}

module.exports = { DATA_FILE, saveSnapshot, saveAttempt, getLatest, getHistory, getLatestAttempt };
