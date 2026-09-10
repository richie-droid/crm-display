function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function number(value) {
  return Number(value || 0).toLocaleString("en-US");
}

function dateLabel(value) {
  const [year, month, day] = String(value).split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function rankCard(agent) {
  return `<div class="rank-card">
    <strong>${escapeHtml(agent.displayName)}</strong>
    <span>${number(agent.totalPoints)}</span>
  </div>`;
}

function rankGroup(label, agents, tone) {
  const cards = agents.length
    ? agents.map(rankCard).join("")
    : `<div class="rank-card empty"><strong>Not available yet</strong></div>`;

  return `<div class="rank-group ${tone}">
    <div class="rank-group-label">${label}</div>
    <div class="rank-cards">${cards}</div>
  </div>`;
}

function renderHomeStretchPage(data) {
  const cards = data.teams
    .map((team) => {
      const members = team.agents
        .map((agent) => {
          const handicapTag = agent.handicap !== 1 ? ` (${Math.round(agent.handicap * 100)}%)` : "";
          return `${escapeHtml(agent.displayName)}${handicapTag}`;
        })
        .join(" · ");

      return `<article class="team-card">
        <div class="team-head">
          <span class="rank">#${team.rank}</span>
          <h2>${escapeHtml(team.team)}</h2>
        </div>

        <div class="members">${members}</div>

        <div class="metrics">
          <div>
            <span>Total Points</span>
            <strong>${number(team.totalPoints)}</strong>
          </div>
        </div>
      </article>`;
    })
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta http-equiv="refresh" content="900" />
  <title>${escapeHtml(data.title)}</title>

  <style>
    :root {
      color-scheme: dark;
      --navy: #15445b;
      --blue: #4e92c7;
      --green: #bfdbbb;
      --bone: #f4f1ec;
      --white: #fefaf6;
      --black: #02070a;
      --panel: #102331;
      --panel2: #132b3b;
      --line: #294457;
      --muted: #9fb1bf;
      --good: #65d18a;
      --bad: #ff7d7d;
      --gold: #e0b95a;
    }

    * { box-sizing: border-box; }

    html, body {
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
        linear-gradient(135deg, #02070a 0%, #061924 48%, #02070a 100%);
    }

    .screen {
      width: 100vw;
      height: 100vh;
      padding: 2vh 3vw;
      display: grid;
      grid-template-rows: 8vh 11vh 1fr 20vh 3vh;
      gap: 1vh;
    }

    .header {
      display: grid;
      grid-template-columns: 1fr auto;
      align-items: center;
      padding-bottom: 1vh;
      border-bottom: 0.22vh solid rgba(244, 241, 236, 0.34);
    }

    .brand { display: flex; align-items: center; gap: 1.2vw; }

    .logo-mark {
      width: 5.9vh;
      height: 5.9vh;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 0.32vh solid var(--blue);
      border-radius: 999px;
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
      color: var(--bone);
      font-size: 4.6vh;
      font-weight: 500;
      letter-spacing: 1.25vw;
      white-space: nowrap;
    }

    .page-title {
      color: var(--green);
      font-size: 2.75vh;
      font-weight: 900;
      letter-spacing: 0.5vw;
      text-align: right;
      text-transform: uppercase;
      white-space: nowrap;
    }

    .rank-strip {
      display: grid;
      grid-template-columns: 1fr;
      align-items: stretch;
      min-height: 0;
    }

    .rank-group { display: flex; flex-direction: column; }

    .rank-group-label {
      margin-bottom: 0.5vh;
      text-align: center;
      font-size: 1.4vh;
      font-weight: 900;
      letter-spacing: 0.14vw;
      text-transform: uppercase;
    }

    .rank-group.top .rank-group-label { color: var(--good); }

    .rank-cards {
      flex: 1;
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 1vw;
    }

    .rank-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.4vh;
      padding: 1vh 1.2vw;
      border: 0.16vh solid var(--line);
      border-radius: 1.4vh;
      text-align: center;
      background: linear-gradient(135deg, rgba(19, 43, 59, 0.96), rgba(16, 35, 49, 0.96));
    }

    .rank-group.top .rank-card { border-left: 0.3vw solid var(--good); }

    .rank-card strong { font-size: 1.9vh; line-height: 1.1; }
    .rank-card span { font-size: 2.3vh; font-weight: 900; color: var(--white); }

    .team-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      grid-template-rows: repeat(2, minmax(0, 1fr));
      gap: 1vh 1vw;
      min-height: 0;
    }

    .team-card {
      position: relative;
      min-width: 0;
      min-height: 0;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      padding: 1.6vh 1.1vw;
      border: 0.16vh solid var(--line);
      border-radius: 1.5vh;
      background: linear-gradient(150deg, rgba(20, 47, 63, 0.97), rgba(10, 28, 39, 0.98));
      box-shadow: 0 1.4vh 3vh rgba(0, 0, 0, 0.18);
    }

    .team-head {
      display: flex;
      align-items: center;
      gap: 0.55vw;
    }

    .rank { color: var(--gold); font-size: 1.9vh; font-weight: 900; }

    .team-card h2 { margin: 0; font-size: 2.8vh; line-height: 1.05; }

    .members {
      min-height: 5.5vh;
      margin: 1.15vh 0;
      padding-right: 0.3vw;
      color: var(--muted);
      font-size: 1.4vh;
      line-height: 1.4;
    }

    .metrics {
      display: grid;
      grid-template-columns: 1fr;
      gap: 0.55vw;
      margin-top: auto;
    }

    .metrics div {
      padding: 1.1vh 0.65vw;
      border: 0.14vh solid rgba(70, 106, 128, 0.35);
      border-radius: 0.9vh;
      background: rgba(4, 15, 23, 0.45);
    }

    .metrics span {
      display: block;
      color: var(--muted);
      font-size: 1.15vh;
      font-weight: 800;
      letter-spacing: 0.04vw;
      text-transform: uppercase;
    }

    .metrics strong {
      display: block;
      margin-top: 0.5vh;
      font-size: 3vh;
      color: var(--gold);
    }

    .info-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 1vw;
      min-height: 0;
    }

    .info-card {
      grid-column: span 2;
      min-height: 0;
      overflow: hidden;
      padding: 1.4vh 1.35vw;
      border: 0.16vh solid var(--line);
      border-radius: 1.5vh;
      background: linear-gradient(150deg, rgba(20, 47, 63, 0.94), rgba(10, 28, 39, 0.97));
    }

    .info-card h3 {
      margin: 0 0 1vh;
      color: var(--green);
      font-size: 2.2vh;
      line-height: 1.05;
      letter-spacing: 0.03vw;
      text-transform: uppercase;
    }

    .structure-list {
      margin: 0;
      padding-left: 1.3vw;
      color: var(--white);
      font-size: 1.5vh;
      line-height: 1.32;
    }

    .structure-list li + li { margin-top: 0.3vh; }

    .fine-print {
      margin-top: 0.8vh;
      color: var(--muted);
      font-size: 1.05vh;
      font-style: italic;
      line-height: 1.3;
    }

    .scoring-grid {
      display: grid;
      grid-template-columns: repeat(6, minmax(0, 1fr));
      gap: 0.5vw;
    }

    .scoring-item {
      min-width: 0;
      padding: 0.85vh 0.4vw;
      border: 0.14vh solid rgba(70, 106, 128, 0.4);
      border-radius: 0.9vh;
      background: rgba(4, 15, 23, 0.48);
      text-align: center;
    }

    .scoring-item span {
      display: block;
      min-height: 2.1vh;
      color: var(--muted);
      font-size: 0.95vh;
      font-weight: 800;
      line-height: 1.1;
      letter-spacing: 0.02vw;
      text-transform: uppercase;
    }

    .scoring-item strong {
      display: block;
      margin-top: 0.5vh;
      color: var(--white);
      font-size: 1.85vh;
      line-height: 1;
    }

    .footer {
      display: grid;
      grid-template-columns: 1fr auto;
      align-items: center;
      gap: 1vw;
      min-height: 0;
      color: rgba(254, 250, 246, 0.58);
      font-size: 1.1vh;
      line-height: 1.35;
    }

    .footer-links { white-space: nowrap; }
    .footer-links a { margin-left: 0.8vw; color: var(--blue); text-decoration: none; }

    @media (max-width: 1200px) {
      .team-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .info-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .info-card { grid-column: span 1; }
      .scoring-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
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

      <div class="page-title">${escapeHtml(data.title)}</div>
    </section>

    <section class="rank-strip">
      ${rankGroup("Top 5", data.topBottomAgents?.top5 || [], "top")}
    </section>

    <section class="team-grid">
      ${cards}
    </section>

    <section class="info-grid">
      <article class="info-card">
        <h3>Competition Structure</h3>

        <ul class="structure-list">
          <li>
            <strong>Challenge Period:</strong>
            ${escapeHtml(dateLabel(data.window.start))} - ${escapeHtml(dateLabel(data.window.end))}
          </li>

          <li>
            Standings/Winner determined by highest total points &mdash; no baseline, no growth rate.
          </li>

          <li>
            Cody and Matt play at a handicap (75% / 90% of face value) to keep squads even.
          </li>

          <li>
            <strong>Prize:</strong>
            Winning Team gets 4 tickets to a Stars game!
          </li>
        </ul>

        <div class="fine-print">Reward for non-local winners will be determined individually.</div>
      </article>

      <article class="info-card">
        <h3>Scoring Matrix</h3>

        <div class="scoring-grid">
          <div class="scoring-item">
            <span>Calls</span>
            <strong>1</strong>
          </div>

          <div class="scoring-item">
            <span>Proposals</span>
            <strong>200</strong>
          </div>

          <div class="scoring-item">
            <span>Submitted LOI</span>
            <strong>200</strong>
          </div>

          <div class="scoring-item">
            <span>Listings</span>
            <strong>2,000</strong>
          </div>

          <div class="scoring-item">
            <span>Accepted LOI</span>
            <strong>3,000</strong>
          </div>

          <div class="scoring-item">
            <span>Contracts</span>
            <strong>5,000</strong>
          </div>
        </div>
      </article>
    </section>

    <section class="footer">
      <span></span>

      <span class="footer-links">
        <a href="/home-stretch/verification">Verification</a>
        <a href="/home-stretch/admin">Call Admin</a>
      </span>
    </section>
  </main>
</body>
</html>`;
}

module.exports = {
  renderHomeStretchPage,
};
