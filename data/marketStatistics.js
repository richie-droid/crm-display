const { buildListingsDashboard } = require("./listings");
const {
  saveSnapshot,
  saveAttempt,
  getLatest,
  getHistory,
  getLatestAttempt,
} = require("../storage/metricStore");

const METRICS = {
  CREXI: "crexi_listing_count",
  TRINITY: "trinity_listing_count",
  TREASURY: "five_year_treasury",
};

async function fetchFiveYearTreasury() {
  const currentYear = new Date().getUTCFullYear();

  const url =
    `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/` +
    `daily-treasury-rates.csv/${currentYear}/all?type=daily_treasury_yield_curve`;

  const response = await fetch(url, {
    headers: {
      "user-agent": "Trinity-KPI-Dashboard/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Treasury request failed with HTTP ${response.status}`
    );
  }

  const csv = await response.text();

  const lines = csv
    .trim()
    .split(/\r?\n/)
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error("Treasury response did not contain data rows");
  }

  const headers = lines[0]
    .split(",")
    .map((value) => value.replace(/^"|"$/g, "").trim());

  const fiveYearIndex = headers.findIndex((header) => {
    const normalized = header
      .toLowerCase()
      .replace(/\./g, "")
      .replace(/-/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    return normalized === "5 yr" || normalized === "5 year";
  });

  const dateIndex = headers.findIndex(
    (header) => header.toLowerCase() === "date"
  );

  if (fiveYearIndex < 0 || dateIndex < 0) {
    throw new Error(
      "Treasury CSV is missing Date or 5-year columns"
    );
  }

  for (const line of lines.slice(1)) {
    const values = line
      .split(",")
      .map((value) => value.replace(/^"|"$/g, "").trim());

    const rate = Number(values[fiveYearIndex]);
    const date = values[dateIndex];

    if (!date || !Number.isFinite(rate)) {
      continue;
    }

    const [month, day, observationYear] = date
      .split("/")
      .map(Number);

    if (
      !Number.isInteger(month) ||
      !Number.isInteger(day) ||
      !Number.isInteger(observationYear)
    ) {
      continue;
    }

    const capturedAt = new Date(
      Date.UTC(
        observationYear,
        month - 1,
        day,
        12,
        0,
        0
      )
    ).toISOString();

    return {
      value: rate,
      capturedAt,
    };
  }

  throw new Error(
    "No valid 5-year Treasury rate was found"
  );
}

async function collectServerMetrics() {
  const results = {};

  try {
    const listings = await buildListingsDashboard();

    results.trinity = saveSnapshot({
      metricKey: METRICS.TRINITY,
      value: listings.summary.activeListings,
      capturedAt: new Date().toISOString(),
      source: "salesforce",
    });

    saveAttempt({
      metricKey: METRICS.TRINITY,
      status: "success",
    });
  } catch (error) {
    saveAttempt({
      metricKey: METRICS.TRINITY,
      status: "failed",
      errorMessage: error.message,
    });

    results.trinityError = error.message;
  }

  try {
    const treasury = await fetchFiveYearTreasury();

    results.treasury = saveSnapshot({
      metricKey: METRICS.TREASURY,
      value: treasury.value,
      capturedAt: treasury.capturedAt,
      source: "us_treasury",
    });

    saveAttempt({
      metricKey: METRICS.TREASURY,
      status: "success",
    });
  } catch (error) {
    saveAttempt({
      metricKey: METRICS.TREASURY,
      status: "failed",
      errorMessage: error.message,
    });

    results.treasuryError = error.message;
  }

  return results;
}

function metricPayload(metricKey, days) {
  return {
    latest: getLatest(metricKey),
    latestAttempt: getLatestAttempt(metricKey),
    history: getHistory(metricKey, days),
  };
}

function getMarketStatisticsData(days = 365) {
  return {
    generatedAt: new Date().toISOString(),
    metrics: {
      crexi: metricPayload(METRICS.CREXI, days),
      trinity: metricPayload(METRICS.TRINITY, days),
      treasury: metricPayload(METRICS.TREASURY, days),
    },
  };
}

module.exports = {
  METRICS,
  collectServerMetrics,
  getMarketStatisticsData,
};