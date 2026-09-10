const fs = require("fs");
const path = require("path");
const { loadHomeStretchCalls } = require("../storage/homeStretchCalls");
const { loadHomeStretchAdjustments } = require("../storage/homeStretchAdjustments");
const {
  getSalesforceToken,
  querySalesforceAll,
} = require("../salesforce/client");

const CONFIG = {
  title: "The Home Stretch",
  period: { start: "2026-09-14", end: "2026-11-25" },
  points: {
    calls: 1,
    proposals: 200,
    submittedLois: 200,
    listings: 2000,
    acceptedLois: 3000,
    contracts: 5000,
  },
};

const ROSTER_PATH = path.join(__dirname, "../config/home-stretch-roster.csv");

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && quoted && next === '"') {
      value += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(value);
      value = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(value);
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = [];
      value = "";
    } else {
      value += char;
    }
  }

  if (value || row.length) {
    row.push(value);
    if (row.some((cell) => cell !== "")) rows.push(row);
  }

  if (!rows.length) return [];
  const headers = rows[0].map((header) => header.trim());

  return rows.slice(1).map((values) =>
    Object.fromEntries(
      headers.map((header, index) => [header, (values[index] || "").trim()])
    )
  );
}

function readCsv(filePath) {
  return parseCsv(fs.readFileSync(filePath, "utf8"));
}

function normalizeName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function getField(record, fieldName) {
  if (!record) return undefined;
  if (record[fieldName] !== undefined) return record[fieldName];
  const key = Object.keys(record).find(
    (candidate) => candidate.toLowerCase() === fieldName.toLowerCase()
  );
  return key ? record[key] : undefined;
}

function getRelationshipName(record, relationshipName) {
  const relationship = getField(record, relationshipName);
  return getField(relationship, "Name") || null;
}

function parseDateOnly(value) {
  if (!value) return null;
  const datePart = String(value).slice(0, 10);
  const match = datePart.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 86400000);
}

function minDate(...dates) {
  return new Date(Math.min(...dates.map((date) => date.getTime())));
}

function inWindow(value, window) {
  if (!value || !window.start || !window.end) return false;
  const date = String(value).slice(0, 10);
  return date >= window.start && date <= window.end;
}

function getWindow(now = new Date()) {
  const start = parseDateOnly(CONFIG.period.start);
  const end = parseDateOnly(CONFIG.period.end);
  const today = parseDateOnly(formatDate(now));

  const started = today >= start;
  const dataThrough = started ? formatDate(minDate(today, end)) : null;

  return {
    start: CONFIG.period.start,
    end: CONFIG.period.end,
    dataThrough,
    started,
    complete: started && dataThrough === CONFIG.period.end,
  };
}

function loadRoster() {
  const rows = readCsv(ROSTER_PATH);
  const byName = new Map();

  for (const row of rows) {
    const parsedHandicap = Number(row.handicap);
    const entry = {
      salesforceName: row.salesforce_name,
      displayName: row.display_name || row.salesforce_name,
      team: row.team,
      handicap: Number.isFinite(parsedHandicap) && parsedHandicap > 0 ? parsedHandicap : 1,
    };
    byName.set(normalizeName(entry.salesforceName), entry);
  }

  return { rows, byName };
}

function loadCalls() {
  return loadHomeStretchCalls().map((row) => ({
    weekStart: row.weekStart,
    salesforceName: row.salesforceName,
    calls: row.calls,
  }));
}

function loadAdjustments() {
  const map = new Map();
  for (const entry of loadHomeStretchAdjustments()) {
    map.set(normalizeName(entry.salesforceName), entry.netAdjustment || 0);
  }
  return map;
}

function weekIndex(dateValue, periodStart) {
  const date = parseDateOnly(dateValue);
  const start = parseDateOnly(periodStart);
  if (!date || !start) return -1;
  return Math.floor((date.getTime() - start.getTime()) / (7 * 86400000));
}

