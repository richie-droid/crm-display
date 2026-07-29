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

function pace(value) {
  if (value === null || !Number.isFinite(value)) return "N/A";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function rankCard(agent) {
  return `<div class="rank-card">
    <strong>${escapeHtml(agent.displayName)}</strong>
    <span>${number(agent.period2Points)}</span>
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

function renderPipelineGrowthChallengePage(data) {
  const cards = data.teams
    .map((team) => {
      const members = team.agents
        .map((agent) => escapeHtml(agent.displayName))
        .join(" · ");

      const paceClass =
        team.growthPct === null
          ? "neutral"
          : team.growthPct >= 0
            ? "positive"
            : "negative";

      return `<article class="team-card">
        <div class="baseline-chip">
          <span>Baseline</span>
          <strong>${number(team.period1FullPoints)}</strong>
        </div>

        <div class="team-head">
          <span class="rank">#${team.rank}</span>
          <h2>${escapeHtml(team.team)}</h2>
        </div>

        <div class="members">${members}</div>

        <div class="metrics">
          <div>
            <span>Current Points</span>
            <strong>${number(team.period2Points)}</strong>
          </div>

          <div>
            <span>Previous Points</span>
            <strong>${number(team.period1Points)}</strong>
          </div>
        </div>

        <div class="pace ${paceClass}">
          <span>Current Pace</span>
          <strong>${pace(team.growthPct)}</strong>
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
          #02070a 0%,
          #061924 48%,
          #02070a 100%
        );
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

    .brand {
      display: flex;
      align-items: center;
      gap: 1.2vw;
    }

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
      background: linear-gradient(
        to bottom,
        var(--blue),
        var(--green)
      );
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
      grid-template-columns: 1fr auto 1fr;
      align-items: stretch;
      gap: 1.2vw;
      min-height: 0;
    }

    .rank-group {
      display: flex;
      flex-direction: column;
    }

    .rank-group-label {
      margin-bottom: 0.5vh;
      text-align: center;
      font-size: 1.4vh;
      font-weight: 900;
      letter-spacing: 0.14vw;
      text-transform: uppercase;
    }

    .rank-group.top .rank-group-label {
      color: var(--good);
    }

    .rank-group.bottom .rank-group-label {
      color: var(--bad);
    }

    .rank-cards {
      flex: 1;
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
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
      background:
        linear-gradient(
          135deg,
          rgba(19, 43, 59, 0.96),
          rgba(16, 35, 49, 0.96)
        );
    }

    .rank-group.top .rank-card {
      border-left: 0.3vw solid var(--good);
    }

    .rank-group.bottom .rank-card {
      border-left: 0.3vw solid var(--bad);
    }

    .rank-card strong {
      font-size: 1.9vh;
      line-height: 1.1;
    }

    .rank-card span {
      font-size: 2.3vh;
      font-weight: 900;
      color: var(--white);
    }

    .rank-divider {
      width: 0.16vw;
      align-self: stretch;
      margin-top: 2.1vh;
      background: var(--line);
    }

    .team-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
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
      background:
        linear-gradient(
          150deg,
          rgba(20, 47, 63, 0.97),
          rgba(10, 28, 39, 0.98)
        );
      box-shadow: 0 1.4vh 3vh rgba(0, 0, 0, 0.18);
    }

    .team-head {
      display: flex;
      align-items: center;
      gap: 0.55vw;
      max-width: calc(100% - 7.2vw);
    }

    .rank {
      color: var(--gold);
      font-size: 1.65vh;
      font-weight: 900;
    }

    .team-card h2 {
      margin: 0;
      font-size: 2.45vh;
      line-height: 1.05;
    }

    .baseline-chip {
      position: absolute;
      top: 1.2vh;
      right: 0.8vw;
      min-width: 6.6vw;
      padding: 0.8vh 0.65vw;
      border: 0.14vh solid rgba(224, 185, 90, 0.45);
      border-radius: 0.9vh;
      background: rgba(55, 45, 17, 0.52);
      text-align: right;
    }

    .baseline-chip span,
    .metrics span,
    .pace span {
      display: block;
      color: var(--muted);
      font-size: 1.05vh;
      font-weight: 800;
      letter-spacing: 0.04vw;
      text-transform: uppercase;
    }

    .baseline-chip strong {
      display: block;
      margin-top: 0.35vh;
      color: var(--gold);
      font-size: 1.8vh;
    }

    .members {
      min-height: 5.5vh;
      margin: 1.15vh 0;
      padding-right: 0.3vw;
      color: var(--muted);
      font-size: 1.25vh;
      line-height: 1.4;
    }

    .metrics {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.55vw;
    }

    .metrics div {
      padding: 0.95vh 0.65vw;
      border: 0.14vh solid rgba(70, 106, 128, 0.35);
      border-radius: 0.9vh;
      background: rgba(4, 15, 23, 0.45);
    }

    .metrics strong {
      display: block;
      margin-top: 0.45vh;
      font-size: 2.15vh;
    }

    .pace {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      margin-top: auto;
      padding-top: 1.25vh;
    }

    .pace strong {
      font-size: 2.65vh;
    }

    .pace.positive strong {
      color: var(--good);
    }

    .pace.negative strong {
      color: var(--bad);
    }

    .pace.neutral strong {
      color: var(--muted);
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
      background:
        linear-gradient(
          150deg,
          rgba(20, 47, 63, 0.94),
          rgba(10, 28, 39, 0.97)
        );
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

    .structure-list li + li {
      margin-top: 0.3vh;
    }

    .scoring-grid {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 0.65vw;
    }

    .scoring-item {
      min-width: 0;
      padding: 1.15vh 0.7vw;
      border: 0.14vh solid rgba(70, 106, 128, 0.4);
      border-radius: 0.9vh;
      background: rgba(4, 15, 23, 0.48);
      text-align: center;
    }

    .scoring-item span {
      display: block;
      min-height: 2.4vh;
      color: var(--muted);
      font-size: 1.05vh;
      font-weight: 800;
      line-height: 1.15;
      letter-spacing: 0.04vw;
      text-transform: uppercase;
    }

    .scoring-item strong {
      display: block;
      margin-top: 0.75vh;
      color: var(--white);
      font-size: 2.15vh;
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

    .footer-links {
      white-space: nowrap;
    }

    .footer-links a {
      margin-left: 0.8vw;
      color: var(--blue);
      text-decoration: none;
    }

    @media (max-width: 1200px) {
      .team-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .info-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .info-card {
        grid-column: span 1;
      }

      .scoring-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
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
      ${rankGroup("Top 3", data.topBottomAgents?.top3 || [], "top")}
      <div class="rank-divider"></div>
      ${rankGroup("Bottom 3", data.topBottomAgents?.bottom3 || [], "bottom")}
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
            July 20th - Sept 4th
          </li>

          <li>
            <strong>Baseline Period:</strong>
            March 30th - May 15th
          </li>

          <li>
            Previous Points = daily average from Baseline Period * # of Days in Challenge thus far.
          </li>

          <li>
            Standings/Winner determined by highest growth rate %
          </li>

          <li>
            Call Stats Updated Weekly
          </li>
        </ul>
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
            <span>Listings</span>
            <strong>2,000</strong>
          </div>

          <div class="scoring-item">
            <span>Accepted LOIs</span>
            <strong>2,000</strong>
          </div>

          <div class="scoring-item">
            <span>Contracts</span>
            <strong>4,000</strong>
          </div>
        </div>
      </article>
    </section>

    <section class="footer">
      <span></span>

      <span class="footer-links">
        <a href="/pipeline-growth-challenge/verification">
          Verification
        </a>

        <a href="/pipeline-growth-challenge/admin">
          Call Admin
        </a>
      </span>
    </section>
  </main>
</body>
</html>`;
}

module.exports = {
  renderPipelineGrowthChallengePage,
};