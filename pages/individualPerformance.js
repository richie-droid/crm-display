function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-US", {
    maximumFractionDigits: 2
  });
}

function renderRankedRows(rows, valueKey, options = {}) {
  const { showValue = true, rankOffset = 0 } = options;

  return rows
    .map((row, index) => {
      const rank = rankOffset + index + 1;
      const agent = escapeHtml(row.agent || "Unknown Agent");
      const value = formatNumber(row[valueKey]);

      return `
        <div class="rank-row">
          <div class="rank">${rank}</div>
          <div class="agent">${agent}</div>
          ${showValue ? `<div class="value">${value}</div>` : ""}
        </div>
      `;
    })
    .join("");
}

function splitIntoColumns(rows) {
  const midpoint = Math.ceil(rows.length / 2);

  return {
    left: rows.slice(0, midpoint),
    right: rows.slice(midpoint),
    rightOffset: midpoint
  };
}

function renderIndividualPerformancePage(data) {
  const calls = data.calls?.allAgents || [];
  const callColumns = splitIntoColumns(calls);

  const acceptedLois = data.acceptedLois?.top10 || [];
  const ytdGci = data.ytdGci?.top10 || [];

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Individual Performance</title>
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
            grid-template-rows: 12.5vh 1fr;
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

          .cards {
            min-height: 0;
            display: grid;
            grid-template-columns: 1.18fr 0.91fr 1fr;
            gap: 2vw;
          }

          .card {
            min-height: 0;
            border: 0.18vh solid rgba(78, 146, 199, 0.85);
            border-radius: 1.8vh;
            background: rgba(2, 7, 10, 0.67);
            box-shadow: 0 0 4.2vh rgba(78, 146, 199, 0.18);
            padding: 2.2vh 1.55vw;
            display: grid;
            grid-template-rows: auto 1fr;
            gap: 1.8vh;
            overflow: hidden;
          }

          .card-title {
            font-size: 4vh;
            line-height: 1.02;
            font-weight: 900;
            letter-spacing: -0.06vw;
            color: var(--offwhite);
          }

          .card-total {
            margin-top: 0.7vh;
            color: var(--spring);
            font-size: 2vh;
            font-weight: 900;
          }

          .rows {
            min-height: 0;
            display: flex;
            flex-direction: column;
            gap: 0.9vh;
          }

          .call-columns {
            min-height: 0;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 1vw;
          }

          .call-column {
            min-height: 0;
            display: flex;
            flex-direction: column;
            gap: 0.75vh;
          }

          .rank-row {
            min-height: 4.4vh;
            display: grid;
            grid-template-columns: 3.2vh minmax(0, 1fr) auto;
            align-items: center;
            gap: 0.75vw;
            padding: 0.72vh 0.75vw;
            border-radius: 1vh;
            background: rgba(244, 241, 236, 0.055);
            border: 0.12vh solid rgba(244, 241, 236, 0.12);
          }

          .rank {
            width: 2.9vh;
            height: 2.9vh;
            border-radius: 999px;
            background: rgba(78, 146, 199, 0.28);
            color: var(--spring);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.7vh;
            font-weight: 900;
          }

          .agent {
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            font-size: 2.15vh;
            font-weight: 900;
            color: var(--offwhite);
          }

          .value {
            font-size: 2.35vh;
            font-weight: 900;
            color: var(--offwhite);
            white-space: nowrap;
          }

          .call-card .agent {
            font-size: 1.85vh;
          }

          .call-card .value {
            font-size: 2.05vh;
          }

          .gci-card .rank-row {
            min-height: 4.25vh;
          }

          .gci-card .agent {
            font-size: 1.95vh;
          }

          .gci-card .value {
            font-size: 1.95vh;
          }

          .loi-card .agent {
            font-size: 2.35vh;
          }

          .empty {
            color: rgba(254, 250, 246, 0.7);
            font-size: 2.4vh;
            font-weight: 700;
            padding: 2vh;
            border-radius: 1.2vh;
            background: rgba(244, 241, 236, 0.055);
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

            <div class="page-title">Individual Performance</div>
          </section>

          <section class="cards">
            <article class="card call-card">
              <div>
                <div class="card-title">Total Calls<br />Last 30 Days</div>
                <div class="card-total">${formatNumber(data.calls?.totalRecords)} total calls</div>
              </div>

              ${
                calls.length
                  ? `
                    <div class="call-columns">
                      <div class="call-column">
                        ${renderRankedRows(callColumns.left, "calls")}
                      </div>
                      <div class="call-column">
                        ${renderRankedRows(callColumns.right, "calls", {
                          rankOffset: callColumns.rightOffset
                        })}
                      </div>
                    </div>
                  `
                  : `<div class="empty">No call activity found.</div>`
              }
            </article>

            <article class="card loi-card">
              <div>
                <div class="card-title">Accepted LOIs<br />Last 30 Days</div>
                <div class="card-total">${formatNumber(data.acceptedLois?.total)} accepted LOIs</div>
              </div>

              <div class="rows">
                ${
                  acceptedLois.length
                    ? renderRankedRows(acceptedLois, "count")
                    : `<div class="empty">No accepted LOIs found.</div>`
                }
              </div>
            </article>

            <article class="card gci-card">
              <div>
                <div class="card-title">Top Producers<br />GCI</div>
                <div class="card-total">${formatNumber(data.ytdGci?.totalRecords)} closed commission records</div>
              </div>

              <div class="rows">
                ${
                  ytdGci.length
                  ? renderRankedRows(ytdGci, "gci", { showValue: false })
                  : `<div class="empty">No YTD GCI found.</div>`
                }
              </div>
            </article>
          </section>
        </main>
      </body>
    </html>
  `;
}

module.exports = {
  renderIndividualPerformancePage
};