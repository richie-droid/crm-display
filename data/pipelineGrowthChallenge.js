const fs = require("fs");
const path = require("path");
const {
  getSalesforceToken,
  querySalesforceAll,
} = require("../salesforce/client");

const CONFIG = {
  title: "Pipeline Growth Challenge",
  period1: { start: "2026-03-30", end: "2026-05-15" },
  period2: { start: "2026-07-20", end: "2026-09-04" },
  points: {
    calls: 1,
    proposals: 200,
    listings: 2000,
    lois: 2000,
    contracts: 4000,
  },
};

const ROSTER_PATH = path.join(
  __dirname,
  "../config/pipeline-growth-roster.csv"
);
const CALLS_PATH = path.join(
  __dirname,
  "../config/pipeline-growth-calls.csv"
);

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

function inclusiveDayCount(start, end) {
  return Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
}

function minDate(...dates) {
  return new Date(Math.min(...dates.map((date) => date.getTime())));
}

function getWindows(now = new Date()) {
  const p1Start = parseDateOnly(CONFIG.period1.start);
  const p1End = parseDateOnly(CONFIG.period1.end);
  const p2Start = parseDateOnly(CONFIG.period2.start);
  const p2End = parseDateOnly(CONFIG.period2.end);
  const today = parseDateOnly(formatDate(now));

  let p2DataThrough;
  let elapsedDays;

  if (today < p2Start) {
    p2DataThrough = addDays(p2Start, -1);
    elapsedDays = 0;
  } else {
    p2DataThrough = minDate(today, p2End);
    elapsedDays = inclusiveDayCount(p2Start, p2DataThrough);
  }

  const p1EqualEnd = elapsedDays
    ? minDate(addDays(p1Start, elapsedDays - 1), p1End)
    : addDays(p1Start, -1);

  return {
    period1Full: {
      start: CONFIG.period1.start,
      end: CONFIG.period1.end,
    },
    period1Equal: {
      start: CONFIG.period1.start,
      end: elapsedDays ? formatDate(p1EqualEnd) : null,
    },
    period2Live: {
      start: CONFIG.period2.start,
      end: elapsedDays ? formatDate(p2DataThrough) : null,
    },
    elapsedDays,
    dataThrough: formatDate(today),
  };
}

function inWindow(value, window) {
  if (!value || !window.start || !window.end) return false;
  const date = String(value).slice(0, 10);
  return date >= window.start && date <= window.end;
}

function loadRoster() {
  const rows = readCsv(ROSTER_PATH);
  const byName = new Map();

  for (const row of rows) {
    const entry = {
      salesforceName: row.salesforce_name,
      displayName: row.display_name || row.salesforce_name,
      team: row.team,
    };
    byName.set(normalizeName(entry.salesforceName), entry);
  }

  return { rows, byName };
}

function loadCalls() {
  return readCsv(CALLS_PATH)
    .map((row) => ({
      weekStart: row.week_start,
      salesforceName: row.salesforce_name,
      calls: row.calls === "" ? null : Number(row.calls),
    }))
    .filter(
      (row) =>
        row.weekStart &&
        row.salesforceName &&
        (row.calls === null || Number.isFinite(row.calls))
    );
}

function weekIndex(dateValue, periodStart) {
  const date = parseDateOnly(dateValue);
  const start = parseDateOnly(periodStart);
  if (!date || !start) return -1;
  return Math.floor((date.getTime() - start.getTime()) / (7 * 86400000));
}

function getIncludedCallWeeks(callRows) {
  const enteredP2Indexes = callRows
    .filter(
      (row) =>
        row.calls !== null &&
        inWindow(row.weekStart, {
          start: CONFIG.period2.start,
          end: CONFIG.period2.end,
        })
    )
    .map((row) => weekIndex(row.weekStart, CONFIG.period2.start))
    .filter((index) => index >= 0);

  return enteredP2Indexes.length ? Math.max(...enteredP2Indexes) + 1 : 0;
}

function createAgentState(rosterEntry) {
  return {
    salesforceName: rosterEntry.salesforceName,
    displayName: rosterEntry.displayName,
    team: rosterEntry.team,
    period1: { calls: 0, proposals: 0, listings: 0, lois: 0, contracts: 0 },
    period2: { calls: 0, proposals: 0, listings: 0, lois: 0, contracts: 0 },
    period1Full: { calls: 0, proposals: 0, listings: 0, lois: 0, contracts: 0 },
  };
}

function addCount(agentState, bucket, category, amount = 1) {
  agentState[bucket][category] += amount;
}

function sumPoints(counts) {
  return Object.entries(counts).reduce(
    (total, [category, count]) => total + count * CONFIG.points[category],
    0
  );
}

function percentageGrowth(current, prior) {
  if (!prior) return null;
  return ((current - prior) / prior) * 100;
}

function buildSoqlDateTimeStart(date) {
  return `${date}T00:00:00.000Z`;
}

function buildSoqlDateTimeEnd(date) {
  return `${date}T23:59:59.999Z`;
}

