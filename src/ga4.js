const BASE = 'https://analyticsdata.googleapis.com/v1beta';

async function callGa4(accessToken, propertyId, method, body) {
  const res = await fetch(`${BASE}/properties/${propertyId}:${method}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GA4 ${method} failed: ${res.status} ${text}`);
  }
  return res.json();
}

function runReport(accessToken, propertyId, body) {
  return callGa4(accessToken, propertyId, 'runReport', body);
}

function runRealtimeReport(accessToken, propertyId, body) {
  return callGa4(accessToken, propertyId, 'runRealtimeReport', body);
}

module.exports = { runReport, runRealtimeReport };
