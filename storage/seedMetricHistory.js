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
      snapshot.capturedAt.slice(0, 10) < today
  );
}

async function runSeedStep(name, step) {
  try {
    return await step();
  } catch (error) {
    console.error(
      `Market metric ${name} history seed failed:`,
      error
    );

    return {
      status: "failed",
      error: error.message,
    };
  }
}

async function seedMetricHistory() {
  const results = {
    crexi: null,
    trinity: null,
    treasury: null,
  };

  results.crexi = await runSeedStep(
    "Crexi",
    async () => {
      if (hasHistoricalData(METRICS.CREXI)) {
        return {
          status: "skipped",
          reason: "Historical data already exists",
        };
      }

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

      return {
        status: "seeded",
        ...importResult,
      };
    }
  );

  results.trinity = await runSeedStep(
    "Trinity",
    async () => {
      if (hasHistoricalData(METRICS.TRINITY)) {
        return {
          status: "skipped",
          reason: "Historical data already exists",
        };
      }

      const importResult = importMetricHistory({
        filePath: path.join(
          __dirname,
          "..",
          "historical-data",
          "trinity-listing-history-90-days.csv"
        ),
        metricKey: METRICS.TRINITY,
        source: "trinity_historical_seed",
      });

      return {
        status: "seeded",
        ...importResult,
      };
    }
  );

  results.treasury = await runSeedStep(
    "Treasury",
    async () => {
      if (hasHistoricalData(METRICS.TREASURY)) {
        return {
          status: "skipped",
          reason: "Historical data already exists",
        };
      }

      const backfillResult =
        await backfillTreasuryHistory(
          TREASURY_BACKFILL_DAYS
        );

      return {
        status: "seeded",
        ...backfillResult,
      };
    }
  );

  return results;
}

module.exports = {
  seedMetricHistory,
};
