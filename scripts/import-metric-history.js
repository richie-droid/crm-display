const fs = require("fs");
const path = require("path");
const { saveSnapshot } = require("../storage/metricStore");

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (character === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (character === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
    } else {
      current += character;
    }
  }

  values.push(current.trim());

  return values;
}

function normalizeDate(value) {
  const cleaned = String(value || "")
    .replace(/^"|"$/g, "")
    .trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    throw new Error(`Invalid history date: ${cleaned}`);
  }

  const date = new Date(`${cleaned}T12:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid history date: ${cleaned}`);
  }

  return date.toISOString();
}

function importMetricHistory({
  filePath,
  metricKey,
  source = "historical_import",
}) {
  if (!filePath) {
    throw new Error("filePath is required");
  }

  if (!metricKey) {
    throw new Error("metricKey is required");
  }

  const resolvedPath = path.resolve(filePath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(
      `Historical CSV was not found: ${resolvedPath}`
    );
  }

  const lines = fs
    .readFileSync(resolvedPath, "utf8")
    .trim()
    .split(/\r?\n/)
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error(
      `Historical CSV contains no data rows: ${resolvedPath}`
    );
  }

  const headers = parseCsvLine(lines.shift()).map(
    (value) =>
      value
        .replace(/^"|"$/g, "")
        .trim()
        .toLowerCase()
  );

  const dateIndex = headers.indexOf("date");
  const valueIndex = headers.findIndex((header) =>
    [
      "value",
      "count",
      metricKey.toLowerCase(),
    ].includes(header)
  );

  if (dateIndex < 0 || valueIndex < 0) {
    throw new Error(
      "CSV must include date and value/count columns"
    );
  }

  let imported = 0;
  let skipped = 0;

  for (const line of lines) {
    const values = parseCsvLine(line);

    const rawDate = values[dateIndex];
    const rawValue = String(
      values[valueIndex] || ""
    )
      .replace(/^"|"$/g, "")
      .replace(/,/g, "")
      .trim();

    const numericValue = Number(rawValue);

    if (!Number.isFinite(numericValue)) {
      skipped += 1;
      continue;
    }

    saveSnapshot({
      metricKey,
      value: numericValue,
      capturedAt: normalizeDate(rawDate),
      source,
    });

    imported += 1;
  }

  return {
    filePath: resolvedPath,
    metricKey,
    imported,
    skipped,
  };
}

function main() {
  const [
    filePath,
    metricKey,
    source = "historical_import",
  ] = process.argv.slice(2);

  if (!filePath || !metricKey) {
    console.error(
      "Usage: node scripts/import-metric-history.js " +
        "<csv-file> <metric-key> [source]"
    );

    process.exitCode = 1;
    return;
  }

  const result = importMetricHistory({
    filePath,
    metricKey,
    source,
  });

  console.log(
    `Imported ${result.imported} ${metricKey} snapshots.` +
      (result.skipped
        ? ` Skipped ${result.skipped} invalid rows.`
        : "")
  );
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(
      `Metric history import failed: ${error.message}`
    );

    process.exitCode = 1;
  }
}

module.exports = {
  importMetricHistory,
};
