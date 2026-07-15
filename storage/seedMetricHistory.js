const path = require("path");
const { getHistory } = require("./metricStore");
const {
  importMetricHistory,
} = require("../scripts/import-metric-history");
const {
  backfillTreasuryHistory,
} = require("../scripts/backfill-treasury-history");

const METRICS = {
  CREXI: "crexi_listing_count",
  TRINITY: "trinity_listing_count",
  TREASURY: "five_year_treasury",
};

const HISTORY_LOOKBACK_DAYS = 3650;
const TREASURY_BACKFILL_DAYS = 90;

function hasHistoricalData(metricKey) {
  const history = getHistory(
    metricKey,
    HISTORY_LOOKBACK_DAYS
  );

  if (history.length < 2) {
    return false;
  }

  const today = new Date()
    .toISOString()
    .slice(0, 10);

  return history.some(
    (snapshot) =>
      snapshot.capturedAt.slice(0, 10) <
      today
  );
}

async function seedMetricHistory() {
  const results = {
    crexi: null,
    trinity: null,
    treasury: null,
  };

  if (hasHistoricalData(METRICS.CREXI)) {
    results.crexi = {
      status: "skipped",
      reason: "Historical data already exists",
    };
  } else {
    const importResult = importMetricHistory({
      filePath: path.join(
        __dirname,
        "..",
        "historical-data",
        "crexi-history.csv"
      ),
      metricKey: METRICS.CREXI,
      source: "crexi_historical_seed",
    });

    results.crexi = {
      status: "seeded",
      ...importResult,
    };
  }

  if (hasHistoricalData(METRICS.TRINITY)) {
    results.trinity = {
      status: "skipped",
      reason: "Historical data already exists",
    };
  } else {
    const importResult = importMetricHistory({
      filePath: path.join(
        __dirname,
        "..",
        "trinity-listing-history-90-days.csv"
      ),
      metricKey: METRICS.TRINITY,
      source: "trinity_historical_seed",
    });

    results.trinity = {
      status: "seeded",
      ...importResult,
    };
  }

  if (hasHistoricalData(METRICS.TREASURY)) {
    results.treasury = {
      status: "skipped",
      reason: "Historical data already exists",
    };
  } else {
    const backfillResult =
      await backfillTreasuryHistory(
        TREASURY_BACKFILL_DAYS
      );

    results.treasury = {
      status: "seeded",
      ...backfillResult,
    };
  }

  return results;
}

module.exports = {
  seedMetricHistory,
};
