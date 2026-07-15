function safeJson(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function renderMarketStatisticsPage(data) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1"
  />
  <meta http-equiv="refresh" content="900" />

  <title>Trinity Market Statistics</title>

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
      height: 100%;
      margin: 0;
      overflow: hidden;
      background: var(--black);
      color: var(--white);
      font-family: Arial, Helvetica, sans-serif;
    }

    body {
      background:
        radial-gradient(
          circle at 85% 10%,
          rgba(78, 146, 199, 0.22),
          transparent 30%
        ),
        radial-gradient(
          circle at 12% 92%,
          rgba(191, 219, 187, 0.12),
          transparent 28%
        ),
        linear-gradient(
          135deg,
          #02070A 0%,
          #061924 48%,
          #02070A 100%
        );
    }

    .screen {
      width: 100vw;
      height: 100vh;
      padding: 2.4vh 3vw;
      display: grid;
      grid-template-rows: 10vh 1fr;
      gap: 1.9vh;
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
      background:
        linear-gradient(
          to bottom,
          var(--blue),
          var(--green)
        );
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

    .cards {
      min-height: 0;
      display: grid;
      grid-template-rows: repeat(3, minmax(0, 1fr));
      gap: 1.6vh;
    }

    .card {
      min-width: 0;
      min-height: 0;
      display: grid;
      grid-template-columns: 29% 71%;
      border: 0.18vh solid rgba(78, 146, 199, 0.85);
      border-radius: 1.8vh;
      background: rgba(2, 7, 10, 0.67);
      box-shadow: 0 0 4.2vh rgba(78, 146, 199, 0.18);
      overflow: hidden;
    }

    .metric-panel {
      min-width: 0;
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: 2.1vh 2vw;
      border-right: 0.12vh solid rgba(78, 146, 199, 0.34);
      background:
        linear-gradient(
          135deg,
          rgba(21, 68, 91, 0.36),
          rgba(2, 7, 10, 0.08)
        );
    }

    .label {
      font-size: 2.1vh;
      line-height: 1.2;
      letter-spacing: 0.16vw;
      text-transform: uppercase;
      color: var(--green);
      font-weight: 900;
    }

    .value {
      margin-top: 1.2vh;
      font-size: 6.8vh;
      line-height: 0.95;
      font-weight: 900;
      color: var(--white);
      white-space: nowrap;
    }

    .date {
      margin-top: 1.2vh;
      font-size: 1.45vh;
      color: rgba(254, 250, 246, 0.68);
      letter-spacing: 0.07vw;
    }

    .chart-panel {
      min-width: 0;
      min-height: 0;
      display: grid;
      grid-template-rows: auto 1fr;
      padding: 1.35vh 1.4vw 0.8vh;
    }

    .chart-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      min-height: 2.8vh;
      margin-bottom: 0.2vh;
    }

    .chart-title {
      font-size: 1.35vh;
      letter-spacing: 0.13vw;
      text-transform: uppercase;
      color: rgba(254, 250, 246, 0.62);
      font-weight: 800;
    }

    .chart-range {
      font-size: 1.25vh;
      letter-spacing: 0.08vw;
      color: rgba(191, 219, 187, 0.76);
    }

    .chart-wrap {
      position: relative;
      min-width: 0;
      min-height: 0;
    }

    .missing {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      color: rgba(254, 250, 246, 0.5);
      font-size: 1.7vh;
      text-align: center;
    }

    canvas {
      width: 100% !important;
      height: 100% !important;
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

      <div class="page-title">
        Market Statistics
      </div>
    </div>

    <main class="cards">
      <section class="card">
        <div class="metric-panel">
          <div class="label">
            Current Listings on Crexi
          </div>

          <div
            class="value"
            id="crexi-value"
          >
            —
          </div>

          <div
            class="date"
            id="crexi-date"
          >
            No successful pull yet
          </div>
        </div>

        <div class="chart-panel">
          <div class="chart-header">
            <div class="chart-title">
              Listing Inventory Trend
            </div>

            <div class="chart-range">
              Last 90 Days
            </div>
          </div>

          <div class="chart-wrap">
            <canvas id="crexi-chart"></canvas>

            <div
              class="missing"
              id="crexi-missing"
            >
              History begins after the first successful pull
            </div>
          </div>
        </div>
      </section>

      <section class="card">
        <div class="metric-panel">
          <div class="label">
            Trinity Current Listings
          </div>

          <div
            class="value"
            id="trinity-value"
          >
            —
          </div>

          <div
            class="date"
            id="trinity-date"
          >
            No successful pull yet
          </div>
        </div>

        <div class="chart-panel">
          <div class="chart-header">
            <div class="chart-title">
              Trinity Listing Trend
            </div>

            <div class="chart-range">
              Last 90 Days
            </div>
          </div>

          <div class="chart-wrap">
            <canvas id="trinity-chart"></canvas>

            <div
              class="missing"
              id="trinity-missing"
            >
              History begins after the first successful pull
            </div>
          </div>
        </div>
      </section>

      <section class="card">
        <div class="metric-panel">
          <div class="label">
            5-Year Treasury
          </div>

          <div
            class="value"
            id="treasury-value"
          >
            —
          </div>

          <div
            class="date"
            id="treasury-date"
          >
            No successful pull yet
          </div>
        </div>

        <div class="chart-panel">
          <div class="chart-header">
            <div class="chart-title">
              Treasury Yield Trend
            </div>

            <div class="chart-range">
              Last 90 Days
            </div>
          </div>

          <div class="chart-wrap">
            <canvas id="treasury-chart"></canvas>

            <div
              class="missing"
              id="treasury-missing"
            >
              History begins after the first successful pull
            </div>
          </div>
        </div>
      </section>
    </main>
  </div>

  <script>
    const payload = ${safeJson(data)};

    function formatDate(value) {
      if (!value) {
        return "No successful pull yet";
      }

      return (
        "Updated " +
        new Date(value).toLocaleDateString(
          "en-US",
          {
            month: "short",
            day: "numeric",
            year: "numeric",
          }
        )
      );
    }

    function getMonthLabel(dateValue, previousDateValue) {
      const date = new Date(dateValue);

      if (!previousDateValue) {
        return date.toLocaleDateString(
          "en-US",
          {
            month: "short",
            year: "numeric",
          }
        );
      }

      const previousDate = new Date(previousDateValue);

      const monthChanged =
        date.getMonth() !== previousDate.getMonth();

      const yearChanged =
        date.getFullYear() !== previousDate.getFullYear();

      if (!monthChanged && !yearChanged) {
        return "";
      }

      if (yearChanged) {
        return date.toLocaleDateString(
          "en-US",
          {
            month: "short",
            year: "numeric",
          }
        );
      }

      return date.toLocaleDateString(
        "en-US",
        {
          month: "short",
        }
      );
    }

    function renderMetric(
      name,
      metric,
      formatter,
      valueSuffix
    ) {
      const latest = metric.latest;
      const history = metric.history || [];

      document.getElementById(
        name + "-value"
      ).textContent = latest
        ? formatter(latest.value)
        : "—";

      document.getElementById(
        name + "-date"
      ).textContent = formatDate(
        latest && latest.capturedAt
      );

      if (
        !history.length ||
        typeof Chart === "undefined"
      ) {
        return;
      }

      document.getElementById(
        name + "-missing"
      ).style.display = "none";

      const labels = history.map(
        (item, index) =>
          getMonthLabel(
            item.capturedAt,
            index > 0
              ? history[index - 1].capturedAt
              : null
          )
      );

      const pointRadii = history.map(
        (item, index) =>
          index === history.length - 1 ? 4 : 0
      );

      const pointHoverRadii = history.map(
        (item, index) =>
          index === history.length - 1 ? 6 : 4
      );

      new Chart(
        document.getElementById(
          name + "-chart"
        ),
        {
          type: "line",

          data: {
            labels,

            datasets: [
              {
                data: history.map(
                  (item) => item.value
                ),

                borderColor: "#4E92C7",

                backgroundColor:
                  "rgba(78, 146, 199, 0.12)",

                pointBackgroundColor:
                  "#BFDBBB",

                pointBorderColor:
                  "#BFDBBB",

                fill: true,
                tension: 0.24,
                borderWidth: 3,
                pointRadius: pointRadii,
                pointHoverRadius: pointHoverRadii,
              },
            ],
          },

          options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,

            interaction: {
              mode: "index",
              intersect: false,
            },

            layout: {
              padding: {
                top: 4,
                right: 10,
                bottom: 0,
                left: 0,
              },
            },

            plugins: {
              legend: {
                display: false,
              },

              tooltip: {
                displayColors: false,

                callbacks: {
                  title: function(context) {
                    const index =
                      context[0].dataIndex;

                    return new Date(
                      history[index].capturedAt
                    ).toLocaleDateString(
                      "en-US",
                      {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      }
                    );
                  },

                  label: function(context) {
                    return (
                      formatter(context.raw) +
                      (valueSuffix || "")
                    );
                  },
                },
              },
            },

            scales: {
              x: {
                border: {
                  display: false,
                },

                grid: {
                  display: false,
                },

                ticks: {
                  color:
                    "rgba(254, 250, 246, 0.62)",

                  font: {
                    size: 13,
                    weight: "600",
                  },

                  autoSkip: false,
                  maxRotation: 0,
                  minRotation: 0,
                  padding: 8,
                },
              },

              y: {
                border: {
                  display: false,
                },

                beginAtZero: false,

                grace: "8%",

                grid: {
                  color:
                    "rgba(254, 250, 246, 0.10)",
                },

                ticks: {
                  color:
                    "rgba(254, 250, 246, 0.58)",

                  maxTicksLimit: 4,

                  font: {
                    size: 12,
                  },

                  callback: function(value) {
                    if (name === "treasury") {
                      return (
                        Number(value).toFixed(2) +
                        "%"
                      );
                    }

                    return Number(
                      value
                    ).toLocaleString("en-US");
                  },
                },
              },
            },
          },
        }
      );
    }

    renderMetric(
      "crexi",
      payload.metrics.crexi,
      function(value) {
        return Number(value).toLocaleString(
          "en-US"
        );
      }
    );

    renderMetric(
      "trinity",
      payload.metrics.trinity,
      function(value) {
        return Number(value).toLocaleString(
          "en-US"
        );
      }
    );

    renderMetric(
      "treasury",
      payload.metrics.treasury,
      function(value) {
        return Number(value).toFixed(2) + "%";
      }
    );
  </script>
</body>
</html>`;
}

module.exports = {
  renderMarketStatisticsPage,
};