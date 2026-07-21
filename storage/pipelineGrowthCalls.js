const fs = require("fs");
const path = require("path");

const LOCAL_DATA_DIR = path.join(process.cwd(), ".data", "pipeline-growth");
const DATA_DIR =
  process.env.PIPELINE_GROWTH_DATA_DIR ||
  (process.env.RAILWAY_ENVIRONMENT ? "/data/pipeline-growth" : LOCAL_DATA_DIR);
const DATA_PATH = path.join(DATA_DIR, "calls.json");
const SEED_CSV_PATH = path.join(process.cwd(), "config", "pipeline-growth-calls.csv");
const SEED_VERSION = 1;

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"' && quoted && next === '"') {
      value += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(value);
      value = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(value);
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = [];
      value = "";
    } else {
      value += char;
    }
  }
  if (value || row.length) {
    row.push(value);
    if (row.some((cell) => cell !== "")) rows.push(row);
  }
  if (!rows.length) return [];
  const headers = rows[0].map((header) => header.trim());
  return rows.slice(1).map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, (values[index] || "").trim()]))
  );
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

function readSeedEntries() {
  if (!fs.existsSync(SEED_CSV_PATH)) return [];
  return parseCsv(fs.readFileSync(SEED_CSV_PATH, "utf8"))
    .map(normalizeEntry)
    .filter(Boolean)
    .filter((entry) => entry.calls !== null);
}

function writePayload(payload) {
  ensureDataDir();
  const tempPath = `${DATA_PATH}.tmp`;
  fs.writeFileSync(tempPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  fs.renameSync(tempPath, DATA_PATH);
}

function mergeSeed(payload) {
  const existing = new Map();
  for (const entry of payload.entries || []) {
    const normalized = normalizeEntry(entry);
    if (normalized && normalized.calls !== null) {
      existing.set(`${normalized.weekStart}|${normalized.salesforceName.toLowerCase()}`, normalized);
    }
  }
  for (const entry of readSeedEntries()) {
    const key = `${entry.weekStart}|${entry.salesforceName.toLowerCase()}`;
    if (!existing.has(key)) existing.set(key, entry);
  }
  return {
    updatedAt: payload.updatedAt || new Date().toISOString(),
    seedVersion: SEED_VERSION,
    entries: [...existing.values()].sort((a, b) =>
      a.weekStart.localeCompare(b.weekStart) || a.salesforceName.localeCompare(b.salesforceName)
    ),
  };
}

function ensureSeeded() {
  ensureDataDir();
  let payload = { updatedAt: null, seedVersion: 0, entries: [] };
  if (fs.existsSync(DATA_PATH)) {
    try { payload = JSON.parse(fs.readFileSync(DATA_PATH, "utf8")); } catch (_) {}
  }
  if (!fs.existsSync(DATA_PATH) || Number(payload.seedVersion || 0) < SEED_VERSION) {
    const merged = mergeSeed(payload);
    merged.updatedAt = new Date().toISOString();
    writePayload(merged);
  }
}

function readPayload() {
  ensureSeeded();
  try {
    const parsed = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
    return {
      updatedAt: parsed.updatedAt || null,
      seedVersion: parsed.seedVersion || 0,
      entries: Array.isArray(parsed.entries) ? parsed.entries.map(normalizeEntry).filter(Boolean) : [],
    };
  } catch (error) {
    throw new Error(`Unable to read Pipeline Growth calls: ${error.message}`);
  }
}

function loadPipelineGrowthCalls() { return readPayload().entries; }
function getPipelineGrowthCallsData() { return readPayload(); }

function savePipelineGrowthCalls(entries) {
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
    seedVersion: SEED_VERSION,
    entries: [...unique.values()].sort((a, b) =>
      a.weekStart.localeCompare(b.weekStart) || a.salesforceName.localeCompare(b.salesforceName)
    ),
  };
  writePayload(payload);
  return payload;
}

module.exports = {
  DATA_PATH,
  getPipelineGrowthCallsData,
  loadPipelineGrowthCalls,
  savePipelineGrowthCalls,
};
