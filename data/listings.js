const {
  getSalesforceToken,
  querySalesforce,
} = require("../salesforce/client");

const {
  getListingLeaderName,
} = require("../config/teams");

const DEAL_OBJECT = "TTL_Core__Deal__c";

const ACTIVE_STATUSES = [
  "On-Market / Currently Marketing",
  "Escrow/Due Diligence",
];

const CONDITIONAL_ACTIVE_STATUS = "Agreed To";

const UPCOMING_STATUSES = [
  "Listing Submitted to Admin",
  "Waiting on details from agent",
  "Listing submitted to Agent",
  "Agent Approved",
  "Listing Waiting on Agent",
];

const FIELDS = {
  propertyName: "msf_property_name__c",
  listingPrice: "ttl_core__listing_price_total__c",
  fallbackListingPrice: "Listing_Price_if_no_NOI__c",
  state: "property_state__c",
  status: "ttl_core__status__c",
  capRate: "ttl_core__listing_cap_rate__c",
  listingFee: "listing_fee__c",
  dateOnMarket: "first_eblast_date__c",
  listingWebsite: "listing_website__c",
  onOffMarket: "on_off_market__c",
  listingAgreementSigned: "Listing_Agreement_Signed__c",
  primaryAgent: "primary_agent__c",
};

function getField(record, fieldName) {
  if (record[fieldName] !== undefined) {
    return record[fieldName];
  }

  const match = Object.keys(record).find(
    (key) =>
      key.toLowerCase() === fieldName.toLowerCase()
  );

  return match ? record[match] : undefined;
}

function getRelationshipField(
  record,
  relationshipName,
  fieldName
) {
  const relationshipKey = Object.keys(record).find(
    (key) =>
      key.toLowerCase() ===
      relationshipName.toLowerCase()
  );

  if (
    !relationshipKey ||
    !record[relationshipKey]
  ) {
    return undefined;
  }

  return record[relationshipKey][fieldName];
}

function normalizePercent(value) {
  const numeric = Number(value || 0);

  return numeric > 1
    ? numeric / 100
    : numeric;
}

function parseStateFromName(name) {
  const text = String(name || "").trim();

  const commaMatch = text.match(
    /,\s*([A-Z]{2})(?:\s|$)/
  );

  if (commaMatch) {
    return commaMatch[1];
  }

  const pipeMatch = text.match(
    /\|\s*.*?\s([A-Z]{2})(?:\s|$)/
  );

  if (pipeMatch) {
    return pipeMatch[1];
  }

  const dashMatch = text.match(
    /-\s*.*?(?:,\s*|\s)([A-Z]{2})(?:\s|$)/
  );

  if (dashMatch) {
    return dashMatch[1];
  }

  return "Unknown";
}

function getListingPrice(record) {
  const primaryPrice = Number(
    getField(
      record,
      FIELDS.listingPrice
    ) || 0
  );

  const fallbackPrice = Number(
    getField(
      record,
      FIELDS.fallbackListingPrice
    ) || 0
  );

  return primaryPrice || fallbackPrice || 0;
}

function classifyListing(
  status,
  listingAgreementSigned,
  dateOnMarket
) {
  if (ACTIVE_STATUSES.includes(status)) {
    return "active";
  }

  if (
    status === CONDITIONAL_ACTIVE_STATUS &&
    dateOnMarket
  ) {
    return "active";
  }

  if (
    UPCOMING_STATUSES.includes(status) &&
    listingAgreementSigned
  ) {
    return "upcoming";
  }

  return "excluded";
}

function formatRecord(record) {
  const propertyName =
    getField(
      record,
      FIELDS.propertyName
    ) ||
    record.Name ||
    "Unnamed Listing";

  const status =
    getField(
      record,
      FIELDS.status
    ) || "Unknown";

  const listingAgreementSigned =
    getField(
      record,
      FIELDS.listingAgreementSigned
    );

  const dateOnMarket =
    getField(
      record,
      FIELDS.dateOnMarket
    ) || null;

  const rawState =
    getField(
      record,
      FIELDS.state
    );

  const state =
    rawState ||
    parseStateFromName(propertyName);

  const primaryAgentName =
    getRelationshipField(
      record,
      "Primary_Agent__r",
      "Name"
    ) || "Unassigned";

  return {
    id: record.Id,
    name: propertyName,
    price: getListingPrice(record),
    state,
    status,

    category: classifyListing(
      status,
      listingAgreementSigned,
      dateOnMarket
    ),

    capRate: normalizePercent(
      getField(
        record,
        FIELDS.capRate
      )
    ),

    listingFee: normalizePercent(
      getField(
        record,
        FIELDS.listingFee
      )
    ),

    dateOnMarket,

    listingWebsite:
      getField(
        record,
        FIELDS.listingWebsite
      ) || null,

    listingAgreementSigned:
      listingAgreementSigned || null,

    primaryAgent: primaryAgentName,

    listingLeader:
      getListingLeaderName(
        primaryAgentName
      ),
  };
}

