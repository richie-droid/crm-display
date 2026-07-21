function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function number(value) { return Number(value || 0).toLocaleString("en-US"); }
function pace(value) {
  if (value === null || !Number.isFinite(value)) return "N/A";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}
function formatDate(value) {
  if (!value) return "Not started";
  const [y,m,d] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month:"short", day:"numeric", year:"numeric", timeZone:"UTC" }).format(new Date(Date.UTC(y,m-1,d)));
}
function calloutCard(label, agent, tone) {
  if (!agent) return `<div class="callout ${tone}"><span>${label}</span><strong>Not available yet</strong></div>`;
  return `<div class="callout ${tone}">
    <span>${label}</span>
    <strong>${escapeHtml(agent.displayName)}</strong>
    <small>${escapeHtml(agent.team)} · ${pace(agent.growthPct)}</small>
  </div>`;
}

function renderPipelineGrowthChallengePage(data) {
  const cards = data.teams.map((team) => {
    const members = team.agents.map((agent) => escapeHtml(agent.displayName)).join(" · ");
    const paceClass = team.growthPct === null ? "neutral" : team.growthPct >= 0 ? "positive" : "negative";
    return `<article class="team-card">
      <div class="team-head"><span class="rank">#${team.rank}</span><h2>${escapeHtml(team.team)}</h2></div>
      <div class="members">${members}</div>
      <div class="metrics">
        <div><span>Baseline</span><strong>${number(team.period1FullPoints)}</strong></div>
        <div><span>Current Points</span><strong>${number(team.period2Points)}</strong></div>
      </div>
      <div class="pace ${paceClass}"><span>Current Pace</span><strong>${pace(team.growthPct)}</strong></div>
    </article>`;
  }).join("");

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${escapeHtml(data.title)}</title><style>
  :root{color-scheme:dark;--bg:#07131d;--panel:#102331;--panel2:#132b3b;--line:#294457;--text:#f5f7fa;--muted:#9fb1bf;--accent:#57c4e5;--good:#65d18a;--bad:#ff7d7d;--gold:#e0b95a}
  *{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at top,#153247 0,#07131d 48%);color:var(--text);font-family:Arial,Helvetica,sans-serif;min-height:100vh;padding:28px 34px}
  header{display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:18px;border-bottom:1px solid var(--line);padding-bottom:16px}h1{font-size:42px;line-height:1;margin:0;letter-spacing:-1px}.subtitle{color:var(--muted);margin-top:7px;font-size:15px}.window{text-align:right;color:var(--muted);font-size:14px}.window strong{display:block;color:var(--text);font-size:16px;margin-bottom:3px}
  .callouts{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:18px}.callout{background:linear-gradient(135deg,var(--panel2),var(--panel));border:1px solid var(--line);border-radius:14px;padding:14px 18px;display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:16px}.callout span{font-size:13px;text-transform:uppercase;letter-spacing:1px;color:var(--muted)}.callout strong{font-size:25px}.callout small{font-size:17px;font-weight:700}.callout.grower{border-left:5px solid var(--good)}.callout.shower{border-left:5px solid var(--bad)}
  .grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px}.team-card{background:linear-gradient(150deg,rgba(20,47,63,.97),rgba(10,28,39,.98));border:1px solid var(--line);border-radius:16px;padding:18px;min-height:264px;display:flex;flex-direction:column;box-shadow:0 14px 30px rgba(0,0,0,.18)}.team-head{display:flex;align-items:center;gap:10px}.rank{color:var(--gold);font-weight:800;font-size:17px}.team-card h2{margin:0;font-size:27px}.members{color:var(--muted);font-size:14px;line-height:1.45;min-height:62px;margin:9px 0 14px}.metrics{display:grid;grid-template-columns:1fr 1fr;gap:10px}.metrics div{background:rgba(4,15,23,.45);border:1px solid rgba(70,106,128,.35);padding:11px;border-radius:10px}.metrics span,.pace span{display:block;color:var(--muted);font-size:12px;text-transform:uppercase;letter-spacing:.6px}.metrics strong{font-size:24px;display:block;margin-top:5px}.pace{margin-top:auto;padding-top:15px;display:flex;align-items:end;justify-content:space-between}.pace strong{font-size:30px}.pace.positive strong{color:var(--good)}.pace.negative strong{color:var(--bad)}.pace.neutral strong{color:var(--muted)}
  footer{display:flex;justify-content:space-between;color:var(--muted);font-size:12px;margin-top:13px}.links a{color:var(--accent);text-decoration:none;margin-left:14px}
  @media(max-width:1200px){.grid{grid-template-columns:repeat(2,1fr)}}
  </style></head><body>
  <header><div><h1>${escapeHtml(data.title)}</h1><div class="subtitle">Team score = growth in points versus the matching elapsed portion of Period 1</div></div><div class="window"><strong>Period 2 through ${formatDate(data.windows.period2Live.end)}</strong>Compared with ${formatDate(data.windows.period1Equal.start)}–${formatDate(data.windows.period1Equal.end)}</div></header>
  <section class="callouts">${calloutCard("Top Grower",data.callouts?.topGrower,"grower")}${calloutCard("Just a Show-er",data.callouts?.justAShower,"shower")}</section>
  <main class="grid">${cards}</main>
  <footer><span>Baseline reflects full Period 1 points: Mar 30–May 15, 2026.</span><span class="links"><a href="/pipeline-growth-challenge/verification">Verification</a><a href="/pipeline-growth-challenge/admin">Call Admin</a></span></footer>
  </body></html>`;
}
module.exports={renderPipelineGrowthChallengePage};
