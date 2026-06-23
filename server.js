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

function formatDateRange(start, end) {
  const options = {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Chicago",
  };

  const startDate = new Date(`${start}T12:00:00`);
  const endDate = new Date(`${end}T12:00:00`);

  return `${startDate.toLocaleDateString("en-US", options)} – ${endDate.toLocaleDateString("en-US", options)}`;
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
  try {
    const { generatedAt, current, prior, comparison } = await getDashboardData();

    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Trinity Office Display</title>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta http-equiv="refresh" content="300" />
          <style>
            :root {
              --navy: #15445B;
              --blue: #4E92C7;
              --spring: #BFDBBB;
              --sage: #6E8B7A;
              --bone: #F4F1EC;
              --offwhite: #FEFAF6;
              --black: #02070A;
            }

            * {
              box-sizing: border-box;
            }

            body {
              margin: 0;
              min-height: 100vh;
              background:
                radial-gradient(circle at top right, rgba(78, 146, 199, 0.24), transparent 32%),
                linear-gradient(135deg, #02070A 0%, #061924 45%, #02070A 100%);
              color: var(--bone);
              font-family: Arial, Helvetica, sans-serif;
              overflow: auto;
            }

            .page {
              width: 100%;
              min-height: 100vh;
              padding: clamp(18px, 2.6vw, 44px) clamp(22px, 3.5vw, 56px);
              display: flex;
              flex-direction: column;
              gap: clamp(16px, 2vw, 34px);
            }

            .topbar {
              display: flex;
              align-items: center;
              justify-content: space-between;
              border-bottom: 1px solid rgba(244, 241, 236, 0.35);
              padding-bottom: clamp(14px, 1.8vw, 28px);
              gap: 24px;
            }

            .brand {
              display: flex;
              align-items: center;
              gap: clamp(14px, 1.6vw, 26px);
            }

            .logo-mark {
              width: clamp(52px, 5.4vw, 86px);
              height: clamp(52px, 5.4vw, 86px);
              border: 3px solid var(--blue);
              border-radius: 999px;
              display: flex;
              align-items: center;
              justify-content: center;
              color: var(--blue);
              font-size: clamp(34px, 3.7vw, 58px);
              font-weight: 700;
            }

            .brand-divider {
              width: 2px;
              height: clamp(58px, 6vw, 94px);
              background: linear-gradient(to bottom, var(--blue), var(--spring));
              opacity: 0.8;
            }

            .brand-name {
              font-size: clamp(36px, 4.8vw, 74px);
              letter-spacing: clamp(10px, 1.5vw, 24px);
              font-weight: 500;
              color: var(--bone);
            }

            .updated {
              text-align: right;
              text-transform: uppercase;
              letter-spacing: 3px;
              flex-shrink: 0;
            }

            .updated-label,
            .updated-date {
              color: var(--spring);
              font-size: clamp(13px, 1.2vw, 20px);
              font-weight: 700;
            }

            .updated-time {
              font-size: clamp(24px, 2.4vw, 38px);
              margin-top: 6px;
              color: var(--offwhite);
            }

            .title {
              text-align: center;
              font-size: clamp(32px, 4vw, 56px);
              letter-spacing: clamp(4px, 0.7vw, 9px);
              font-weight: 800;
              color: var(--offwhite);
              text-transform: uppercase;
            }

            .title span {
              color: var(--spring);
            }

            .grid {
              display: grid;
              grid-template-columns: repeat(2, minmax(0, 1fr));
              gap: clamp(18px, 2.2vw, 34px);
              flex: 1;
            }

            .panel {
              border: 1px solid rgba(78, 146, 199, 0.75);
              border-radius: 18px;
              overflow: hidden;
              background: rgba(2, 7, 10, 0.68);
              box-shadow: 0 0 44px rgba(78, 146, 199, 0.14);
            }

            .panel-header {
              background: linear-gradient(90deg, rgba(21, 68, 91, 0.96), rgba(78, 146, 199, 0.72));
              padding: clamp(18px, 1.9vw, 28px) clamp(22px, 2.4vw, 36px);
              text-align: center;
            }

            .period {
              font-size: clamp(32px, 3.6vw, 48px);
              letter-spacing: 4px;
              font-weight: 800;
              color: var(--offwhite);
            }

            .range {
              margin-top: 8px;
              font-size: clamp(14px, 1.4vw, 22px);
              letter-spacing: 3px;
              text-transform: uppercase;
              color: var(--spring);
              font-weight: 700;
            }

            .metrics {
              padding: clamp(12px, 1.7vw, 24px) clamp(20px, 2.4vw, 38px);
            }

            .metric {
              display: grid;
              grid-template-columns: clamp(58px, 6vw, 110px) 1fr clamp(96px, 9vw, 150px);
              align-items: center;
              gap: clamp(12px, 1.5vw, 24px);
              min-height: clamp(96px, 11vh, 150px);
              border-bottom: 1px solid rgba(244, 241, 236, 0.28);
            }

            .metric:last-child {
              border-bottom: none;
            }

            .icon {
              width: clamp(52px, 5.2vw, 82px);
              height: clamp(52px, 5.2vw, 82px);
              border: 3px solid var(--blue);
              border-radius: 999px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: clamp(28px, 3vw, 42px);
              color: var(--blue);
            }

            .metric:nth-child(1) .icon,
            .metric:nth-child(3) .icon {
              border-color: var(--spring);
              color: var(--spring);
            }

            .metric-label {
              color: var(--spring);
              font-size: clamp(15px, 1.45vw, 23px);
              text-transform: uppercase;
              letter-spacing: 3px;
              font-weight: 800;
              margin-bottom: 8px;
            }

            .metric:nth-child(2) .metric-label {
              color: var(--blue);
            }

            .metric-value {
              font-size: clamp(36px, 4.5vw, 64px);
              line-height: 1;
              font-weight: 800;
              color: var(--offwhite);
              text-shadow: 0 3px 12px rgba(0,0,0,0.45);
              white-space: nowrap;
            }

            .delta {
              border-left: 1px solid rgba(244, 241, 236, 0.35);
              padding-left: clamp(12px, 1.5vw, 24px);
              text-align: center;
            }

            .delta-value {
              font-size: clamp(18px, 1.8vw, 29px);
              font-weight: 800;
            }

            .delta-up {
              color: var(--spring);
            }

            .delta-down {
              color: #ff725f;
            }

            .delta-context {
              font-size: clamp(12px, 1vw, 17px);
              margin-top: 5px;
              color: rgba(244, 241, 236, 0.78);
            }

            .prior .metric {
              grid-template-columns: clamp(58px, 6vw, 110px) 1fr;
            }

            .prior .delta {
              display: none;
            }

            .footer {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border: 1px solid rgba(244, 241, 236, 0.35);
              border-radius: 14px;
              padding: clamp(14px, 1.5vw, 22px) clamp(18px, 2vw, 30px);
              color: var(--spring);
              text-transform: uppercase;
              letter-spacing: 4px;
              font-size: clamp(13px, 1.25vw, 20px);
              font-weight: 700;
              gap: 18px;
            }

            .footer-right {
              color: var(--bone);
              text-align: right;
            }

            .footer-right span {
              color: var(--blue);
            }

            @media (max-width: 1050px) {
              .grid {
                grid-template-columns: 1fr;
              }

              .topbar {
                align-items: flex-start;
              }

              .brand-name {
                letter-spacing: 10px;
              }

              .footer {
                flex-direction: column;
                align-items: flex-start;
              }

              .footer-right {
                text-align: left;
              }
            }
          </style>
        </head>

        <body>
          <main class="page">
            <section class="topbar">
              <div class="brand">
                <div class="logo-mark">T</div>
                <div class="brand-divider"></div>
                <div class="brand-name">TRINITY</div>
              </div>

              <div class="updated">
                <div class="updated-label">Last Updated</div>
                <div class="updated-time">
                  ${generatedAt.toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                    timeZone: "America/Chicago",
                  })}
                </div>
                <div class="updated-date">
                  ${generatedAt.toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                    timeZone: "America/Chicago",
                  })}
                </div>
              </div>
            </section>

            <section class="title">
              Year To Date <span>Performance</span>
            </section>

            <section class="grid">
              <section class="panel current">
                <div class="panel-header">
                  <div class="period">${current.label}</div>
                  <div class="range">${formatDateRange(current.start, current.end)}</div>
                </div>

                <div class="metrics">
                  ${renderMetric("👥", "Closed Deals", current.closedDeals.toLocaleString("en-US"), comparison.closedDealsPct)}
                  ${renderMetric("＄", "Closed Volume", formatCompactCurrency(current.closedVolume, 1), comparison.closedVolumePct)}
                  ${renderMetric("T", "Closed GCI", formatCompactCurrency(current.closedGci, 2), comparison.closedGciPct)}
                </div>
              </section>

              <section class="panel prior">
                <div class="panel-header">
                  <div class="period">${prior.label}</div>
                  <div class="range">${formatDateRange(prior.start, prior.end)}</div>
                </div>

                <div class="metrics">
                  ${renderMetric("👥", "Closed Deals", prior.closedDeals.toLocaleString("en-US"), null)}
                  ${renderMetric("＄", "Closed Volume", formatCompactCurrency(prior.closedVolume, 1), null)}
                  ${renderMetric("T", "Closed GCI", formatCompactCurrency(prior.closedGci, 2), null)}
                </div>
              </section>
            </section>

            <section class="footer">
              <div>Data refreshes every 5 minutes</div>
              <div class="footer-right"><span>Better People.</span> Better Service. Better Results.</div>
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
});

function renderMetric(icon, label, value, delta) {
  let deltaHtml = "";

  if (typeof delta === "number") {
    const isUp = delta >= 0;
    const arrow = isUp ? "▲" : "▼";
    const className = isUp ? "delta-up" : "delta-down";

    deltaHtml = `
      <div class="delta">
        <div class="delta-value ${className}">
          ${arrow} ${Math.abs(delta).toFixed(1)}%
        </div>
        <div class="delta-context">vs prior</div>
      </div>
    `;
  }

  return `
    <div class="metric">
      <div class="icon">${icon}</div>
      <div>
        <div class="metric-label">${label}</div>
        <div class="metric-value">${value}</div>
      </div>
      ${deltaHtml}
    </div>
  `;
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});