function getIncludedCallWeeks(callRows) {
  const enteredIndexes = callRows
    .filter(
      (row) =>
        row.calls !== null &&
        inWindow(row.weekStart, { start: CONFIG.period.start, end: CONFIG.period.end })
    )
    .map((row) => weekIndex(row.weekStart, CONFIG.period.start))
    .filter((index) => index >= 0);

  return enteredIndexes.length ? Math.max(...enteredIndexes) + 1 : 0;
}

function createAgentState(rosterEntry) {
  return {
    salesforceName: rosterEntry.salesforceName,
    displayName: rosterEntry.displayName,
    team: rosterEntry.team,
    handicap: rosterEntry.handicap,
    counts: { calls: 0, proposals: 0, submittedLois: 0, listings: 0, acceptedLois: 0, contracts: 0 },
  };
}

function addCount(agentState, category, amount = 1) {
  agentState.counts[category] += amount;
}

function sumPoints(counts) {
  return Object.entries(counts).reduce(
    (total, [category, count]) => total + count * CONFIG.points[category],
    0
  );
}

function buildSoqlDateTimeStart(date) {
  return `${date}T00:00:00.000Z`;
}

function buildSoqlDateTimeEnd(date) {
  return `${date}T23:59:59.999Z`;
}

async function fetchCompetitionRecords(token, window) {
  if (!window.dataThrough) {
    return {
      proposals: [],
      listings: [],
      submittedLois: [],
      lois: [],
      contracts: [],
      rawLoiHistoryCount: 0,
      agreedToHistoryCount: 0,
    };
  }

  const rangeStart = CONFIG.period.start;
  const rangeEnd = window.dataThrough;

  const proposalSoql = `
    SELECT Id, Name, CreatedDate, Primary_Agent__c, Primary_Agent__r.Name
    FROM TTL_Core__Deal__c
    WHERE RecordType.Name = 'Proposal'
      AND CreatedDate >= ${buildSoqlDateTimeStart(rangeStart)}
      AND CreatedDate <= ${buildSoqlDateTimeEnd(rangeEnd)}
    ORDER BY CreatedDate ASC
  `;

  const listingSoql = `
    SELECT Id, Name, Listing_Agreement_Signed__c,
           Primary_Agent__c, Primary_Agent__r.Name
    FROM TTL_Core__Deal__c
    WHERE RecordType.Name = 'Listing'
      AND Listing_Agreement_Signed__c >= ${rangeStart}
      AND Listing_Agreement_Signed__c <= ${rangeEnd}
    ORDER BY Listing_Agreement_Signed__c ASC
  `;

  const submittedLoiSoql = `
    SELECT Id, Name, TTL_Core__Offer_Date__c, Procuring_Agent__c, Procuring_Agent__r.Name
    FROM TTL_Core__Offer__c
    WHERE TTL_Core__Offer_Date__c >= ${rangeStart}
      AND TTL_Core__Offer_Date__c <= ${rangeEnd}
    ORDER BY TTL_Core__Offer_Date__c ASC
  `;

  const loiHistorySoql = `
    SELECT ParentId, CreatedDate, OldValue, NewValue
    FROM TTL_Core__Offer__History
    WHERE Field = 'TTL_Core__Offer_Status__c'
      AND CreatedDate >= ${buildSoqlDateTimeStart(rangeStart)}
      AND CreatedDate <= ${buildSoqlDateTimeEnd(rangeEnd)}
    ORDER BY CreatedDate ASC
  `;

  const contractSoql = `
    SELECT Id, Name, Contract_Effective_Date__c,
           Primary_agent__c, Primary_agent__r.Name,
           Intermediary_Agent__c, Intermediary_Agent__r.Name
    FROM ContractNew__c
    WHERE Contract_Effective_Date__c >= ${rangeStart}
      AND Contract_Effective_Date__c <= ${rangeEnd}
    ORDER BY Contract_Effective_Date__c ASC
  `;

  const [proposals, listings, submittedLois, loiHistory, contracts] = await Promise.all([
    querySalesforceAll(token.instance_url, token.access_token, proposalSoql),
    querySalesforceAll(token.instance_url, token.access_token, listingSoql),
    querySalesforceAll(token.instance_url, token.access_token, submittedLoiSoql),
    querySalesforceAll(token.instance_url, token.access_token, loiHistorySoql),
    querySalesforceAll(token.instance_url, token.access_token, contractSoql),
  ]);

  const agreedToRows = (loiHistory.records || []).filter(
    (row) => String(getField(row, "NewValue") || "") === "Accepted"
  );

  const firstAgreedToByOffer = new Map();
  for (const row of agreedToRows) {
    const existing = firstAgreedToByOffer.get(row.ParentId);
    if (!existing || String(row.CreatedDate) < String(existing.CreatedDate)) {
      firstAgreedToByOffer.set(row.ParentId, row);
    }
  }

  const offerIds = [...firstAgreedToByOffer.keys()];
  const offers = [];
  for (let index = 0; index < offerIds.length; index += 100) {
    const chunk = offerIds.slice(index, index + 100);
    if (!chunk.length) continue;
    const ids = chunk.map((id) => `'${id}'`).join(",");
    const result = await querySalesforceAll(
      token.instance_url,
      token.access_token,
      `SELECT Id, Name, Procuring_Agent__c, Procuring_Agent__r.Name
       FROM TTL_Core__Offer__c
       WHERE Id IN (${ids})`
    );
    offers.push(...(result.records || []));
  }

  const offerById = new Map(offers.map((offer) => [offer.Id, offer]));
  const lois = [...firstAgreedToByOffer.entries()].map(([offerId, history]) => ({
    offerId,
    history,
    offer: offerById.get(offerId) || null,
  }));

  return {
    proposals: proposals.records || [],
    listings: listings.records || [],
    submittedLois: submittedLois.records || [],
    lois,
    contracts: contracts.records || [],
    rawLoiHistoryCount: (loiHistory.records || []).length,
    agreedToHistoryCount: agreedToRows.length,
  };
}

