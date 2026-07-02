const {
  getSalesforceToken,
  querySalesforce,
  querySalesforceAll
} = require("../salesforce/client");

function chunkArray(array, size) {
  const chunks = [];

  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }

  return chunks;
}

function normalizePercent(value) {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    String(value).trim() === ""
  ) {
    return 1;
  }

  const number = Number(value || 0);
  return number > 1 ? number / 100 : number;
}

const EXCLUDED_AGENTS = new Set([
  "Barrett Brown",
  "Justin Williams"
]);

function shouldExcludeAgent(agentName) {
  return EXCLUDED_AGENTS.has(String(agentName || "").trim());
}

function addAgentGci(agentMap, agentName, percentValue, gciValue) {
  if (!agentName) return;

  const cleanAgentName = String(agentName).trim();

  if (!cleanAgentName) return;
  if (shouldExcludeAgent(cleanAgentName)) return;

  const percent = normalizePercent(percentValue);
  const TRANSACTION_FEE = 750;
  const grossGci = Number(gciValue || 0);
  const netGci = Math.max(0, grossGci - TRANSACTION_FEE);

  const agentGci = percent * netGci;

  if (!agentMap.has(cleanAgentName)) {
    agentMap.set(cleanAgentName, {
      agent: cleanAgentName,
      gci: 0
    });
  }

  agentMap.get(cleanAgentName).gci += agentGci;
}

function summarizeYtdGciByAgent(records) {
  const agentMap = new Map();

  for (const record of records) {
    for (let i = 1; i <= 5; i++) {
      addAgentGci(
        agentMap,
        record[`P_Agent_${i}__c`],
        record[`TS_PA_${i}__c`],
        record.Primary_GCI__c
      );

      addAgentGci(
        agentMap,
        record[`I_Agent_${i}__c`],
        record[`TS_IA_${i}__c`],
        record.Intermediary_GCI__c
      );
    }
  }

  return [...agentMap.values()]
    .map(row => ({
      ...row,
      gci: Math.round(row.gci * 100) / 100
    }))
    .sort((a, b) => b.gci - a.gci || a.agent.localeCompare(b.agent));
}

function summarizeAcceptedLoisByAgent(offerRecords) {
  const agentMap = new Map();

  for (const offer of offerRecords) {
    const agentId = offer.Procuring_Agent__c || "unknown";
    const agentName = offer.Procuring_Agent__r?.Name || "Unknown Agent";

    if (!agentMap.has(agentId)) {
      agentMap.set(agentId, {
        agentId,
        agent: agentName,
        count: 0
      });
    }

    agentMap.get(agentId).count += 1;
  }

  return [...agentMap.values()]
    .sort((a, b) => b.count - a.count || a.agent.localeCompare(b.agent))
    .slice(0, 10);
}

function summarizeCallsByAgent(taskRecords) {
  const agentMap = new Map();

  for (const task of taskRecords) {
    const agentId = task.OwnerId || "unknown";
    const agentName = task.Owner?.Name || "Unknown Agent";
    
    if (!agentMap.has(agentId)) {
      agentMap.set(agentId, {
        agentId,
        agent: agentName,
        calls: 0
      });
    }

    agentMap.get(agentId).calls += 1;
  }

  return [...agentMap.values()]
    .sort((a, b) => b.calls - a.calls || a.agent.localeCompare(b.agent));
}

async function getCallsLast30Days(instanceUrl, accessToken) {
  
  const taskSoql = `
    SELECT
      Id,
      Subject,
      ActivityDate,
      Same_Day_Check__c,
      OwnerId,
      Owner.Name,
      Type,
      TaskSubtype,
      Status
    FROM Task
    WHERE Subject != null
    AND ActivityDate = LAST_N_DAYS:30
    AND Same_Day_Check__c = TRUE
    ORDER BY Owner.Name ASC, ActivityDate DESC
  `;

  const taskResult = await querySalesforceAll(
    instanceUrl,
    accessToken,
    taskSoql
  );

  const records = taskResult.records || [];
  const leaderboard = summarizeCallsByAgent(records);

  return {
    metric: "callsLast30Days",
    totalRecords: records.length,
    allAgents: leaderboard,
    top10: leaderboard.slice(0, 10)
  };
}

