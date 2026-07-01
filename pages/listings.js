function formatCompactCurrency(value, decimals = 1) {
  if (!value) return "N/A";
  if (value >= 1000000) return `$${(value / 1000000).toFixed(decimals)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(decimals)}K`;
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

function formatPercent(value) {
  if (!value) return "N/A";
  return `${(Number(value) * 100).toFixed(2)}%`;
}

function renderListingRows(items, limit = 10) {
  const displayItems = items.slice(0, limit);

  if (!displayItems.length) {
    return `<div class="empty-state">No listings found</div>`;
  }

  return displayItems
    .map((item) => {
      return `
        <div class="listing-row">
          <div class="listing-name">${item.name}</div>
          <div class="listing-meta">
            <span class="meta-broker">${item.listingLeader}</span>
            <span class="meta-separator">•</span>
            <span class="meta-price">${formatCompactCurrency(item.price, 1)}</span>
            <span class="meta-separator">•</span>
            <span class="meta-cap">${formatPercent(item.capRate)}</span>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderListingsPage(dashboard) {
  const { summary, upcomingListings, recentListings } = dashboard;

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Trinity Marketing Snapshot</title>
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
            padding: 2.6vh 3vw 2.6vh;
            display: grid;
            grid-template-rows: 10vh 15.5vh 1fr;
            gap: 2.1vh;
          }

          .header {
            display: grid;
            grid-template-columns: 1fr auto;
            align-items: center;
            border-bottom: 0.22vh solid rgba(244, 241, 236, 0.34);
            padding-bottom: 1.6vh;
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
            background: linear-gradient(to bottom, var(--blue), var(--spring));
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
            color: var(--spring);
            white-space: nowrap;
          }

          .kpi-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 1.7vw;
          }

          .kpi-card,
          .list-card {
            border: 0.18vh solid rgba(78, 146, 199, 0.85);
            border-radius: 1.8vh;
            background: rgba(2, 7, 10, 0.67);
            box-shadow: 0 0 4.2vh rgba(78, 146, 199, 0.18);
            overflow: hidden;
          }

          .kpi-card {
            display: grid;
            place-items: center;
            text-align: center;
            padding: 1.1vh 1vw;
          }

          .kpi-value {
            font-size: 5.25vh;
            line-height: 0.95;
            font-weight: 900;
            color: var(--offwhite);
            white-space: nowrap;
          }

          .kpi-label {
            margin-top: 0.75vh;
            font-size: 1.8vh;
            letter-spacing: 0.19vw;
            font-weight: 900;
            color: var(--spring);
            text-transform: uppercase;
            white-space: nowrap;
          }

          .list-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 2vw;
            min-height: 0;
          }

          .list-card {
            display: grid;
            grid-template-rows: auto 1fr;
            min-height: 0;
          }

          .section-title {
            background: linear-gradient(90deg, rgba(21, 68, 91, 0.95), rgba(78, 146, 199, 0.76));
            text-align: center;
            font-size: 2.5vh;
            letter-spacing: 0.32vw;
            font-weight: 900;
            text-transform: uppercase;
            color: var(--offwhite);
            padding: 1.1vh;
          }

          .listing-list {
            padding: 0.9vh 1.7vw 1vh;
            display: flex;
            flex-direction: column;
            min-height: 0;
            overflow: hidden;
          }

          .listing-row {
            flex: 1;
            min-height: 0;
            display: flex;
            flex-direction: column;
            justify-content: center;
            border-bottom: 0.14vh solid rgba(244, 241, 236, 0.24);
            padding: 0.55vh 0 0.65vh;
          }

          .listing-row:last-child {
            border-bottom: none;
          }

          .listing-name {
            font-size: 1.9vh;
            line-height: 1.08;
            font-weight: 900;
            color: var(--offwhite);
            white-space: normal;
            overflow: hidden;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            margin-bottom: 0.5vh;
          }

          .listing-meta {
            font-size: 1.55vh;
            line-height: 1;
            font-weight: 900;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .meta-broker {
            color: var(--blue);
          }

          .meta-price {
            color: var(--offwhite);
          }

          .meta-cap {
            color: var(--spring);
          }

          .meta-separator {
            color: rgba(78, 146, 199, 0.65);
            padding: 0 0.45vw;
          }

          .empty-state {
            display: grid;
            place-items: center;
            height: 100%;
            color: rgba(244, 241, 236, 0.7);
            font-size: 2.6vh;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.2vw;
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

            <div class="page-title">Marketing Snapshot</div>
          </section>

          <section class="kpi-grid">
            <div class="kpi-card">
              <div>
                <div class="kpi-value">${summary.activeListings.toLocaleString("en-US")}</div>
                <div class="kpi-label">Active Listings</div>
              </div>
            </div>

            <div class="kpi-card">
              <div>
                <div class="kpi-value">${formatCompactCurrency(summary.volume, 1)}</div>
                <div class="kpi-label">Active Volume</div>
              </div>
            </div>

            <div class="kpi-card">
              <div>
                <div class="kpi-value">${formatPercent(summary.avgCapRate)}</div>
                <div class="kpi-label">Avg Cap</div>
              </div>
            </div>

            <div class="kpi-card">
              <div>
                <div class="kpi-value">${summary.upcomingListings.toLocaleString("en-US")}</div>
                <div class="kpi-label">Upcoming Listings</div>
              </div>
            </div>
          </section>

          <section class="list-grid">
            <section class="list-card">
              <div class="section-title">Upcoming Listings</div>
              <div class="listing-list">
                ${renderListingRows(upcomingListings, 10)}
              </div>
            </section>

            <section class="list-card">
              <div class="section-title">Recent Listings</div>
              <div class="listing-list">
                ${renderListingRows(recentListings, 10)}
              </div>
            </section>
          </section>
        </main>
      </body>
    </html>
  `;
}

module.exports = {
  renderListingsPage,
};