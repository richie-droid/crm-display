function formatCount(value) {
  return Number(value || 0).toLocaleString("en-US");
}

function formatRate(value) {
  return `${(Number(value || 0) * 100).toFixed(1)}%`;
}

function formatDays(value) {
  const numeric = Number(value || 0);
  return `${numeric.toFixed(1)} Days`;
}

function formatSigned(value, decimals = 1, suffix = "") {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) {
    return "N/A";
  }

  const numeric = Number(value);
  const sign = numeric > 0 ? "+" : "";
  return `${sign}${numeric.toFixed(decimals)}${suffix}`;
}

function renderMetricCard({
  label,
  currentValue,
  priorValue,
  changeValue,
  changeLabel,
}) {
  return `
    <section class="metric-card">
      <div class="metric-label">${label}</div>
      <div class="metric-current">${currentValue}</div>

      <div class="comparison-row">
        <div>
          <div class="comparison-caption">Prior Cohort</div>
          <div class="comparison-value">${priorValue}</div>
        </div>

        <div class="change-block">
          <div class="comparison-caption">${changeLabel}</div>
          <div class="change-value">${changeValue}</div>
        </div>
      </div>
    </section>
  `;
}

function renderListingOutcomesPage(data) {
  const { current, prior, comparison } = data;

  const cards = [
    {
      label: "New Listings Launched",
      currentValue: formatCount(current.totalListings),
      priorValue: formatCount(prior.totalListings),
      changeValue: formatSigned(
        comparison.totalListingsPct,
        1,
        "%"
      ),
      changeLabel: "YoY Change",
    },
    {
      label: "Closed",
      currentValue: formatCount(current.closed),
      priorValue: formatCount(prior.closed),
      changeValue: formatSigned(
        comparison.closedPct,
        1,
        "%"
      ),
      changeLabel: "YoY Change",
    },
    {
      label: "Still Available",
      currentValue: formatCount(current.available),
      priorValue: formatCount(prior.available),
      changeValue: formatSigned(
        comparison.availablePct,
        1,
        "%"
      ),
      changeLabel: "YoY Change",
    },
    {
      label: "Close Rate",
      currentValue: formatRate(current.closeRate),
      priorValue: formatRate(prior.closeRate),
      changeValue: formatSigned(
        comparison.closeRatePoints,
        1,
        " pts"
      ),
      changeLabel: "Point Change",
    },
    {
      label: "Avg Days on Market",
      currentValue: formatDays(
        current.averageDaysOnMarket
      ),
      priorValue: formatDays(
        prior.averageDaysOnMarket
      ),
      changeValue: formatSigned(
        comparison.averageDaysChange,
        1,
        " days"
      ),
      changeLabel: "Day Change",
    },
  ];

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="refresh" content="900" />
  <title>Trinity Listing Outcomes</title>

  <style>
    :root {
      --navy: #15445B;
      --blue: #4E92C7;
      --green: #BFDBBB;
      --bone: #F4F1EC;
      --white: #FEFAF6;
      --black: #02070A;
    }

    * {
      box-sizing: border-box;
    }

    html,
    body {
      width: 100%;
      height: 100%;
      margin: 0;
      overflow: hidden;
      background: var(--black);
      color: var(--white);
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
      padding: 2.5vh 3vw 2.8vh;
      display: grid;
      grid-template-rows: 10vh 8vh 1fr 7vh;
      gap: 2vh;
    }

    .header {
      display: grid;
      grid-template-columns: 1fr auto;
      align-items: center;
      border-bottom: 0.22vh solid rgba(244, 241, 236, 0.34);
      padding-bottom: 1.5vh;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 1.2vw;
    }

    .logo-mark {
      width: 5.9vh;
      height: 5.9vh;
      border: 0.32vh solid var(--blue);
      border-radius: 999px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--blue);
      font-size: 4vh;
      font-weight: 900;
    }

    .brand-divider {
      width: 0.16vw;
      height: 7vh;
      background: linear-gradient(to bottom, var(--blue), var(--green));
    }

    .brand-name {
      font-size: 4.6vh;
      letter-spacing: 1.25vw;
      font-weight: 500;
      color: var(--bone);
      white-space: nowrap;
    }

    .page-title {
      text-align: right;
      text-transform: uppercase;
      letter-spacing: 0.5vw;
      font-size: 2.75vh;
      font-weight: 900;
      color: var(--green);
      white-space: nowrap;
    }

    .period-bar {
      display: grid;
      grid-template-columns: 1fr 1fr auto;
      gap: 1.5vw;
      align-items: center;
      padding: 0 1.3vw;
      border: 0.15vh solid rgba(78, 146, 199, 0.5);
      border-radius: 1.2vh;
      background: rgba(2, 7, 10, 0.54);
    }

    .period-group {
      min-width: 0;
    }

    .period-label {
      color: var(--green);
      font-size: 1.25vh;
      font-weight: 900;
      letter-spacing: 0.14vw;
      text-transform: uppercase;
    }

    .period-value {
      margin-top: 0.45vh;
      color: var(--white);
      font-size: 1.75vh;
      font-weight: 800;
      white-space: nowrap;
    }

    .data-through {
      text-align: right;
      color: rgba(254, 250, 246, 0.64);
      font-size: 1.35vh;
      letter-spacing: 0.08vw;
      white-space: nowrap;
    }

    .metric-grid {
      min-height: 0;
      display: grid;
      grid-template-columns: repeat(6, minmax(0, 1fr));
      grid-template-rows: repeat(2, minmax(0, 1fr));
      gap: 1.5vh 1.35vw;
    }

    .metric-card:nth-child(1),
    .metric-card:nth-child(2),
    .metric-card:nth-child(3) {
      grid-column: span 2;
    }

    .metric-card:nth-child(4),
    .metric-card:nth-child(5) {
      grid-column: span 3;
    }

    .metric-card {
      min-width: 0;
      min-height: 0;
      display: grid;
      grid-template-rows: auto 1fr auto;
      align-items: center;
      padding: 1.6vh 1.5vw 1.4vh;
      border: 0.18vh solid rgba(78, 146, 199, 0.85);
      border-radius: 1.8vh;
      background:
        linear-gradient(160deg, rgba(21, 68, 91, 0.34), rgba(2, 7, 10, 0.76));
      box-shadow: 0 0 4.2vh rgba(78, 146, 199, 0.18);
      overflow: hidden;
    }

    .metric-label {
      min-height: 3.5vh;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      text-transform: uppercase;
      color: var(--green);
      font-size: 1.7vh;
      line-height: 1.15;
      font-weight: 900;
      letter-spacing: 0.15vw;
    }

    .metric-current {
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      color: var(--white);
      font-size: clamp(4.4vh, 4.4vw, 6.8vh);
      line-height: 0.95;
      font-weight: 900;
      white-space: nowrap;
    }

    .comparison-row {
      width: 100%;
      min-height: 6.8vh;
      display: grid;
      grid-template-columns: 1fr 1fr;
      align-items: center;
      border-top: 0.14vh solid rgba(244, 241, 236, 0.24);
      padding-top: 1.05vh;
    }

    .change-block {
      text-align: right;
      border-left: 0.12vh solid rgba(78, 146, 199, 0.32);
      padding-left: 0.8vw;
    }

    .comparison-caption {
      color: rgba(254, 250, 246, 0.55);
      font-size: 1.05vh;
      font-weight: 800;
      letter-spacing: 0.09vw;
      text-transform: uppercase;
    }

    .comparison-value,
    .change-value {
      margin-top: 0.4vh;
      color: var(--blue);
      font-size: 1.95vh;
      font-weight: 900;
      white-space: nowrap;
    }

    .change-value {
      color: var(--green);
    }

    .footer {
      display: grid;
      grid-template-columns: 1fr auto;
      align-items: center;
      color: rgba(254, 250, 246, 0.58);
      font-size: 1.25vh;
      line-height: 1.35;
      letter-spacing: 0.04vw;
    }

    .footer strong {
      color: rgba(191, 219, 187, 0.82);
    }

    .generated {
      text-align: right;
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

      <div class="page-title">Listing Outcomes</div>
    </section>

    <section class="period-bar">
      <div class="period-group">
        <div class="period-label">Current Listing Cohort</div>
        <div class="period-value">${current.display}</div>
      </div>

      <div class="period-group">
        <div class="period-label">Prior-Year Cohort</div>
        <div class="period-value">${prior.display}</div>
      </div>

      <div class="data-through">
        Outcomes measured through ${new Date(
          `${data.dataThrough}T12:00:00Z`
        ).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          timeZone: "UTC",
        })}
      </div>
    </section>

    <section class="metric-grid">
      ${cards.map(renderMetricCard).join("")}
    </section>

    <section class="footer">
      <div>
        <strong>Available</strong> means the listing has no qualifying close record and currently has an open On-Market stage. Average days on market includes closed listings only.
      </div>

      <div class="generated">
        Updated ${new Date(data.generatedAt).toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })}
      </div>
    </section>
  </main>
</body>
</html>`;
}

module.exports = {
  renderListingOutcomesPage,
};