async function getAcceptedLoisLast30Days(instanceUrl, accessToken) {
  const historySoql = `
    SELECT
      ParentId,
      CreatedDate,
      OldValue,
      NewValue
    FROM TTL_Core__Offer__History
    WHERE Field = 'TTL_Core__Offer_Status__c'
    AND CreatedDate = LAST_N_DAYS:30
    ORDER BY CreatedDate DESC
  `;

  const historyResult = await querySalesforce(
    instanceUrl,
    accessToken,
    historySoql
  );

  const acceptedRows = (historyResult.records || []).filter(
    row => String(row.NewValue) === "Accepted"
  );

  const uniqueOfferIds = [...new Set(acceptedRows.map(row => row.ParentId))];

  if (uniqueOfferIds.length === 0) {
    return {
      metric: "acceptedLoisLast30Days",
      total: 0,
      rawAcceptedHistoryCount: 0,
      duplicateAcceptedHistoryCount: 0,
      top10: []
    };
  }

  const offerRecords = [];

  for (const offerIdChunk of chunkArray(uniqueOfferIds, 100)) {
    const quotedIds = offerIdChunk.map(id => `'${id}'`).join(",");

    const offerSoql = `
      SELECT
        Id,
        Name,
        Procuring_Agent__c,
        Procuring_Agent__r.Name
      FROM TTL_Core__Offer__c
      WHERE Id IN (${quotedIds})
    `;

    const offerResult = await querySalesforce(
      instanceUrl,
      accessToken,
      offerSoql
    );

    offerRecords.push(...(offerResult.records || []));
  }

  return {
    metric: "acceptedLoisLast30Days",
    total: uniqueOfferIds.length,
    rawAcceptedHistoryCount: acceptedRows.length,
    duplicateAcceptedHistoryCount: acceptedRows.length - uniqueOfferIds.length,
    top10: summarizeAcceptedLoisByAgent(offerRecords)
  };
}

async function getYtdIndividualGci(instanceUrl, accessToken) {
  const currentYear = new Date().getFullYear();

  const commissionSoql = `
    SELECT
      Id,
      Name,
      Close_Date__c,
      Contract_Sub_Status__c,
      Primary_GCI__c,
      Intermediary_GCI__c,

      P_Agent_1__c,
      TS_PA_1__c,
      P_Agent_2__c,
      TS_PA_2__c,
      P_Agent_3__c,
      TS_PA_3__c,
      P_Agent_4__c,
      TS_PA_4__c,
      P_Agent_5__c,
      TS_PA_5__c,

      I_Agent_1__c,
      TS_IA_1__c,
      I_Agent_2__c,
      TS_IA_2__c,
      I_Agent_3__c,
      TS_IA_3__c,
      I_Agent_4__c,
      TS_IA_4__c,
      I_Agent_5__c,
      TS_IA_5__c
    FROM Commission__c
    WHERE Close_Date__c >= ${currentYear}-01-01
    AND Close_Date__c <= TODAY
    AND Contract_Sub_Status__c = 'Closed'
    ORDER BY Close_Date__c DESC
  `;

  const commissionResult = await querySalesforce(
    instanceUrl,
    accessToken,
    commissionSoql
  );

  const records = commissionResult.records || [];
  const leaderboard = summarizeYtdGciByAgent(records);

  return {
    metric: "ytdIndividualGci",
    totalRecords: records.length,
    allAgents: leaderboard,
    top10: leaderboard.slice(0, 10)
  };
}

async function getIndividualPerformanceData() {
  const tokenData = await getSalesforceToken();

  const calls = await getCallsLast30Days(
    tokenData.instance_url,
    tokenData.access_token
  );

  const acceptedLois = await getAcceptedLoisLast30Days(
    tokenData.instance_url,
    tokenData.access_token
  );

  const ytdGci = await getYtdIndividualGci(
    tokenData.instance_url,
    tokenData.access_token
  );

  return {
    asOf: new Date().toISOString(),
    calls,
    acceptedLois,
    ytdGci
  };
}

module.exports = {
  getIndividualPerformanceData,
  getCallsLast30Days,
  getAcceptedLoisLast30Days,
  getYtdIndividualGci
};