const { getSalesforceToken, querySalesforce } = require("../salesforce/client");

const FIELDS = {
  closeDate: "actual_close_date__c",
  soldPrice: "contract_sales_price__c",
  gci: "Trinity_Commission_Actual__c",
  sideRepresented: "Side_Represented__c",
};

function getDateWindows() {
  const today = new Date();
  const currentYear = today.getFullYear();
  const priorYear = currentYear - 1;

  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return {
    current: {
      label: `${currentYear} YTD`,
      start: `${currentYear}-01-01`,
      end: `${currentYear}-${month}-${day}`,
    },
    prior: {
      label: `${priorYear} Same Period`,
      start: `${priorYear}-01-01`,
      end: `${priorYear}-${month}-${day}`,
    },
  };
}

async function getContractsForWindow(instanceUrl, accessToken, startDate, endDate) {
  const soql = `
    SELECT Id,
           Name,
           ${FIELDS.closeDate},
           ${FIELDS.soldPrice},
           ${FIELDS.gci},
           ${FIELDS.sideRepresented}
    FROM ContractNew__c
    WHERE ${FIELDS.closeDate} >= ${startDate}
    AND ${FIELDS.closeDate} <= ${endDate}
    ORDER BY ${FIELDS.closeDate} DESC
  `;

  const result = await querySalesforce(instanceUrl, accessToken, soql);
  return result.records || [];
}

function summarizeContracts(records) {
  const summary = records.reduce(
    (summary, record) => {
      const soldPrice = Number(record.Contract_Sales_Price__c || 0);
      const gci = Number(record.Trinity_Commission_Actual__c || 0);
      const sideRepresented = String(record.Side_Represented__c || "");

      const isIntermediary = sideRepresented
        .toLowerCase()
        .includes("intermediary");

      const dealMultiplier = isIntermediary ? 2 : 1;

      summary.closedDeals += dealMultiplier;
      summary.closedVolume += soldPrice * dealMultiplier;
      summary.closedGci += gci;

      if (isIntermediary) {
        summary.intermediaryRecords += 1;
      }

      return summary;
    },
    {
      closedDeals: 0,
      closedVolume: 0,
      closedGci: 0,
      intermediaryRecords: 0,
    }
  );

  return {
    closedDeals: summary.closedDeals,
    closedVolume: Math.round(summary.closedVolume),
    closedGci: Math.round(summary.closedGci * 100) / 100,
    intermediaryRecords: summary.intermediaryRecords,
  };
}

function percentChange(current, prior) {
  if (!prior) return null;
  return ((current - prior) / prior) * 100;
}

async function buildClosedTransactionsDashboard() {
  const tokenData = await getSalesforceToken();
  const windows = getDateWindows();

  const currentRecords = await getContractsForWindow(
    tokenData.instance_url,
    tokenData.access_token,
    windows.current.start,
    windows.current.end
  );

  const priorRecords = await getContractsForWindow(
    tokenData.instance_url,
    tokenData.access_token,
    windows.prior.start,
    windows.prior.end
  );

  const current = {
    ...windows.current,
    ...summarizeContracts(currentRecords),
  };

  const prior = {
    ...windows.prior,
    ...summarizeContracts(priorRecords),
  };

  return {
    generatedAt: new Date(),
    current,
    prior,
    comparison: {
      closedDealsPct: percentChange(current.closedDeals, prior.closedDeals),
      closedVolumePct: percentChange(current.closedVolume, prior.closedVolume),
      closedGciPct: percentChange(current.closedGci, prior.closedGci),
    },
  };
}

module.exports = {
  buildClosedTransactionsDashboard,
};