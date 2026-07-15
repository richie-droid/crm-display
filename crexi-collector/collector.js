require("dotenv").config();

const { chromium } = require("playwright");

const SEARCH_URL =
  process.env.CREXI_SAVED_SEARCH_URL ||
  "https://www.crexi.com/properties?capRateMin=2&tenancies%5B%5D=Single";

const INGEST_URL = process.env.DASHBOARD_INGEST_URL;
const SECRET = process.env.DASHBOARD_INGEST_SECRET;

const DEBUG_URL =
  process.env.CREXI_DEBUG_URL ||
  "http://127.0.0.1:9222";

async function sendAttempt(status, count, errorMessage) {
  if (!INGEST_URL || !SECRET) {
    throw new Error(
      "DASHBOARD_INGEST_URL and DASHBOARD_INGEST_SECRET are required"
    );
  }

  const response = await fetch(INGEST_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${SECRET}`,
    },
    body: JSON.stringify({
      metricKey: "crexi_listing_count",
      value: count,
      capturedAt: new Date().toISOString(),
      status,
      errorMessage,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Dashboard ingestion failed with HTTP ${response.status}: ` +
        `${await response.text()}`
    );
  }
}

async function getCrexiPage(context) {
  const pages = context.pages();

  const existingCrexiPage = pages.find((page) =>
    page.url().includes("crexi.com/properties")
  );

  if (existingCrexiPage) {
    return existingCrexiPage;
  }

  const page = await context.newPage();

  await page.goto(SEARCH_URL, {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });

  return page;
}

async function dismissCommonPopups(page) {
  const possibleButtons = [
    "Not Now",
    "Maybe Later",
    "No Thanks",
    "Dismiss",
    "Close",
  ];

  for (const label of possibleButtons) {
    const button = page.getByRole("button", {
      name: new RegExp(`^${label}$`, "i"),
    });

    if (await button.first().isVisible().catch(() => false)) {
      await button.first().click().catch(() => {});
      await page.waitForTimeout(500);
    }
  }

  await page.keyboard.press("Escape").catch(() => {});
}

async function extractCount(page) {
  await page.bringToFront();

  if (!page.url().includes("crexi.com/properties")) {
    await page.goto(SEARCH_URL, {
      waitUntil: "domcontentloaded",
      timeout: 90000,
    });
  } else {
    await page.reload({
      waitUntil: "domcontentloaded",
      timeout: 90000,
    });
  }

  await page.waitForTimeout(5000);

  await dismissCommonPopups(page);

  const bodyText = await page.locator("body").innerText();

  const matches = [
    ...bodyText.matchAll(/(?:^|\s)([\d,]+)\s+results\b/gi),
  ];

  const values = matches
    .map((match) => Number(match[1].replace(/,/g, "")))
    .filter(Number.isFinite);

  if (!values.length) {
    throw new Error(
      "Could not find the Crexi results count. " +
        "The browser may require login or human verification."
    );
  }

  return Math.max(...values);
}

async function main() {
  let browser;

  try {
    browser = await chromium.connectOverCDP(DEBUG_URL);

    const contexts = browser.contexts();

    if (!contexts.length) {
      throw new Error(
        "Connected to Chrome, but no browser context was available"
      );
    }

    const context = contexts[0];
    const page = await getCrexiPage(context);
    const count = await extractCount(page);

    console.log(
      `Crexi count captured: ${count.toLocaleString("en-US")}`
    );

    await sendAttempt("success", count, null);

    console.log("Crexi count sent successfully");
  } catch (error) {
    console.error(`Crexi collection failed: ${error.message}`);

    try {
      await sendAttempt("failed", null, error.message);
    } catch (reportError) {
      console.error(
        `Failure report also failed: ${reportError.message}`
      );
    }

    process.exitCode = 1;
  } finally {
    // Disconnect Playwright without closing the user's Chrome window.
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}

main();