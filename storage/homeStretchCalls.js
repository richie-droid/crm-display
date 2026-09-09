const fs = require("fs");
const path = require("path");

const LOCAL_DATA_DIR = path.join(process.cwd(), ".data", "home-stretch");
const DATA_DIR =
  process.env.HOME_STRETCH_DATA_DIR ||
  (process.env.RAILWAY_ENVIRONMENT ? "/data/home-stretch" : LOCAL_DATA_DIR);
const DATA_PATH = path.join(DATA_DIR, "calls.json");

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function normalizeEntry(entry) {
  const weekStart = String(entry.weekStart || entry.week_start || "").slice(0, 10);
  const salesforceName = String(entry.salesforceName || entry.salesforce_name || "").trim();
  const rawCalls = entry.calls;
  const calls = rawCalls === "" || rawCalls === null || rawCalls === undefined ? null : Number(rawCalls);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart) || !salesforceName) return null;
  if (calls !== null && (!Number.isInteger(calls) || calls < 0)) return null;
  return { weekStart, salesforceName, calls };
}

function writePayload(payload) {
  ensureDataDir();
  const tempPath = `${DATA_PATH}.tmp`;
  fs.writeFileSync(tempPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  fs.renameSync(tempPath, DATA_PATH);
}

function readPayload() {
  ensureDataDir();
  if (!fs.existsSync(DATA_PATH)) {
    return { updatedAt: null, entries: [] };
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
    return {
      updatedAt: parsed.updatedAt || null,
      entries: Array.isArray(parsed.entries) ? parsed.entries.map(normalizeEntry).filter(Boolean) : [],
    };
  } catch (error) {
    throw new Error(`Unable to read Home Stretch calls: ${error.message}`);
  }
}

function loadHomeStretchCalls() { return readPayload().entries; }
function getHomeStretchCallsData() { return readPayload(); }

function saveHomeStretchCalls(entries) {
  if (!Array.isArray(entries)) throw new Error("Call entries must be an array");
  const normalized = entries.map(normalizeEntry);
  if (normalized.some((entry) => !entry)) {
    throw new Error("Every call entry must have a valid week, agent, and whole-number call total");
  }
  const unique = new Map();
  for (const entry of normalized) {
    if (entry.calls === null) continue;
    unique.set(`${entry.weekStart}|${entry.salesforceName.toLowerCase()}`, entry);
  }
  const payload = {
    updatedAt: new Date().toISOString(),
    entries: [...unique.values()].sort((a, b) =>
      a.weekStart.localeCompare(b.weekStart) || a.salesforceName.localeCompare(b.salesforceName)
    ),
  };
  writePayload(payload);
  return payload;
}

module.exports = {
  DATA_PATH,
  getHomeStretchCallsData,
  loadHomeStretchCalls,
  saveHomeStretchCalls,
};
