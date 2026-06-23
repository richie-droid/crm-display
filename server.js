require("dotenv").config();

const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

const SF_API_VERSION = "v60.0";

const FIELDS = {
  closeDate: "actual_close_date__c",
  soldPrice: "contract_sales_price__c",
  gci: "Trinity_Commission_Actual__c",
  sideRepresented: "Side_Represented__c",
};

async function getSalesforceToken() {
  const tokenUrl = `${process.env.SF_LOGIN_URL}/services/oauth2/token`;

  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: process.env.SF_CLIENT_ID,
    client_secret: process.env.SF_CLIENT_SECRET,
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data;
}

function getDateWindows() {
  const today = new Date();
  const currentYear = today.getFullYear();
  const priorYear = currentYear - 1;

  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return {
    current: {
      label: `${currentYear} YTD`,
      start: `${currentYear}-01-01`,
      end: `${currentYear}-${month}-${day}`,
    },
    prior: {
      label: `${priorYear} Same Period`,
      start: `${priorYear}-01-01`,
      end: `${priorYear}-${month}-${day}`,
    },
  };
}

async function querySalesforce(instanceUrl, accessToken, soql) {
  const queryUrl =
    `${instanceUrl}/services/data/${SF_API_VERSION}/query?q=` +
    encodeURIComponent(soql);

  const response = await fetch(queryUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data;
}

async function getContractsForWindow(instanceUrl, accessToken, startDate, endDate) {
  const soql = `
    SELECT Id,
           Name,
           ${FIELDS.closeDate},
           ${FIELDS.soldPrice},
           ${FIELDS.gci},
           ${FIELDS.sideRepresented}
    FROM ContractNew__c
    WHERE ${FIELDS.closeDate} >= ${startDate}
    AND ${FIELDS.closeDate} <= ${endDate}
    ORDER BY ${FIELDS.closeDate} DESC
  `;

  const result = await querySalesforce(instanceUrl, accessToken, soql);
  return result.records || [];
}

function summarizeContracts(records) {
  const summary = records.reduce(
    (summary, record) => {
      const soldPrice = Number(record.Contract_Sales_Price__c || 0);
      const gci = Number(record.Trinity_Commission_Actual__c || 0);
      const sideRepresented = String(record.Side_Represented__c || "");

      const isIntermediary = sideRepresented
        .toLowerCase()
        .includes("intermediary");

      const dealMultiplier = isIntermediary ? 2 : 1;

      summary.closedDeals += dealMultiplier;
      summary.closedVolume += soldPrice * dealMultiplier;
      summary.closedGci += gci;

      if (isIntermediary) {
        summary.intermediaryRecords += 1;
      }

      return summary;
    },
    {
      closedDeals: 0,
      closedVolume: 0,
      closedGci: 0,
      intermediaryRecords: 0,
    }
  );

  return {
    closedDeals: summary.closedDeals,
    closedVolume: Math.round(summary.closedVolume),
    closedGci: Math.round(summary.closedGci * 100) / 100,
    intermediaryRecords: summary.intermediaryRecords,
  };
}

function percentChange(current, prior) {
  if (!prior) return null;
  return ((current - prior) / prior) * 100;
}

function formatCompactCurrency(value, decimals = 1) {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(decimals)}M`;
  }

  if (value >= 1000) {
    return `$${(value / 1000).toFixed(decimals)}K`;
  }

  return `$${Number(value).toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

async function getDashboardData() {
  const tokenData = await getSalesforceToken();
  const windows = getDateWindows();

  const currentRecords = await getContractsForWindow(
    tokenData.instance_url,
    tokenData.access_token,
    windows.current.start,
    windows.current.end
  );

  const priorRecords = await getContractsForWindow(
    tokenData.instance_url,
    tokenData.access_token,
    windows.prior.start,
    windows.prior.end
  );

  const current = {
    ...windows.current,
    ...summarizeContracts(currentRecords),
  };

  const prior = {
    ...windows.prior,
    ...summarizeContracts(priorRecords),
  };

  return {
    generatedAt: new Date(),
    current,
    prior,
    comparison: {
      closedDealsPct: percentChange(current.closedDeals, prior.closedDeals),
      closedVolumePct: percentChange(current.closedVolume, prior.closedVolume),
      closedGciPct: percentChange(current.closedGci, prior.closedGci),
    },
  };
}

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/summary", async (req, res) => {
  try {
    const data = await getDashboardData();

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

app.get("/", async (req, res) => {
  return renderClosedProductionPage(req, res);
});

app.get("/closed-production", async (req, res) => {
  return renderClosedProductionPage(req, res);
});

async function renderClosedProductionPage(req, res) {
  try {
    const { current, prior, comparison } = await getDashboardData();

    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Trinity Closed Transactions</title>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta http-equiv="refresh" content="900" />
          <style>
            :root {
              --navy: #15445B;
              --blue: #4E92C7;
              --spring: #BFDBBB;
              --bone: #F4F1EC;
              --offwhite: #FEFAF6;
              --black: #02070A;
              --red: #ff624f;
            }

            * {
              box-sizing: border-box;
            }

            html,
            body {
              margin: 0;
              width: 100%;
              height: 100%;
              overflow: hidden;
              background: #02070A;
              color: var(--offwhite);
              font-family: Arial, Helvetica, sans-serif;
            }

            body {
              background:
                radial-gradient(circle at 85% 10%, rgba(78, 146, 199, 0.22), transparent 30%),
                radial-gradient(circle at 12% 92%, rgba(191, 219, 187, 0.12), transparent 28%),
                linear-gradient(135deg, #02070A 0%, #061924 48%, #02070A 100%);
            }

            .screen {
              width: 100vw;
              height: 100vh;
              padding: 3.2vh 3vw 3vh;
              display: grid;
              grid-template-rows: 12.5vh 1fr 20vh;
              gap: 2.7vh;
            }

            .header {
              display: grid;
              grid-template-columns: 1fr auto;
              align-items: center;
              border-bottom: 0.22vh solid rgba(244, 241, 236, 0.34);
              padding-bottom: 2.1vh;
            }

            .brand {
              display: flex;
              align-items: center;
              gap: 1.35vw;
            }

            .logo-mark {
              width: 7.3vh;
              height: 7.3vh;
              border: 0.36vh solid var(--blue);
              border-radius: 999px;
              display: flex;
              align-items: center;
              justify-content: center;
              color: var(--blue);
              font-size: 4.9vh;
              font-weight: 900;
            }

            .brand-divider {
              width: 0.18vw;
              height: 8.8vh;
              background: linear-gradient(to bottom, var(--blue), var(--spring));
            }

            .brand-name {
              font-size: 5.7vh;
              letter-spacing: 1.35vw;
              font-weight: 500;
              color: var(--bone);
              white-space: nowrap;
            }

            .page-title {
              text-align: right;
              text-transform: uppercase;
              letter-spacing: 0.55vw;
              font-size: 3.4vh;
              font-weight: 900;
              color: var(--spring);
              white-space: nowrap;
            }

            .main {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 3vw;
              min-height: 0;
            }

            .column {
              border: 0.18vh solid rgba(78, 146, 199, 0.85);
              border-radius: 1.8vh;
              background: rgba(2, 7, 10, 0.67);
              overflow: hidden;
              display: grid;
              grid-template-rows: 10.3vh 1fr;
              box-shadow: 0 0 4.2vh rgba(78, 146, 199, 0.18);
            }

            .column-header {
              background: linear-gradient(90deg, rgba(21, 68, 91, 0.95), rgba(78, 146, 199, 0.76));
              display: flex;
              align-items: center;
              justify-content: center;
              text-align: center;
            }

            .period {
              font-size: 5.2vh;
              letter-spacing: 0.45vw;
              font-weight: 900;
              color: var(--offwhite);
              text-transform: uppercase;
            }

            .metrics {
              display: grid;
              grid-template-rows: repeat(3, 1fr);
              padding: 2vh 2.3vw 2.2vh;
            }

            .metric {
              display: grid;
              grid-template-columns: 1fr auto;
              align-items: center;
              border-bottom: 0.18vh solid rgba(244, 241, 236, 0.31);
              min-height: 0;
              column-gap: 1.8vw;
            }

            .metric:last-child {
              border-bottom: none;
            }

            .value {
              font-size: 10.1vh;
              line-height: 0.9;
              font-weight: 900;
              color: var(--offwhite);
              letter-spacing: -0.18vw;
              white-space: nowrap;
              text-shadow: 0 0.4vh 1.4vh rgba(0, 0, 0, 0.55);
              justify-self: center;
            }

            .label {
              font-size: 3.1vh;
              letter-spacing: 0.16vw;
              font-weight: 900;
              text-transform: uppercase;
              color: var(--spring);
              white-space: nowrap;
              justify-self: start;
            }

            .metric.volume .label {
              color: var(--blue);
            }

            .comparison {
              border: 0.18vh solid rgba(244, 241, 236, 0.36);
              border-radius: 1.6vh;
              background: rgba(2, 7, 10, 0.54);
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              overflow: hidden;
            }

            .comparison-card {
              position: relative;
              display: grid;
              grid-template-rows: 1fr auto;
              align-items: center;
              justify-items: center;
              border-right: 0.18vh solid rgba(244, 241, 236, 0.28);
              padding: 2.5vh 1vw 2.3vh;
            }

            .comparison-card:last-child {
              border-right: none;
            }

            .comparison-card.up::after {
              content: "";
              position: absolute;
              left: 0;
              right: 0;
              bottom: 0;
              height: 0.35vh;
              background: linear-gradient(90deg, transparent, rgba(191, 219, 187, 0.95), transparent);
            }

            .comparison-card.down::after {
              content: "";
              position: absolute;
              left: 0;
              right: 0;
              bottom: 0;
              height: 0.35vh;
              background: linear-gradient(90deg, transparent, rgba(255, 98, 79, 0.95), transparent);
            }

            .comparison-value {
              font-size: 6.7vh;
              line-height: 1;
              font-weight: 900;
              white-space: nowrap;
            }

            .comparison-value.up {
              color: var(--spring);
            }

            .comparison-value.down {
              color: var(--red);
            }

            .comparison-label {
              margin-top: 1vh;
              font-size: 2.4vh;
              letter-spacing: 0.25vw;
              color: var(--offwhite);
              text-transform: uppercase;
              font-weight: 900;
              white-space: nowrap;
            }
          </style>
        </head>

        <body>
          <main class="screen">
            <section class="header">
              <div class="brand">
                <div class="logo-mark">T</div>
                <div class="brand-divider"></div>
                <div class="brand-name">TRINITY</div>
              </div>

              <div class="page-title">Closed Transactions</div>
            </section>

            <section class="main">
              <section class="column">
                <div class="column-header">
                  <div class="period">${current.label}</div>
                </div>

                <div class="metrics">
                  ${renderTvMetric("Deals", current.closedDeals.toLocaleString("en-US"), "deals")}
                  ${renderTvMetric("Volume", formatCompactCurrency(current.closedVolume, 1), "volume")}
                  ${renderTvMetric("GCI", formatCompactCurrency(current.closedGci, 2), "gci")}
                </div>
              </section>

              <section class="column">
                <div class="column-header">
                  <div class="period">${prior.label}</div>
                </div>

                <div class="metrics">
                  ${renderTvMetric("Deals", prior.closedDeals.toLocaleString("en-US"), "deals")}
                  ${renderTvMetric("Volume", formatCompactCurrency(prior.closedVolume, 1), "volume")}
                  ${renderTvMetric("GCI", formatCompactCurrency(prior.closedGci, 2), "gci")}
                </div>
              </section>
            </section>

            <section class="comparison">
              ${renderComparison("# of Deals vs Prior", comparison.closedDealsPct)}
              ${renderComparison("Volume vs Prior", comparison.closedVolumePct)}
              ${renderComparison("GCI vs Prior", comparison.closedGciPct)}
            </section>
          </main>
        </body>
      </html>
    `);
  } catch (error) {
    res.status(500).send(`
      <h1>Dashboard Error</h1>
      <pre>${error.message}</pre>
    `);
  }
}

function renderTvMetric(label, value, type) {
  return `
    <div class="metric ${type}">
      <div class="value">${value}</div>
      <div class="label">${label}</div>
    </div>
  `;
}

function renderComparison(label, delta) {
  const isValid = typeof delta === "number";
  const isUp = isValid ? delta >= 0 : true;
  const arrow = !isValid ? "—" : isUp ? "▲" : "▼";
  const className = isUp ? "up" : "down";
  const displayValue = !isValid ? "" : `${Math.abs(delta).toFixed(1)}%`;

  return `
    <div class="comparison-card ${className}">
      <div class="comparison-value ${className}">
        ${arrow} ${displayValue}
      </div>
      <div class="comparison-label">${label}</div>
    </div>
  `;
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});