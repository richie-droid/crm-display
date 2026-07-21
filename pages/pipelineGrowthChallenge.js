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

function formatDate(value) {
  if (!value) return "Not started";
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function calloutCard(label, agent, tone) {
  if (!agent) {
    return `<div class="callout ${tone}">
      <span>${label}</span>
      <strong>Not available yet</strong>
    </div>`;
  }

  return `<div class="callout ${tone}">
    <span>${label}</span>
    <strong>${escapeHtml(agent.displayName)}</strong>
    <small>${escapeHtml(agent.team)} · ${pace(agent.growthPct)}</small>
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
  <title>${escapeHtml(data.title)}</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #07131d;
      --panel: #102331;
      --panel2: #132b3b;
      --line: #294457;
      --text: #f5f7fa;
      --muted: #9fb1bf;
      --accent: #57c4e5;
      --good: #65d18a;
      --bad: #ff7d7d;
      --gold: #e0b95a;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      min-height: 100vh;
      padding: 28px 34px;
      background: radial-gradient(circle at top, #153247 0, #07131d 48%);
      color: var(--text);
      font-family: Arial, Helvetica, sans-serif;
    }

    header {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      margin-bottom: 18px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--line);
    }

    h1 {
      margin: 0;
      font-size: 42px;
      line-height: 1;
      letter-spacing: -1px;
    }

    .subtitle {
      margin-top: 7px;
      color: var(--muted);
      font-size: 15px;
    }

    .window {
      color: var(--muted);
      font-size: 14px;
      text-align: right;
    }

    .window strong {
      display: block;
      margin-bottom: 3px;
      color: var(--text);
      font-size: 16px;
    }

    .callouts {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 18px;
    }

    .callout {
      display: grid;
      grid-template-columns: auto 1fr auto;
      align-items: center;
      gap: 16px;
      padding: 14px 18px;
      border: 1px solid var(--line);
      border-radius: 14px;
      background: linear-gradient(135deg, var(--panel2), var(--panel));
    }

    .callout span {
      color: var(--muted);
      font-size: 13px;
      letter-spacing: 1px;
      text-transform: uppercase;
    }

    .callout strong { font-size: 25px; }
    .callout small { font-size: 17px; font-weight: 700; }
    .callout.grower { border-left: 5px solid var(--good); }
    .callout.anchor { border-left: 5px solid var(--bad); }

    .grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 16px;
    }

    .team-card {
      position: relative;
      display: flex;
      min-height: 274px;
      flex-direction: column;
      padding: 18px;
      border: 1px solid var(--line);
      border-radius: 16px;
      background: linear-gradient(150deg, rgba(20, 47, 63, .97), rgba(10, 28, 39, .98));
      box-shadow: 0 14px 30px rgba(0, 0, 0, .18);
    }

    .team-head {
      display: flex;
      align-items: center;
      gap: 10px;
      max-width: calc(100% - 120px);
    }

    .rank {
      color: var(--gold);
      font-size: 17px;
      font-weight: 800;
    }

    .team-card h2 {
      margin: 0;
      font-size: 27px;
    }

    .baseline-chip {
      position: absolute;
      top: 14px;
      right: 14px;
      min-width: 106px;
      padding: 9px 11px;
      border: 1px solid rgba(224, 185, 90, .45);
      border-radius: 10px;
      background: rgba(55, 45, 17, .52);
      text-align: right;
    }

    .baseline-chip span,
    .metrics span,
    .pace span {
      display: block;
      color: var(--muted);
      font-size: 12px;
      letter-spacing: .6px;
      text-transform: uppercase;
    }

    .baseline-chip strong {
      display: block;
      margin-top: 4px;
      color: var(--gold);
      font-size: 20px;
    }

    .members {
      min-height: 62px;
      margin: 14px 0;
      padding-right: 4px;
      color: var(--muted);
      font-size: 14px;
      line-height: 1.45;
    }

    .metrics {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }

    .metrics div {
      padding: 11px;
      border: 1px solid rgba(70, 106, 128, .35);
      border-radius: 10px;
      background: rgba(4, 15, 23, .45);
    }

    .metrics strong {
      display: block;
      margin-top: 5px;
      font-size: 24px;
    }

    .pace {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      margin-top: auto;
      padding-top: 15px;
    }

    .pace strong { font-size: 30px; }
    .pace.positive strong { color: var(--good); }
    .pace.negative strong { color: var(--bad); }
    .pace.neutral strong { color: var(--muted); }

    footer {
      display: grid;
      grid-template-columns: 1fr auto;
      align-items: end;
      gap: 18px;
      margin-top: 13px;
      color: var(--muted);
      font-size: 12px;
      line-height: 1.45;
    }

    .footer-note strong { color: var(--text); }
    .links { white-space: nowrap; }
    .links a {
      margin-left: 14px;
      color: var(--accent);
      text-decoration: none;
    }

    @media (max-width: 1200px) {
      .grid { grid-template-columns: repeat(2, 1fr); }
    }
  </style>
</head>
<body>
  <header>
    <div>
      <h1>${escapeHtml(data.title)}</h1>
      <div class="subtitle">Team score = growth in points versus the matching elapsed portion of Period 1</div>
    </div>
    <div class="window">
      <strong>Period 2 through ${formatDate(data.windows.period2Live.end)}</strong>
      Compared with ${formatDate(data.windows.period1Equal.start)}–${formatDate(data.windows.period1Equal.end)}
    </div>
  </header>

  <section class="callouts">
    ${calloutCard("Growth Maxxer", data.callouts?.topGrower, "grower")}
    ${calloutCard("Team Anchor", data.callouts?.justAShower, "anchor")}
  </section>

  <main class="grid">${cards}</main>

  <footer>
    <span class="footer-note">
      <strong>Current Points and Previous Points cover the same number of elapsed competition days.</strong>
      Baseline reflects full Period 1 points from Mar 30–May 15, 2026.
    </span>
    <span class="links">
      <a href="/pipeline-growth-challenge/verification">Verification</a>
      <a href="/pipeline-growth-challenge/admin">Call Admin</a>
    </span>
  </footer>
</body>
</html>`;
}

module.exports = { renderPipelineGrowthChallengePage };
