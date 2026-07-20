require("dotenv").config();

const { chromium } = require("playwright");

const SEARCH_URL =
  process.env.CREXI_SAVED_SEARCH_URL ||
  "https://www.crexi.com/search?searchType=Sales&financials.capRatePercent_min=2&tenancy.tenancyType_value=Single&showMap=false";

const INGEST_URL =
  process.env.DASHBOARD_INGEST_URL;

const SECRET =
  process.env.DASHBOARD_INGEST_SECRET;

const DEBUG_URL =
  process.env.CREXI_DEBUG_URL ||
  "http://127.0.0.1:9222";

function isCrexiSearchPage(url) {
  return (
    url.includes("crexi.com/search") ||
    url.includes("crexi.com/properties")
  );
}

async function sendAttempt(
  status,
  count,
  errorMessage
) {
  if (!INGEST_URL || !SECRET) {
    throw new Error(
      "DASHBOARD_INGEST_URL and " +
        "DASHBOARD_INGEST_SECRET are required"
    );
  }

  const response = await fetch(
    INGEST_URL,
    {
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
    }
  );

  if (!response.ok) {
    throw new Error(
      `Dashboard ingestion failed with HTTP ` +
        `${response.status}: ` +
        `${await response.text()}`
    );
  }

  return response
    .json()
    .catch(() => null);
}

async function getCrexiPage(context) {
  const pages = context.pages();

  const existingCrexiPage =
    pages.find((page) =>
      isCrexiSearchPage(
        page.url()
      )
    );

  if (existingCrexiPage) {
    return existingCrexiPage;
  }

  const page =
    await context.newPage();

  await page.goto(
    SEARCH_URL,
    {
      waitUntil: "domcontentloaded",
      timeout: 90000,
    }
  );

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

  for (
    const label of possibleButtons
  ) {
    const button =
      page.getByRole(
        "button",
        {
          name: new RegExp(
            `^${label}$`,
            "i"
          ),
        }
      );

    const isVisible =
      await button
        .first()
        .isVisible()
        .catch(() => false);

    if (isVisible) {
      await button
        .first()
        .click()
        .catch(() => {});

      await page.waitForTimeout(
        500
      );
    }
  }

  await page.keyboard
    .press("Escape")
    .catch(() => {});
}

function parseCountText(text) {
  const match = String(
    text || ""
  )
    .trim()
    .match(
      /^([\d,]+)\s+properties$/i
    );

  if (!match) {
    return null;
  }

  const value = Number(
    match[1].replace(/,/g, "")
  );

  if (
    !Number.isInteger(value) ||
    value < 0
  ) {
    return null;
  }

  return value;
}

async function getHeaderCountCandidates(page) {
  const locator =
    page.getByText(
      /^\s*[\d,]+\s+properties\s*$/i
    );

  const count =
    await locator
      .count()
      .catch(() => 0);

  const candidates = [];

  for (
    let index = 0;
    index < count;
    index += 1
  ) {
    const item =
      locator.nth(index);

    const isVisible =
      await item
        .isVisible()
        .catch(() => false);

    if (!isVisible) {
      continue;
    }

    const text =
      await item
        .innerText()
        .catch(() => "");

    const value =
      parseCountText(text);

    if (value === null) {
      continue;
    }

    const box =
      await item
        .boundingBox()
        .catch(() => null);

    if (!box) {
      continue;
    }

    candidates.push({
      value,
      text: text.trim(),
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
    });
  }

  return candidates;
}

function selectHeaderResultsCount(
  candidates
) {
  if (!candidates.length) {
    return null;
  }

  const headerCandidates =
    candidates.filter(
      (candidate) =>
        candidate.y >= 0 &&
        candidate.y <= 350 &&
        candidate.x >= 0 &&
        candidate.x <= 500
    );

  if (!headerCandidates.length) {
    return null;
  }

  headerCandidates.sort(
    (a, b) =>
      a.y - b.y ||
      a.x - b.x
  );

  return headerCandidates[0];
}

async function findVisibleResultsCount(page) {
  const candidates =
    await getHeaderCountCandidates(
      page
    );

  console.log(
    "Visible Crexi count candidates:",
    candidates
  );

  return selectHeaderResultsCount(
    candidates
  );
}

async function waitForStableResultsCount(
  page
) {
  const deadline =
    Date.now() + 60000;

  let previousValue = null;
  let stableMatches = 0;

  while (
    Date.now() < deadline
  ) {
    const candidate =
      await findVisibleResultsCount(
        page
      );

    if (
      candidate &&
      candidate.value === previousValue
    ) {
      stableMatches += 1;
    } else {
      previousValue =
        candidate
          ? candidate.value
          : null;

      stableMatches = 0;
    }

    if (
      candidate &&
      stableMatches >= 1
    ) {
      return candidate;
    }

    await page.waitForTimeout(
      2000
    );
  }

  return null;
}

async function extractCount(page) {
  await page.bringToFront();

  if (
    !isCrexiSearchPage(
      page.url()
    )
  ) {
    await page.goto(
      SEARCH_URL,
      {
        waitUntil:
          "domcontentloaded",

        timeout: 90000,
      }
    );
  } else {
    await page.reload({
      waitUntil:
        "domcontentloaded",

      timeout: 90000,
    });
  }

  await dismissCommonPopups(
    page
  );

  const candidate =
    await waitForStableResultsCount(
      page
    );

  if (!candidate) {
    throw new Error(
      "Could not find a stable Crexi results count " +
        "in the top-left search results header. " +
        `Current page: ${page.url()}`
    );
  }

  console.log(
    "Selected Crexi results count:",
    candidate
  );

  return candidate.value;
}

async function main() {
  let browser;

  try {
    browser =
      await chromium.connectOverCDP(
        DEBUG_URL
      );

    const contexts =
      browser.contexts();

    if (!contexts.length) {
      throw new Error(
        "Connected to Chrome, but no browser " +
          "context was available"
      );
    }

    const context =
      contexts[0];

    const page =
      await getCrexiPage(
        context
      );

    const count =
      await extractCount(
        page
      );

    console.log(
      `Crexi count captured: ` +
        `${count.toLocaleString(
          "en-US"
        )}`
    );

    await sendAttempt(
      "success",
      count,
      null
    );

    console.log(
      "Crexi count sent successfully"
    );
  } catch (error) {
    console.error(
      `Crexi collection failed: ` +
        `${error.message}`
    );

    try {
      await sendAttempt(
        "failed",
        null,
        error.message
      );
    } catch (reportError) {
      console.error(
        `Failure report also failed: ` +
          `${reportError.message}`
      );
    }

    process.exitCode = 1;
  } finally {
    // Disconnect Playwright without closing Chrome.
    if (browser) {
      await browser
        .close()
        .catch(() => {});
    }
  }
}

main();