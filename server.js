require("dotenv").config();

const express = require("express");
const { getIndividualPerformanceData } = require("./data/individualPerformance");
const { renderIndividualPerformancePage } = require("./pages/individualPerformance");

const { buildClosedTransactionsDashboard } = require("./data/closedTransactions");
const { renderClosedTransactionsPage } = require("./pages/closedTransactions");

const { buildListingsDashboard } = require("./data/listings");
const { renderListingsPage } = require("./pages/listings");

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/individual-performance", async (req, res) => {
  try {
    const data = await getIndividualPerformanceData();
    res.json(data);
  } catch (error) {
    console.error("Individual performance error:", error);
    res.status(500).json({
      error: "Failed to load individual performance data",
      message: error.message
    });
  }
});

app.get("/individual-performance", async (req, res) => {
  try {
    const dashboard = await getIndividualPerformanceData();
    res.send(renderIndividualPerformancePage(dashboard));
  } catch (error) {
    res.status(500).send(`
      <h1>Individual Performance Dashboard Error</h1>
      <pre>${error.message}</pre>
    `);
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
    const data = await buildListingsDashboard();

    res.json({
      ok: true,
      ...data,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: error.message,
    });
  }
});

app.get("/", async (req, res) => {
  res.redirect("/closed-production");
});

app.get("/closed-production", async (req, res) => {
  try {
    const dashboard = await buildClosedTransactionsDashboard();
    res.send(renderClosedTransactionsPage(dashboard));
  } catch (error) {
    res.status(500).send(`
      <h1>Closed Transactions Dashboard Error</h1>
      <pre>${error.message}</pre>
    `);
  }
});

app.get("/listings", async (req, res) => {
  try {
    const dashboard = await buildListingsDashboard();
    res.send(renderListingsPage(dashboard));
  } catch (error) {
    res.status(500).send(`
      <h1>Marketing Snapshot Dashboard Error</h1>
      <pre>${error.message}</pre>
    `);
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});