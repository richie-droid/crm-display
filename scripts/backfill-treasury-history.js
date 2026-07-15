const { saveSnapshot } = require("../storage/metricStore");

const METRIC_KEY = "five_year_treasury";
const DEFAULT_DAYS = 90;

function normalizeHeader(value) {
  return String(value || "")
    .replace(/^"|"$/g, "")
    .trim()
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ");
}

function parseDate(value) {
  const cleaned = String(value || "")
    .replace(/^"|"$/g, "")
    .trim();

  const match = cleaned.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
  );

  if (!match) {
    return null;
  }

  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);

  const date = new Date(
    Date.UTC(year, month - 1, day, 12, 0, 0)
  );

  return Number.isNaN(date.getTime())
    ? null
    : date;
}

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

async function fetchTreasuryYear(year) {
  const url =
    "https://home.treasury.gov/resource-center/" +
    "data-chart-center/interest-rates/" +
    `daily-treasury-rates.csv/${year}/all` +
    "?type=daily_treasury_yield_curve";

  const response = await fetch(url, {
    headers: {
      "user-agent": "Trinity-KPI-Dashboard/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Treasury request for ${year} failed with HTTP ` +
        `${response.status}`
    );
  }

  const csv = await response.text();

  const lines = csv
    .trim()
    .split(/\r?\n/)
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error(
      `Treasury response for ${year} contained no data rows`
    );
  }

  const headers = parseCsvLine(lines[0]).map(
    normalizeHeader
  );

  const dateIndex = headers.findIndex(
    (header) => header === "date"
  );

  const fiveYearIndex = headers.findIndex(
    (header) =>
      header === "5 yr" ||
      header === "5 year"
  );

  if (dateIndex < 0 || fiveYearIndex < 0) {
    throw new Error(
      `Treasury CSV for ${year} is missing ` +
        "Date or 5-year columns"
    );
  }

  return lines
    .slice(1)
    .map((line) => {
      const values = parseCsvLine(line);
      const date = parseDate(values[dateIndex]);

      const rate = Number(
        String(values[fiveYearIndex] || "")
          .replace(/,/g, "")
          .trim()
      );

      if (!date || !Number.isFinite(rate)) {
        return null;
      }

      return {
        date,
        value: rate,
      };
    })
    .filter(Boolean);
}

async function backfillTreasuryHistory(
  requestedDays = DEFAULT_DAYS
) {
  const days = Number(requestedDays);

  if (
    !Number.isInteger(days) ||
    days < 1 ||
    days > 3650
  ) {
    throw new Error(
      "Days must be a whole number between 1 and 3650"
    );
  }

  const now = new Date();
  const cutoff = new Date(now);

  cutoff.setUTCDate(
    cutoff.getUTCDate() - days
  );

  cutoff.setUTCHours(0, 0, 0, 0);

  const years = new Set([
    now.getUTCFullYear(),
    cutoff.getUTCFullYear(),
  ]);

  const observations = [];

  for (const year of [...years].sort()) {
    const yearRows =
      await fetchTreasuryYear(year);

    observations.push(...yearRows);
  }

  const selected = observations
    .filter(
      ({ date }) =>
        date >= cutoff &&
        date <= now
    )
    .sort(
      (a, b) =>
        a.date - b.date
    );

  if (!selected.length) {
    throw new Error(
      `No valid 5-year Treasury observations found ` +
        `in the last ${days} days`
    );
  }

  for (const observation of selected) {
    saveSnapshot({
      metricKey: METRIC_KEY,
      value: observation.value,
      capturedAt:
        observation.date.toISOString(),
      source: "us_treasury_backfill",
    });
  }

  return {
    metricKey: METRIC_KEY,
    imported: selected.length,
    firstDate:
      selected[0].date
        .toISOString()
        .slice(0, 10),
    lastDate:
      selected[selected.length - 1].date
        .toISOString()
        .slice(0, 10),
  };
}

async function main() {
  const requestedDays = Number(
    process.argv[2] || DEFAULT_DAYS
  );

  const result =
    await backfillTreasuryHistory(
      requestedDays
    );

  console.log(
    `Imported ${result.imported} five-year Treasury ` +
      `observations from ${result.firstDate} ` +
      `through ${result.lastDate}.`
  );
}

if (require.main === module) {
  main().catch((error) => {
    console.error(
      `Treasury backfill failed: ${error.message}`
    );

    process.exitCode = 1;
  });
}

module.exports = {
  backfillTreasuryHistory,
};
