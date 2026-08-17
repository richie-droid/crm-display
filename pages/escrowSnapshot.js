function formatCompactCurrency(value, decimals = 1) {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(decimals)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(decimals)}K`;
  }
  return `$${Number(value).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function renderChangeCell(delta, extraClass = "") {
  const isValid = typeof delta === "number";
  const isUp = isValid ? delta >= 0 : true;
  const arrow = !isValid ? "—" : isUp ? "▲" : "▼";
  const cls = !isValid ? "flat" : isUp ? "up" : "down";
  const text = !isValid ? "" : `${Math.abs(delta).toFixed(1)}%`;
  return `<td class="change ${cls} ${extraClass}">${arrow} ${text}</td>`;
}

function safeJson(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function renderEscrowSnapshotPage(dashboard) {
  const { current, prior, comparison, trend = [] } = dashboard;

  const curDeals = current.deals.toLocaleString("en-US");
  const curGci = formatCompactCurrency(current.gci, 1);
  const priorDeals = prior ? prior.deals.toLocaleString("en-US") : "—";
  const priorGci = prior ? formatCompactCurrency(prior.gci, 1) : "—";

  const priorSub = prior
    ? new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" })
        .format(new Date(`${prior.weekEnding}T00:00:00.000Z`))
    : "no data";

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Trinity Deals In Escrow</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta http-equiv="refresh" content="900" />
        <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js"></script>
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
          * { box-sizing: border-box; }
          html, body {
            margin: 0; width: 100%; height: 100%; overflow: hidden;
            background: #02070A; color: var(--offwhite);
            font-family: Arial, Helvetica, sans-serif;
          }
          body {
            background:
              radial-gradient(circle at 85% 10%, rgba(78, 146, 199, 0.22), transparent 30%),
              radial-gradient(circle at 12% 92%, rgba(191, 219, 187, 0.12), transparent 28%),
              linear-gradient(135deg, #02070A 0%, #061924 48%, #02070A 100%);
          }
          .screen {
            width: 100vw; height: 100vh;
            padding: 3vh 3vw 2.6vh;
            display: grid;
            grid-template-rows: 11vh auto 1fr;
            gap: 2.4vh;
          }

          .header {
            display: grid; grid-template-columns: 1fr auto; align-items: center;
            border-bottom: 0.22vh solid rgba(244, 241, 236, 0.34);
            padding-bottom: 1.8vh;
          }
          .brand { display: flex; align-items: center; gap: 1.35vw; }
          .logo-mark {
            width: 6.6vh; height: 6.6vh; border: 0.34vh solid var(--blue);
            border-radius: 999px; display: flex; align-items: center; justify-content: center;
            color: var(--blue); font-size: 4.4vh; font-weight: 900;
          }
          .brand-divider { width: 0.18vw; height: 8vh; background: linear-gradient(to bottom, var(--blue), var(--spring)); }
          .brand-name { font-size: 5.2vh; letter-spacing: 1.3vw; font-weight: 500; color: var(--bone); white-space: nowrap; }
          .page-title {
            text-align: right; text-transform: uppercase; letter-spacing: 0.5vw;
            font-size: 3.1vh; font-weight: 900; color: var(--spring); white-space: nowrap;
          }

          /* Card (table for clean full-width rules) */
          .card {
            border: 0.18vh solid rgba(78, 146, 199, 0.85);
            border-radius: 1.8vh;
            background: rgba(2, 7, 10, 0.67);
            box-shadow: 0 0 4.2vh rgba(78, 146, 199, 0.18);
            padding: 1.4vh 2vw 1.6vh;
          }
          .card table { width: 100%; border-collapse: collapse; table-layout: fixed; }
          .card col.label-col { width: 26%; }
          .card th, .card td { padding: 0; }
          .card thead th {
            vertical-align: bottom;
            padding-bottom: 1.3vh;
            border-bottom: 0.18vh solid rgba(244, 241, 236, 0.30);
          }
          .card th.col-head {
            text-align: center; text-transform: uppercase; font-weight: 900;
            font-size: 2.2vh; letter-spacing: 0.12vw; color: var(--spring);
          }
          .card th.col-head .sub {
            display: block; font-size: 1.3vh; letter-spacing: 0.06vw;
            color: rgba(254, 250, 246, 0.55); font-weight: 700; margin-top: 0.3vh;
          }
          .card tbody th.row-head {
            text-align: left; text-transform: uppercase; font-weight: 900;
            font-size: 3.6vh; letter-spacing: 0.08vw; color: var(--blue);
            padding: 1.9vh 0;
          }
          .card tbody tr:first-child th, .card tbody tr:first-child td {
            border-bottom: 0.14vh solid rgba(244, 241, 236, 0.16);
          }
          .card td.val {
            text-align: center; vertical-align: middle;
            font-size: 6.6vh; line-height: 0.95; font-weight: 900; color: var(--offwhite);
            letter-spacing: -0.1vw; white-space: nowrap; text-shadow: 0 0.4vh 1.4vh rgba(0,0,0,0.55);
          }
          .card td.change {
            text-align: center; vertical-align: middle;
            font-size: 4.4vh; font-weight: 900; white-space: nowrap;
          }
          .card td.change.up { color: var(--spring); }
          .card td.change.down { color: var(--red); }
          .card td.change.flat { color: rgba(254, 250, 246, 0.5); }

          /* Chart */
          .chart-card {
            min-height: 0;
            border: 0.18vh solid rgba(78, 146, 199, 0.85);
            border-radius: 1.8vh;
            background: rgba(2, 7, 10, 0.67);
            box-shadow: 0 0 4.2vh rgba(78, 146, 199, 0.18);
            padding: 1.4vh 1.6vw 1.6vh;
            display: flex; flex-direction: column; gap: 0.8vh;
          }
          .chart-title {
            font-size: 1.9vh; font-weight: 900; text-transform: uppercase;
            letter-spacing: 0.1vw; color: var(--spring);
          }
          .chart-wrap { position: relative; flex: 1; min-height: 0; }
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
            <div class="page-title">Deals In Escrow</div>
          </section>

          <section class="card">
            <table>
              <colgroup>
                <col class="label-col" />
                <col /><col /><col />
              </colgroup>
              <thead>
                <tr>
                  <th></th>
                  <th class="col-head">Current</th>
                  <th class="col-head">Prior Period<span class="sub">${priorSub}</span></th>
                  <th class="col-head">YoY Change</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th class="row-head">Deals in Escrow</th>
                  <td class="val">${curDeals}</td>
                  <td class="val">${priorDeals}</td>
                  ${renderChangeCell(comparison.dealsPct)}
                </tr>
                <tr>
                  <th class="row-head">GCI</th>
                  <td class="val">${curGci}</td>
                  <td class="val">${priorGci}</td>
                  ${renderChangeCell(comparison.gciPct)}
                </tr>
              </tbody>
            </table>
          </section>

          <section class="chart-card">
            <div class="chart-title">52-Week Trend &mdash; GCI (line) &amp; Deals in Escrow (bars)</div>
            <div class="chart-wrap"><canvas id="escrowTrend"></canvas></div>
          </section>
        </main>

        <script>
          const trend = ${safeJson(trend)};
          const labels = trend.map((p) => {
            const d = new Date(p.weekEnding + "T00:00:00Z");
            return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
          });
          const gci = trend.map((p) => p.gci);
          const deals = trend.map((p) => p.deals);

          new Chart(document.getElementById("escrowTrend"), {
            data: {
              labels,
              datasets: [
                {
                  type: "bar",
                  label: "Deals in Escrow",
                  data: deals,
                  yAxisID: "yCount",
                  backgroundColor: "rgba(78, 146, 199, 0.55)",
                  borderColor: "rgba(78, 146, 199, 0.9)",
                  borderWidth: 1,
                  order: 2,
                },
                {
                  type: "line",
                  label: "Escrow GCI",
                  data: gci,
                  yAxisID: "yGci",
                  borderColor: "#BFDBBB",
                  backgroundColor: "rgba(191, 219, 187, 0.10)",
                  pointBackgroundColor: "#BFDBBB",
                  fill: true,
                  tension: 0.28,
                  borderWidth: 3.5,
                  pointRadius: 0,
                  pointHoverRadius: 5,
                  order: 1,
                },
              ],
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              animation: false,
              interaction: { mode: "index", intersect: false },
              plugins: {
                legend: {
                  display: true,
                  labels: { color: "rgba(254, 250, 246, 0.85)", font: { size: 15, weight: "bold" }, boxWidth: 18, padding: 16 },
                },
                tooltip: {
                  callbacks: {
                    label: function (ctx) {
                      if (ctx.dataset.yAxisID === "yGci") {
                        return "GCI: $" + Math.round(ctx.raw).toLocaleString("en-US");
                      }
                      return "Deals: " + ctx.raw;
                    },
                  },
                },
              },
              scales: {
                x: {
                  grid: { display: false },
                  ticks: { color: "rgba(254, 250, 246, 0.6)", font: { size: 13 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 13 },
                },
                yGci: {
                  position: "left",
                  beginAtZero: true,
                  grid: { color: "rgba(254, 250, 246, 0.08)" },
                  ticks: {
                    color: "#BFDBBB", font: { size: 13 },
                    callback: function (v) { return "$" + (v / 1000000).toFixed(1) + "M"; },
                  },
                },
                yCount: {
                  position: "right",
                  beginAtZero: true,
                  grid: { display: false },
                  ticks: { color: "#4E92C7", font: { size: 13 } },
                },
              },
            },
          });
        </script>
      </body>
    </html>
  `;
}

module.exports = {
  renderEscrowSnapshotPage,
};
