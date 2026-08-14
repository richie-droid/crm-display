const fs = require("fs");
const path = require("path");

const LOCAL_DATA_DIR = path.join(process.cwd(), ".data", "escrow-snapshots");
const DATA_DIR =
  process.env.ESCROW_SNAPSHOTS_DATA_DIR ||
  (process.env.RAILWAY_ENVIRONMENT ? "/data/escrow-snapshots" : LOCAL_DATA_DIR);
const DATA_PATH = path.join(DATA_DIR, "snapshots.json");

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function isValidDate(value) {
  if (!DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function normalizeEntry(entry) {
  const weekEnding = String(entry.weekEnding || entry.week_ending || "").trim();
  if (!isValidDate(weekEnding)) return null;

  const rawDeals = entry.deals;
  const deals =
    rawDeals === "" || rawDeals === null || rawDeals === undefined ? 0 : Number(rawDeals);

  const rawGci = entry.gci;
  const gci = rawGci === "" || rawGci === null || rawGci === undefined ? 0 : Number(rawGci);

  if (!Number.isFinite(deals) || deals < 0) return null;
  if (!Number.isFinite(gci) || gci < 0) return null;

  return { weekEnding, deals: Math.round(deals), gci: Math.round(gci * 100) / 100 };
}

function isBlank(entry) {
  return entry.deals === 0 && entry.gci === 0;
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
      entries: Array.isArray(parsed.entries)
        ? parsed.entries.map(normalizeEntry).filter(Boolean)
        : [],
    };
  } catch (error) {
    throw new Error(`Unable to read escrow snapshots: ${error.message}`);
  }
}

function loadEscrowSnapshots() {
  return readPayload().entries;
}

function getEscrowSnapshotsData() {
  return readPayload();
}

function saveEscrowSnapshots(entries) {
  if (!Array.isArray(entries)) throw new Error("Snapshot entries must be an array");

  const normalized = entries.map(normalizeEntry);
  if (normalized.some((entry) => !entry)) {
    throw new Error(
      "Every snapshot needs a valid date (YYYY-MM-DD) and non-negative deals and GCI"
    );
  }

  // De-duplicate by weekEnding (last one wins), drop fully-blank rows, sort newest first.
  const byDate = new Map();
  for (const entry of normalized) {
    if (isBlank(entry)) continue;
    byDate.set(entry.weekEnding, entry);
  }

  const payload = {
    updatedAt: new Date().toISOString(),
    entries: Array.from(byDate.values()).sort((a, b) =>
      b.weekEnding.localeCompare(a.weekEnding)
    ),
  };

  writePayload(payload);
  return payload;
}

module.exports = {
  DATA_PATH,
  getEscrowSnapshotsData,
  loadEscrowSnapshots,
  saveEscrowSnapshots,
};
