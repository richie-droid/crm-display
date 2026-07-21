require("dotenv").config();

const crypto = require("crypto");
const express = require("express");
const { getIndividualPerformanceData } = require("./data/individualPerformance");
const { renderIndividualPerformancePage } = require("./pages/individualPerformance");
const { buildClosedTransactionsDashboard } = require("./data/closedTransactions");
const { renderClosedTransactionsPage } = require("./pages/closedTransactions");
const { buildListingsDashboard } = require("./data/listings");
const { renderListingsPage } = require("./pages/listings");
const {
  METRICS,
  collectServerMetrics,
  getMarketStatisticsData,
} = require("./data/marketStatistics");
const { renderMarketStatisticsPage } = require("./pages/marketStatistics");
const { buildListingOutcomesDashboard } = require("./data/listingOutcomes");
const { renderListingOutcomesPage } = require("./pages/listingOutcomes");
const { buildPipelineGrowthChallenge } = require("./data/pipelineGrowthChallenge");
const { renderPipelineGrowthChallengePage } = require("./pages/pipelineGrowthChallenge");
const { saveSnapshot, saveAttempt } = require("./storage/metricStore");
const { seedMetricHistory } = require("./storage/seedMetricHistory");

const app = express();
const PORT = process.env.PORT || 3000;
const DAILY_REFRESH_MS = 24 * 60 * 60 * 1000;
const allowedIngestMetrics = new Set([METRICS.CREXI]);

app.use(express.json({ limit: "50kb" }));

function secretsMatch(provided, expected) {
  if (!provided || !expected) return false;

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);

  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function requireIngestSecret(req, res, next) {
  const authorization = req.get("authorization") || "";
  const provided = authorization.startsWith("Bearer ")
    ? authorization.slice(7)
    : "";

  if (!secretsMatch(provided, process.env.METRICS_INGEST_SECRET)) {
    return res.status(401).json({
      ok: false,
      message: "Unauthorized",
    });
  }

  next();
}

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/individual-performance", async (req, res) => {
  try {
    res.json(await getIndividualPerformanceData());
  } catch (error) {
    console.error("Individual performance error:", error);

    res.status(500).json({
      error: "Failed to load individual performance data",
      message: error.message,
    });
  }
});

app.get("/individual-performance", async (req, res) => {
  try {
    res.send(
      renderIndividualPerformancePage(
        await getIndividualPerformanceData()
      )
    );
  } catch (error) {
    res
      .status(500)
      .send(
        `<h1>Individual Performance Dashboard Error</h1><pre>${error.message}</pre>`
      );
  }
});

app.get("/api/summary", async (req, res) => {
  try {
    const data = await buildClosedTransactionsDashboard();

    res.json({
      ok: true,
      generatedAt: data.generatedAt.toISOString(),
      current: data.current,
      prior: data.prior,
      comparison: data.comparison,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: error.message,
    });
  }
});

app.get("/api/test-listings", async (req, res) => {
  try {
    res.json({
      ok: true,
      ...(await buildListingsDashboard()),
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: error.message,
    });
  }
});

app.get("/api/listing-outcomes", async (req, res) => {
  try {
    res.json({
      ok: true,
      ...(await buildListingOutcomesDashboard()),
    });
  } catch (error) {
    console.error("Listing outcomes error:", error);

    res.status(500).json({
      ok: false,
      message: error.message,
    });
  }
});


app.get("/api/pipeline-growth-challenge", async (req, res) => {
  try {
    res.json({
      ok: true,
      ...(await buildPipelineGrowthChallenge()),
    });
  } catch (error) {
    console.error("Pipeline Growth Challenge error:", error);

    res.status(500).json({
      ok: false,
      message: error.message,
    });
  }
});

app.get("/api/pipeline-growth-challenge/debug", async (req, res) => {
  try {
    res.json({
      ok: true,
      ...(await buildPipelineGrowthChallenge({ debug: true })),
    });
  } catch (error) {
    console.error("Pipeline Growth Challenge debug error:", error);

    res.status(500).json({
      ok: false,
      message: error.message,
    });
  }
});

app.get("/api/market-statistics", (req, res) => {
  try {
    const days = Math.min(
      3650,
      Math.max(1, Number(req.query.days) || 365)
    );

    res.json({
      ok: true,
      ...getMarketStatisticsData(days),
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: error.message,
    });
  }
});

