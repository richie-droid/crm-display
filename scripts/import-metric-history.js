const fs = require("fs");
const path = require("path");
const { saveSnapshot } = require("../storage/metricStore");

const [filePath, metricKey, source = "historical_import"] = process.argv.slice(2);
if (!filePath || !metricKey) {
  console.error("Usage: node scripts/import-metric-history.js <csv-file> <metric-key> [source]");
  process.exit(1);
}

const rows = fs.readFileSync(path.resolve(filePath), "utf8").trim().split(/\r?\n/);
const headers = rows.shift().split(",").map((x) => x.trim().toLowerCase());
const dateIndex = headers.indexOf("date");
const valueIndex = headers.findIndex((x) => ["value", "count", metricKey.toLowerCase()].includes(x));
if (dateIndex < 0 || valueIndex < 0) throw new Error("CSV must include date and value/count columns");

let imported = 0;
for (const row of rows) {
  if (!row.trim()) continue;
  const values = row.split(",").map((x) => x.trim().replace(/^\"|\"$/g, ""));
  const numericValue = Number(values[valueIndex].replace(/,/g, ""));
  if (!Number.isFinite(numericValue)) continue;
  saveSnapshot({ metricKey, value: numericValue, capturedAt: new Date(`${values[dateIndex]}T12:00:00Z`), source });
  imported += 1;
}
console.log(`Imported ${imported} ${metricKey} snapshots.`);
