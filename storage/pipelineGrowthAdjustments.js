const fs = require("fs");
const path = require("path");

const LOCAL_DATA_DIR = path.join(process.cwd(), ".data", "pipeline-growth");
const DATA_DIR =
  process.env.PIPELINE_GROWTH_DATA_DIR ||
  (process.env.RAILWAY_ENVIRONMENT ? "/data/pipeline-growth" : LOCAL_DATA_DIR);
const DATA_PATH = path.join(DATA_DIR, "adjustments.json");

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function normalizeEntry(entry) {
  const salesforceName = String(entry.salesforceName || entry.salesforce_name || "").trim();
  const rawAdjustment = entry.netAdjustment;
  const netAdjustment =
    rawAdjustment === "" || rawAdjustment === null || rawAdjustment === undefined
      ? 0
      : Number(rawAdjustment);
  const notes = String(entry.notes || "").trim().slice(0, 500);

  if (!salesforceName || !Number.isFinite(netAdjustment)) return null;
  return { salesforceName, netAdjustment, notes };
}

function isBlank(entry) {
  return entry.netAdjustment === 0 && !entry.notes;
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
    throw new Error(`Unable to read Pipeline Growth adjustments: ${error.message}`);
  }
}

function loadPipelineGrowthAdjustments() {
  return readPayload().entries;
}

function getPipelineGrowthAdjustmentsData() {
  return readPayload();
}

function savePipelineGrowthAdjustments(entries) {
  if (!Array.isArray(entries)) throw new Error("Adjustment entries must be an array");

  const normalized = entries.map(normalizeEntry);
  if (normalized.some((entry) => !entry)) {
    throw new Error("Every adjustment entry must have a valid agent name and a numeric adjustment");
  }

  const payload = {
    updatedAt: new Date().toISOString(),
    entries: normalized
      .filter((entry) => !isBlank(entry))
      .sort((a, b) => a.salesforceName.localeCompare(b.salesforceName)),
  };

  writePayload(payload);
  return payload;
}

module.exports = {
  DATA_PATH,
  getPipelineGrowthAdjustmentsData,
  loadPipelineGrowthAdjustments,
  savePipelineGrowthAdjustments,
};