function rankCounts(
  items,
  key,
  limit = 5
) {
  const counts = new Map();

  for (const item of items) {
    const value =
      item[key] || "Unknown";

    counts.set(
      value,
      (counts.get(value) || 0) + 1
    );
  }

  return Array.from(
    counts.entries()
  )
    .map(
      ([name, count]) => ({
        name,
        count,
      })
    )
    .sort(
      (a, b) =>
        b.count - a.count ||
        a.name.localeCompare(b.name)
    )
    .slice(0, limit);
}

function buildStatusCounts(listings) {
  return listings.reduce(
    (summary, listing) => {
      if (
        listing.status ===
        "On-Market / Currently Marketing"
      ) {
        summary.onMarket += 1;
      }

      if (
        listing.status ===
        "Escrow/Due Diligence"
      ) {
        summary.escrow += 1;
      }

      if (
        listing.status ===
        CONDITIONAL_ACTIVE_STATUS
      ) {
        summary.agreedTo += 1;
      }

      return summary;
    },
    {
      onMarket: 0,
      escrow: 0,
      agreedTo: 0,
    }
  );
}

function buildSummary(
  activeListings,
  upcomingListings
) {
  const volume = activeListings.reduce(
    (total, listing) =>
      total + listing.price,
    0
  );

  const capRateListings =
    activeListings.filter(
      (listing) =>
        listing.capRate > 0
    );

  const avgCapRate =
    capRateListings.length === 0
      ? 0
      : capRateListings.reduce(
          (total, listing) =>
            total + listing.capRate,
          0
        ) / capRateListings.length;

  const estimatedGci =
    activeListings.reduce(
      (total, listing) =>
        total +
        listing.price *
          listing.listingFee *
          0.5,
      0
    );

  return {
    activeListings:
      activeListings.length,

    upcomingListings:
      upcomingListings.length,

    totalMarketingPipeline:
      activeListings.length +
      upcomingListings.length,

    volume,
    avgCapRate,
    estimatedGci,
  };
}

function buildRecentListings(
  listings,
  limit = 10
) {
  return listings
    .filter(
      (listing) =>
        listing.dateOnMarket
    )
    .sort(
      (a, b) =>
        new Date(b.dateOnMarket) -
        new Date(a.dateOnMarket)
    )
    .slice(0, limit);
}

async function buildListingsDashboard() {
  const token =
    await getSalesforceToken();

  const quotedActiveStatuses =
    ACTIVE_STATUSES.map(
      (status) => `'${status}'`
    ).join(", ");

  const quotedUpcomingStatuses =
    UPCOMING_STATUSES.map(
      (status) => `'${status}'`
    ).join(", ");

  const soql = `
    SELECT
      Id,
      Name,
      ${FIELDS.propertyName},
      ${FIELDS.listingPrice},
      ${FIELDS.fallbackListingPrice},
      ${FIELDS.state},
      ${FIELDS.status},
      ${FIELDS.capRate},
      ${FIELDS.listingFee},
      ${FIELDS.dateOnMarket},
      ${FIELDS.listingWebsite},
      ${FIELDS.onOffMarket},
      ${FIELDS.listingAgreementSigned},
      ${FIELDS.primaryAgent},
      Primary_Agent__r.Name
    FROM ${DEAL_OBJECT}
    WHERE
      ${FIELDS.onOffMarket} = 'On-Market'
      AND (
        ${FIELDS.status} IN (
          ${quotedActiveStatuses}
        )

        OR (
          ${FIELDS.status} =
            '${CONDITIONAL_ACTIVE_STATUS}'
          AND
          ${FIELDS.dateOnMarket} != null
        )

        OR (
          ${FIELDS.status} IN (
            ${quotedUpcomingStatuses}
          )
          AND
          ${FIELDS.listingAgreementSigned} != null
        )
      )
    ORDER BY
      ${FIELDS.dateOnMarket} DESC
  `;

  const result =
    await querySalesforce(
      token.instance_url,
      token.access_token,
      soql
    );

  const rawRecords =
    result.records || [];

  const listings =
    rawRecords.map(formatRecord);

  const activeListings =
    listings.filter(
      (listing) =>
        listing.category === "active"
    );

  const upcomingListings =
    listings.filter(
      (listing) =>
        listing.category === "upcoming"
    );

  return {
    generatedAt:
      new Date().toISOString(),

    recordCount:
      listings.length,

    summary:
      buildSummary(
        activeListings,
        upcomingListings
      ),

    status:
      buildStatusCounts(
        activeListings
      ),

    states:
      rankCounts(
        activeListings,
        "state",
        5
      ),

    leaders:
      rankCounts(
        activeListings,
        "listingLeader",
        5
      ),

    activeListings,
    upcomingListings,

    recentListings:
      buildRecentListings(
        activeListings,
        10
      ),
  };
}

module.exports = {
  buildListingsDashboard,
};