function applyEvent({ agents, unmatched, name, date, category, window }) {
  const key = normalizeName(name);
  const agent = agents.get(key);
  if (!agent) {
    unmatched.push({ category, name: name || null, date: String(date || "").slice(0, 10) });
    return;
  }

  if (inWindow(date, { start: window.start, end: window.dataThrough })) {
    addCount(agent, category);
  }
}

function applyCalls({ agents, unmatched, calls, includedWeeks }) {
  for (const row of calls) {
    if (row.calls === null) continue;
    const key = normalizeName(row.salesforceName);
    const agent = agents.get(key);
    if (!agent) {
      unmatched.push({ category: "calls", name: row.salesforceName, date: row.weekStart });
      continue;
    }

    const index = weekIndex(row.weekStart, CONFIG.period.start);

    if (
      inWindow(row.weekStart, CONFIG.period) &&
      index >= 0 &&
      index < includedWeeks
    ) {
      addCount(agent, "calls", row.calls);
    }
  }
}

function finalizeAgents(agents, adjustments) {
  return [...agents.values()].map((agent) => {
    const netAdjustment = adjustments.get(normalizeName(agent.salesforceName)) || 0;
    const rawPoints = sumPoints(agent.counts);
    const handicappedPoints = Math.round(rawPoints * agent.handicap);
    const totalPoints = handicappedPoints + netAdjustment;

    return {
      ...agent,
      rawPoints,
      handicappedPoints,
      netAdjustment,
      totalPoints,
    };
  });
}

function buildTeams(agentRows) {
  const teams = new Map();

  for (const agent of agentRows) {
    if (!teams.has(agent.team)) {
      teams.set(agent.team, { team: agent.team, agents: [], totalPoints: 0 });
    }
    const team = teams.get(agent.team);
    team.agents.push(agent);
    team.totalPoints += agent.totalPoints;
  }

  return [...teams.values()]
    .sort((a, b) => b.totalPoints - a.totalPoints)
    .map((team, index) => ({ ...team, rank: index + 1 }));
}

function getCompetitionWeeks() {
  const weeks = [];
  let current = parseDateOnly(CONFIG.period.start);
  const end = parseDateOnly(CONFIG.period.end);
  while (current <= end) {
    weeks.push({ weekStart: formatDate(current) });
    current = addDays(current, 7);
  }
  return weeks;
}

