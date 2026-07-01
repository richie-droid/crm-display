const SF_API_VERSION = "v60.0";

async function getSalesforceToken() {
  const tokenUrl = `${process.env.SF_LOGIN_URL}/services/oauth2/token`;

  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: process.env.SF_CLIENT_ID,
    client_secret: process.env.SF_CLIENT_SECRET,
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data;
}

async function querySalesforce(instanceUrl, accessToken, soql) {
  const queryUrl =
    `${instanceUrl}/services/data/${SF_API_VERSION}/query?q=` +
    encodeURIComponent(soql);

  const response = await fetch(queryUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data;
}

module.exports = {
  getSalesforceToken,
  querySalesforce,
};