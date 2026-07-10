const BASE = 'https://searchconsole.googleapis.com/webmasters/v3';

async function searchAnalyticsQuery(accessToken, siteUrl, body) {
  const res = await fetch(`${BASE}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GSC query failed: ${res.status} ${text}`);
  }
  return res.json();
}

module.exports = { searchAnalyticsQuery };