app.post(
  "/api/market-statistics/ingest",
  requireIngestSecret,
  (req, res) => {
    try {
      const {
        metricKey,
        value,
        capturedAt,
        status = "success",
        errorMessage,
      } = req.body || {};

      if (!allowedIngestMetrics.has(metricKey)) {
        return res.status(400).json({
          ok: false,
          message: "Metric is not allowed for external ingestion",
        });
      }

      if (status === "failed") {
        const attempt = saveAttempt({
          metricKey,
          status: "failed",
          attemptedAt: capturedAt,
          errorMessage,
        });

        return res.json({
          ok: true,
          attempt,
          latestValuePreserved: true,
        });
      }

      if (
        !Number.isInteger(Number(value)) ||
        Number(value) < 0
      ) {
        return res.status(400).json({
          ok: false,
          message: "Crexi value must be a non-negative integer",
        });
      }

      const snapshot = saveSnapshot({
        metricKey,
        value: Number(value),
        capturedAt,
        source: "crexi_playwright",
      });

      saveAttempt({
        metricKey,
        status: "success",
        attemptedAt: capturedAt,
      });

      res.json({
        ok: true,
        snapshot,
      });
    } catch (error) {
      res.status(400).json({
        ok: false,
        message: error.message,
      });
    }
  }
);

app.post(
  "/api/market-statistics/refresh",
  requireIngestSecret,
  async (req, res) => {
    try {
      res.json({
        ok: true,
        results: await collectServerMetrics(),
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        message: error.message,
      });
    }
  }
);

app.get("/", (req, res) => {
  res.redirect("/closed-production");
});

app.get("/closed-production", async (req, res) => {
  try {
    res.send(
      renderClosedTransactionsPage(
        await buildClosedTransactionsDashboard()
      )
    );
  } catch (error) {
    res
      .status(500)
      .send(
        `<h1>Closed Transactions Dashboard Error</h1><pre>${error.message}</pre>`
      );
  }
});

app.get("/listings", async (req, res) => {
  try {
    res.send(
      renderListingsPage(
        await buildListingsDashboard()
      )
    );
  } catch (error) {
    res
      .status(500)
      .send(
        `<h1>Marketing Snapshot Dashboard Error</h1><pre>${error.message}</pre>`
      );
  }
});

app.get("/listing-outcomes", async (req, res) => {
  try {
    res.send(
      renderListingOutcomesPage(
        await buildListingOutcomesDashboard()
      )
    );
  } catch (error) {
    console.error("Listing outcomes page error:", error);

    res
      .status(500)
      .send(
        `<h1>Listing Outcomes Dashboard Error</h1><pre>${error.message}</pre>`
      );
  }
});


app.get("/pipeline-growth-challenge", async (req, res) => {
  try {
    res.send(
      renderPipelineGrowthChallengePage(
        await buildPipelineGrowthChallenge()
      )
    );
  } catch (error) {
    console.error("Pipeline Growth Challenge page error:", error);

    res
      .status(500)
      .send(
        `<h1>Pipeline Growth Challenge Error</h1><pre>${error.message}</pre>`
      );
  }
});

app.get("/market-statistics", (req, res) => {
  try {
    res.send(
      renderMarketStatisticsPage(
        getMarketStatisticsData(365)
      )
    );
  } catch (error) {
    res
      .status(500)
      .send(
        `<h1>Market Statistics Dashboard Error</h1><pre>${error.message}</pre>`
      );
  }
});

async function initializeMarketStatistics() {
  try {
    const seedResults = await seedMetricHistory();

    console.log(
      "Market metric history seed complete",
      seedResults
    );
  } catch (error) {
    console.error(
      "Market metric history seed failed",
      error
    );
  }

  try {
    const refreshResults = await collectServerMetrics();

    console.log(
      "Initial market metric refresh complete",
      refreshResults
    );
  } catch (error) {
    console.error(
      "Initial market metric refresh failed",
      error
    );
  }
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);

  initializeMarketStatistics();

  setInterval(() => {
    collectServerMetrics()
      .then((result) => {
        console.log(
          "Daily market metric refresh complete",
          result
        );
      })
      .catch((error) => {
        console.error(
          "Daily market metric refresh failed",
          error
        );
      });
  }, DAILY_REFRESH_MS).unref();
});
