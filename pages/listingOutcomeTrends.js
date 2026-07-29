function safeJson(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function renderListingOutcomeTrendsPage(data) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Trinity Listing Outcome Trends</title>

  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js"></script>

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
      min-height: 100%;
      margin: 0;
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
      width: 100%;
      min-height: 100vh;
      padding: 2.5vh 3vw 2.8vh;
      display: flex;
      flex-direction: column;
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

    .methodology {
      padding: 1.2vh 1.3vw;
      border: 0.15vh solid rgba(78, 146, 199, 0.5);
      border-radius: 1.2vh;
      background: rgba(2, 7, 10, 0.54);
      color: rgba(254, 250, 246, 0.72);
      font-size: 1.3vh;
      line-height: 1.5;
    }

    .methodology a {
      color: var(--blue);
    }

    .chart-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 1.6vh 1.3vw;
    }

    .chart-card {
      min-width: 0;
      border: 0.18vh solid rgba(78, 146, 199, 0.85);
      border-radius: 1.8vh;
      background: rgba(2, 7, 10, 0.67);
      box-shadow: 0 0 4.2vh rgba(78, 146, 199, 0.18);
      padding: 1.6vh 1.4vw;
      display: flex;
      flex-direction: column;
      gap: 1vh;
    }

    .chart-title {
      font-size: 1.9vh;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.1vw;
      color: var(--green);
    }

    .chart-wrap {
      position: relative;
      height: 32vh;
    }

    .footer {
      display: grid;
      grid-template-columns: 1fr auto;
      align-items: center;
      color: rgba(254, 250, 246, 0.58);
      font-size: 1.25vh;
      line-height: 1.35;
    }

    .footer a {
      color: var(--blue);
    }

    .generated {
      text-align: right;
      white-space: nowrap;
    }

    @media (max-width: 1000px) {
      .chart-grid {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>

<body>
  <div class="screen">
    <div class="header">
      <div class="brand">
        <div class="logo-mark">T</div>
        <div class="brand-divider"></div>
        <div class="brand-name">TRINITY</div>
      </div>

      <div class="page-title">Listing Outcome Trends</div>
    </div>

    <div class="methodology">
      Each point is a trailing ${data.windowMonths}-month window ending ${data.recencyBufferMonths} months before the labeled quarter date (same methodology as the main cohort tool), recalculated at each quarterly checkpoint from Jul 2023 onward.
      &nbsp;<a href="/listing-outcomes">&larr; Back to Listing Outcomes</a>
    </div>

    <div class="chart-grid">
      <div class="chart-card">
        <div class="chart-title">New Listings Launched</div>
        <div class="chart-wrap"><canvas id="chart-newListings"></canvas></div>
      </div>

      <div class="chart-card">
        <div class="chart-title">Closed</div>
        <div class="chart-wrap"><canvas id="chart-closed"></canvas></div>
      </div>

      <div class="chart-card">
        <div class="chart-title">Close Rate</div>
        <div class="chart-wrap"><canvas id="chart-closeRate"></canvas></div>
      </div>

      <div class="chart-card">
        <div class="chart-title">Avg Days on Market</div>
        <div class="chart-wrap"><canvas id="chart-avgDays"></canvas></div>
      </div>
    </div>

    <div class="footer">
      <div>Quarterly checkpoints from Jul 2023 through the most recent completed quarter.</div>
      <div class="generated">
        Updated ${new Date(data.generatedAt).toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })}
      </div>
    </div>
  </div>

  <script>
    const payload = ${safeJson(data)};

    function quarterLabel(dateValue) {
      const date = new Date(dateValue + "T12:00:00Z");
      return date.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
    }

    function renderLineChart(canvasId, values, formatter) {
      const labels = payload.points.map((point) => quarterLabel(point.checkpoint));

      new Chart(document.getElementById(canvasId), {
        type: "line",
        data: {
          labels,
          datasets: [
            {
              data: values,
              borderColor: "#4E92C7",
              backgroundColor: "rgba(78, 146, 199, 0.12)",
              pointBackgroundColor: "#BFDBBB",
              pointBorderColor: "#BFDBBB",
              fill: true,
              tension: 0.24,
              borderWidth: 3,
              pointRadius: 3,
              pointHoverRadius: 5,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          interaction: { mode: "index", intersect: false },
          plugins: {
            legend: { display: false },
            tooltip: {
              displayColors: false,
              callbacks: {
                label: function (context) {
                  return formatter(context.raw);
                },
              },
            },
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: {
                color: "rgba(254, 250, 246, 0.62)",
                font: { size: 11 },
                maxRotation: 0,
                autoSkip: true,
                maxTicksLimit: 8,
              },
            },
            y: {
              beginAtZero: true,
              grid: { color: "rgba(254, 250, 246, 0.10)" },
              ticks: {
                color: "rgba(254, 250, 246, 0.58)",
                font: { size: 11 },
                callback: function (value) {
                  return formatter(value);
                },
              },
            },
          },
        },
      });
    }

    renderLineChart(
      "chart-newListings",
      payload.points.map((p) => p.totalListings),
      (v) => Number(v).toLocaleString("en-US")
    );

    renderLineChart(
      "chart-closed",
      payload.points.map((p) => p.closed),
      (v) => Number(v).toLocaleString("en-US")
    );

    renderLineChart(
      "chart-closeRate",
      payload.points.map((p) => Math.round(p.closeRate * 1000) / 10),
      (v) => Number(v).toFixed(1) + "%"
    );

    renderLineChart(
      "chart-avgDays",
      payload.points.map((p) => p.averageDaysOnMarket),
      (v) => Number(v).toFixed(1) + " days"
    );
  </script>
</body>
</html>`;
}

module.exports = {
  renderListingOutcomeTrendsPage,
};