async function fetchCompetitionRecords(token, windows) {
  const rangeStart = CONFIG.period1.start;
  const rangeEnd = windows.period2Live.end || CONFIG.period2.start;

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

  const [proposals, listings, loiHistory, contracts] = await Promise.all([
    querySalesforceAll(token.instance_url, token.access_token, proposalSoql),
    querySalesforceAll(token.instance_url, token.access_token, listingSoql),
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
    lois,
    contracts: contracts.records || [],
    rawLoiHistoryCount: (loiHistory.records || []).length,
    agreedToHistoryCount: agreedToRows.length,
  };
}

function applyEvent({ agents, unmatched, name, date, category, windows }) {
  const key = normalizeName(name);
  const agent = agents.get(key);
  if (!agent) {
    unmatched.push({ category, name: name || null, date: String(date || "").slice(0, 10) });
    return;
  }

  if (inWindow(date, windows.period1Full)) addCount(agent, "period1Full", category);
  if (inWindow(date, windows.period1Equal)) addCount(agent, "period1", category);
  if (inWindow(date, windows.period2Live)) addCount(agent, "period2", category);
}

function applyCalls({ agents, unmatched, calls, includedWeeks }) {
  for (const row of calls) {
    if (row.calls === null) continue;
    const key = normalizeName(row.salesforceName);
    const agent = agents.get(key);
    if (!agent) {
      unmatched.push({
        category: "calls",
        name: row.salesforceName,
        date: row.weekStart,
      });
      continue;
    }

    const p1Index = weekIndex(row.weekStart, CONFIG.period1.start);
    const p2Index = weekIndex(row.weekStart, CONFIG.period2.start);

    if (inWindow(row.weekStart, CONFIG.period1)) {
      addCount(agent, "period1Full", "calls", row.calls);
      if (p1Index >= 0 && p1Index < includedWeeks) {
        addCount(agent, "period1", "calls", row.calls);
      }
    }

    if (
      inWindow(row.weekStart, CONFIG.period2) &&
      p2Index >= 0 &&
      p2Index < includedWeeks
    ) {
      addCount(agent, "period2", "calls", row.calls);
    }
  }
}

function finalizeAgents(agents) {
  return [...agents.values()].map((agent) => {
    const period1Points = sumPoints(agent.period1);
    const period2Points = sumPoints(agent.period2);
    const period1FullPoints = sumPoints(agent.period1Full);

    return {
      ...agent,
      period1Points,
      period2Points,
      period1FullPoints,
      growthPct: percentageGrowth(period2Points, period1Points),
    };
  });
}

function buildTeams(agentRows) {
  const teams = new Map();

  for (const agent of agentRows) {
    if (!teams.has(agent.team)) {
      teams.set(agent.team, {
        team: agent.team,
        agents: [],
        period1Points: 0,
        period2Points: 0,
        period1FullPoints: 0,
      });
    }
    const team = teams.get(agent.team);
    team.agents.push(agent);
    team.period1Points += agent.period1Points;
    team.period2Points += agent.period2Points;
    team.period1FullPoints += agent.period1FullPoints;
  }

  return [...teams.values()]
    .map((team) => ({
      ...team,
      growthPct: percentageGrowth(team.period2Points, team.period1Points),
    }))
    .sort((a, b) => {
      const aGrowth = a.growthPct === null ? -Infinity : a.growthPct;
      const bGrowth = b.growthPct === null ? -Infinity : b.growthPct;
      return bGrowth - aGrowth || b.period2Points - a.period2Points;
    })
    .map((team, index) => ({ ...team, rank: index + 1 }));
}

async function buildPipelineGrowthChallenge({ debug = false } = {}) {
  const windows = getWindows();
  const roster = loadRoster();
  const calls = loadCalls();
  const includedCallWeeks = getIncludedCallWeeks(calls);
  const agents = new Map(
    [...roster.byName.entries()].map(([key, entry]) => [key, createAgentState(entry)])
  );
  const unmatched = [];

  const token = await getSalesforceToken();
  const records = await fetchCompetitionRecords(token, windows);

  for (const record of records.proposals) {
    applyEvent({
      agents,
      unmatched,
      name: getRelationshipName(record, "Primary_Agent__r"),
      date: getField(record, "CreatedDate"),
      category: "proposals",
      windows,
    });
  }

  for (const record of records.listings) {
    applyEvent({
      agents,
      unmatched,
      name: getRelationshipName(record, "Primary_Agent__r"),
      date: getField(record, "Listing_Agreement_Signed__c"),
      category: "listings",
      windows,
    });
  }

  for (const record of records.lois) {
    applyEvent({
      agents,
      unmatched,
      name: getRelationshipName(record.offer, "Procuring_Agent__r"),
      date: getField(record.history, "CreatedDate"),
      category: "lois",
      windows,
    });
  }

  for (const record of records.contracts) {
    const date = getField(record, "Contract_Effective_Date__c");
    const primary = getRelationshipName(record, "Primary_agent__r");
    const intermediary = getRelationshipName(record, "Intermediary_Agent__r");

    if (primary) {
      applyEvent({ agents, unmatched, name: primary, date, category: "contracts", windows });
    }
    if (intermediary) {
      applyEvent({
        agents,
        unmatched,
        name: intermediary,
        date,
        category: "contracts",
        windows,
      });
    }
  }

  applyCalls({ agents, unmatched, calls, includedWeeks: includedCallWeeks });

  const agentRows = finalizeAgents(agents);
  const teams = buildTeams(agentRows);

  const result = {
    title: CONFIG.title,
    generatedAt: new Date().toISOString(),
    windows,
    points: CONFIG.points,
    calls: {
      includedCompletedWeeks: includedCallWeeks,
      rule: "Call weeks enter both comparison periods only after Period 2 data for the matching week has been entered.",
    },
    teams,
  };

  if (debug) {
    result.debug = {
      rosterCount: roster.rows.length,
      sourceCounts: {
        proposals: records.proposals.length,
        listings: records.listings.length,
        uniqueLois: records.lois.length,
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
  buildPipelineGrowthChallenge,
};