function getHomeStretchRoster() {
  return loadRoster().rows.map((row) => {
    const parsedHandicap = Number(row.handicap);
    return {
      salesforceName: row.salesforce_name,
      displayName: row.display_name || row.salesforce_name,
      team: row.team,
      handicap: Number.isFinite(parsedHandicap) && parsedHandicap > 0 ? parsedHandicap : 1,
    };
  });
}

function getTopAgents(agentRows) {
  const sorted = [...agentRows].sort(
    (a, b) => b.totalPoints - a.totalPoints || a.displayName.localeCompare(b.displayName)
  );

  return {
    top5: sorted.slice(0, 5),
  };
}

async function buildHomeStretch({ debug = false } = {}) {
  const window = getWindow();
  const roster = loadRoster();
  const calls = loadCalls();
  const includedCallWeeks = getIncludedCallWeeks(calls);
  const agents = new Map(
    [...roster.byName.entries()].map(([key, entry]) => [key, createAgentState(entry)])
  );
  const unmatched = [];

  const token = await getSalesforceToken();
  const records = await fetchCompetitionRecords(token, window);

  for (const record of records.proposals) {
    applyEvent({
      agents,
      unmatched,
      name: getRelationshipName(record, "Primary_Agent__r"),
      date: getField(record, "CreatedDate"),
      category: "proposals",
      window,
    });
  }

  for (const record of records.listings) {
    applyEvent({
      agents,
      unmatched,
      name: getRelationshipName(record, "Primary_Agent__r"),
      date: getField(record, "Listing_Agreement_Signed__c"),
      category: "listings",
      window,
    });
  }

  for (const record of records.submittedLois) {
    applyEvent({
      agents,
      unmatched,
      name: getRelationshipName(record, "Procuring_Agent__r"),
      date: getField(record, "TTL_Core__Offer_Date__c"),
      category: "submittedLois",
      window,
    });
  }

  for (const record of records.lois) {
    applyEvent({
      agents,
      unmatched,
      name: getRelationshipName(record.offer, "Procuring_Agent__r"),
      date: getField(record.history, "CreatedDate"),
      category: "acceptedLois",
      window,
    });
  }

  for (const record of records.contracts) {
    const date = getField(record, "Contract_Effective_Date__c");
    const primary = getRelationshipName(record, "Primary_agent__r");
    const intermediary = getRelationshipName(record, "Intermediary_Agent__r");

    if (primary) {
      applyEvent({ agents, unmatched, name: primary, date, category: "contracts", window });
    }
    if (intermediary) {
      applyEvent({ agents, unmatched, name: intermediary, date, category: "contracts", window });
    }
  }

  applyCalls({ agents, unmatched, calls, includedWeeks: includedCallWeeks });

  const adjustments = loadAdjustments();
  const agentRows = finalizeAgents(agents, adjustments);
  const teams = buildTeams(agentRows);

  const result = {
    title: CONFIG.title,
    generatedAt: new Date().toISOString(),
    window,
    points: CONFIG.points,
    calls: {
      includedCompletedWeeks: includedCallWeeks,
      rule: "Call weeks are only counted once that week's totals have been entered in the admin page.",
    },
    teams,
    topBottomAgents: getTopAgents(agentRows),
  };

  if (debug) {
    result.debug = {
      rosterCount: roster.rows.length,
      sourceCounts: {
        proposals: records.proposals.length,
        listings: records.listings.length,
        submittedLois: records.submittedLois.length,
        uniqueAcceptedLois: records.lois.length,
        rawLoiHistoryRows: records.rawLoiHistoryCount,
        agreedToHistoryRows: records.agreedToHistoryCount,
        contracts: records.contracts.length,
        callRowsWithValues: calls.filter((row) => row.calls !== null).length,
      },
      unmatched,
      agents: agentRows,
    };
  }

  return result;
}

module.exports = {
  CONFIG,
  buildHomeStretch,
  getCompetitionWeeks,
  getHomeStretchRoster,
};
