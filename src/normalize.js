const { runReport, runRealtimeReport } = require('./ga4');
const { searchAnalyticsQuery } = require('./gsc');

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return isoDate(d);
}

function fmtInt(n) {
  return Math.round(Number(n) || 0).toLocaleString('en-US');
}

function fmtPct(n, digits = 2) {
  return `${(Number(n) || 0).toFixed(digits)}%`;
}

function pctChange(curr, prev) {
  if (!prev) return null;
  return ((curr - prev) / prev) * 100;
}

function dateLabel(raw) {
  const s = String(raw).replace(/-/g, '');
  return `${s.slice(4, 6)}/${s.slice(6, 8)}`;
}

function flagEmoji(countryId) {
  if (!countryId || countryId.length !== 2) return '🌐';
  const points = [...countryId.toUpperCase()].map((c) => 127397 + c.charCodeAt(0));
  return String.fromCodePoint(...points);
}

function sourceIcon(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('google')) return '🔎';
  if (n.includes('facebook') || n.includes('fb')) return '📘';
  if (n.includes('instagram')) return '📷';
  if (n.includes('chatgpt') || n.includes('openai')) return '🤖';
  if (n.includes('direct') || n === '(direct)') return '➡️';
  if (n.includes('bing')) return '🔍';
  if (n.includes('youtube')) return '▶️';
  return '↗️';
}

function metricValue(row, index) {
  return Number(row.metricValues?.[index]?.value || 0);
}

function dimValue(row, index) {
  return row.dimensionValues?.[index]?.value || '(not set)';
}

async function getAccessToken(oauth2Client) {
  const { token } = await oauth2Client.getAccessToken();
  return token;
}

const DEVICE_COLORS = { mobile: '#63b9d1', desktop: '#5b24ff', tablet: '#1f7ae0' };
const PALETTE = ['#1f7ae0', '#0fb5c8', '#5b24ff', '#63b9d1', '#f59e0b'];

async function buildDashboardPayload(oauth2Client, { propertyId, siteUrl }) {
  const accessToken = await getAccessToken(oauth2Client);

  const rangeEnd = daysAgo(3);
  const rangeStart = daysAgo(30);
  const prevEnd = daysAgo(31);
  const prevStart = daysAgo(58);

  const warnings = [];

  // ---------- GA4 ----------
  let overview = { sessions: 0, totalUsers: 0, screenPageViews: 0 };
  let overviewPrev = { sessions: 0, totalUsers: 0, screenPageViews: 0 };
  let ga4Labels = [];
  let ga4Sessions = [];
  let ga4Views = [];
  let countries = [];
  let referrals = [];
  let topPages = [];
  let channelLabels = [];
  let channelValues = [];
  let deviceLegend = [];
  let deviceModels = [];
  let screenResolutions = [];
  let newVsReturning = { new: 0, returning: 0, new_pct: 0, returning_pct: 0 };
  let realtime = { active_30m: 0, active_5m: 0, recentActiveUsers: 0, top_pages: [] };
  let ga4Ok = true;

  try {
    const dateRanges = [{ startDate: rangeStart, endDate: rangeEnd }];

    const [overviewResp, overviewPrevResp, trendResp, countryResp, pagesResp, sourceResp, channelResp, deviceResp, modelResp, resResp, nvrResp] = await Promise.all([
      runReport(accessToken, propertyId, { dateRanges, metrics: [{ name: 'sessions' }, { name: 'totalUsers' }, { name: 'screenPageViews' }] }),
      runReport(accessToken, propertyId, { dateRanges: [{ startDate: prevStart, endDate: prevEnd }], metrics: [{ name: 'sessions' }, { name: 'totalUsers' }, { name: 'screenPageViews' }] }),
      runReport(accessToken, propertyId, { dateRanges, dimensions: [{ name: 'date' }], metrics: [{ name: 'sessions' }, { name: 'screenPageViews' }], orderBys: [{ dimension: { dimensionName: 'date' } }] }),
      runReport(accessToken, propertyId, { dateRanges, dimensions: [{ name: 'country' }, { name: 'countryId' }], metrics: [{ name: 'totalUsers' }], orderBys: [{ metric: { metricName: 'totalUsers' }, desc: true }], limit: 10 }),
      runReport(accessToken, propertyId, { dateRanges, dimensions: [{ name: 'pageTitle' }], metrics: [{ name: 'screenPageViews' }], orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }], limit: 10 }),
      runReport(accessToken, propertyId, { dateRanges, dimensions: [{ name: 'sessionSource' }], metrics: [{ name: 'sessions' }], orderBys: [{ metric: { metricName: 'sessions' }, desc: true }], limit: 10 }),
      runReport(accessToken, propertyId, { dateRanges, dimensions: [{ name: 'sessionDefaultChannelGroup' }], metrics: [{ name: 'sessions' }], orderBys: [{ metric: { metricName: 'sessions' }, desc: true }] }),
      runReport(accessToken, propertyId, { dateRanges, dimensions: [{ name: 'deviceCategory' }], metrics: [{ name: 'sessions' }], orderBys: [{ metric: { metricName: 'sessions' }, desc: true }] }),
      runReport(accessToken, propertyId, { dateRanges, dimensions: [{ name: 'mobileDeviceModel' }], metrics: [{ name: 'sessions' }], orderBys: [{ metric: { metricName: 'sessions' }, desc: true }], limit: 10 }),
      runReport(accessToken, propertyId, { dateRanges, dimensions: [{ name: 'screenResolution' }], metrics: [{ name: 'sessions' }], orderBys: [{ metric: { metricName: 'sessions' }, desc: true }], limit: 10 }),
      runReport(accessToken, propertyId, { dateRanges, dimensions: [{ name: 'newVsReturning' }], metrics: [{ name: 'totalUsers' }] }),
    ]);

    const ov = overviewResp.rows?.[0];
    if (ov) overview = { sessions: metricValue(ov, 0), totalUsers: metricValue(ov, 1), screenPageViews: metricValue(ov, 2) };
    const ovp = overviewPrevResp.rows?.[0];
    if (ovp) overviewPrev = { sessions: metricValue(ovp, 0), totalUsers: metricValue(ovp, 1), screenPageViews: metricValue(ovp, 2) };

    for (const row of trendResp.rows || []) {
      ga4Labels.push(dateLabel(dimValue(row, 0)));
      ga4Sessions.push(metricValue(row, 0));
      ga4Views.push(metricValue(row, 1));
    }

    countries = (countryResp.rows || []).map((row) => ({
      name: dimValue(row, 0),
      value: fmtInt(metricValue(row, 0)),
      icon: flagEmoji(dimValue(row, 1)),
    }));

    topPages = (pagesResp.rows || []).map((row) => ({
      title: dimValue(row, 0),
      views: fmtInt(metricValue(row, 0)),
    }));

    referrals = (sourceResp.rows || []).map((row) => ({
      name: dimValue(row, 0),
      value: fmtInt(metricValue(row, 0)),
      icon: sourceIcon(dimValue(row, 0)),
    }));

    channelLabels = (channelResp.rows || []).map((row) => dimValue(row, 0));
    channelValues = (channelResp.rows || []).map((row) => metricValue(row, 0));

    const deviceRows = deviceResp.rows || [];
    const deviceTotal = deviceRows.reduce((sum, row) => sum + metricValue(row, 0), 0) || 1;
    deviceLegend = deviceRows.map((row) => {
      const label = dimValue(row, 0);
      const percent = Math.round((metricValue(row, 0) / deviceTotal) * 100);
      return { label, percent: `${percent}%`, color: DEVICE_COLORS[label] || '#1f7ae0' };
    });

    deviceModels = (modelResp.rows || [])
      .filter((row) => dimValue(row, 0) !== '(not set)')
      .map((row) => ({ name: dimValue(row, 0), value: fmtInt(metricValue(row, 0)) }));

    screenResolutions = (resResp.rows || []).map((row) => ({ name: dimValue(row, 0), value: fmtInt(metricValue(row, 0)) }));

    const nvrRows = nvrResp.rows || [];
    const newRow = nvrRows.find((row) => dimValue(row, 0) === 'new');
    const returningRow = nvrRows.find((row) => dimValue(row, 0) === 'returning');
    const newCount = newRow ? metricValue(newRow, 0) : 0;
    const returningCount = returningRow ? metricValue(returningRow, 0) : 0;
    const nvrTotal = newCount + returningCount || 1;
    newVsReturning = {
      new: newCount,
      returning: returningCount,
      new_pct: Math.round((newCount / nvrTotal) * 100),
      returning_pct: Math.round((returningCount / nvrTotal) * 100),
    };
  } catch (err) {
    ga4Ok = false;
    warnings.push(`GA4 error: ${err.message}`);
  }

  try {
    const [totalResp, recentResp, pagesResp] = await Promise.all([
      runRealtimeReport(accessToken, propertyId, { metrics: [{ name: 'activeUsers' }] }),
      runRealtimeReport(accessToken, propertyId, {
        dimensions: [{ name: 'minutesAgo' }],
        metrics: [{ name: 'activeUsers' }],
        dimensionFilter: { filter: { fieldName: 'minutesAgo', numericFilter: { operation: 'LESS_THAN', value: { int64Value: '5' } } } },
      }),
      runRealtimeReport(accessToken, propertyId, {
        dimensions: [{ name: 'unifiedScreenName' }],
        metrics: [{ name: 'activeUsers' }],
        orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
        limit: 5,
      }),
    ]);

    const active30 = metricValue(totalResp.rows?.[0] || {}, 0);
    const active5 = (recentResp.rows || []).reduce((sum, row) => sum + metricValue(row, 0), 0);
    const topActivePages = (pagesResp.rows || []).map((row) => ({ title: dimValue(row, 0), activeUsers: String(metricValue(row, 0)) }));

    realtime = { active_30m: active30, active_5m: active5, recentActiveUsers: active30, top_pages: topActivePages };
  } catch (err) {
    warnings.push(`GA4 realtime error: ${err.message}`);
  }

  // ---------- Search Console ----------
  let gscSummary = { clicks: 0, impressions: 0, ctr: 0 };
  let gscLabels = [];
  let gscClicks = [];
  let gscImpressions = [];
  let gscPosition = [];
  let gscQueries = [];
  let gscPages = [];
  let gscOk = true;

  try {
    const [summaryResp, trendResp, queryResp, pageResp] = await Promise.all([
      searchAnalyticsQuery(accessToken, siteUrl, { startDate: rangeStart, endDate: rangeEnd }),
      searchAnalyticsQuery(accessToken, siteUrl, { startDate: rangeStart, endDate: rangeEnd, dimensions: ['date'] }),
      searchAnalyticsQuery(accessToken, siteUrl, { startDate: rangeStart, endDate: rangeEnd, dimensions: ['query'], rowLimit: 10 }),
      searchAnalyticsQuery(accessToken, siteUrl, { startDate: rangeStart, endDate: rangeEnd, dimensions: ['page'], rowLimit: 10 }),
    ]);

    const sumRow = summaryResp.rows?.[0];
    if (sumRow) gscSummary = { clicks: sumRow.clicks || 0, impressions: sumRow.impressions || 0, ctr: (sumRow.ctr || 0) * 100 };

    const trendRows = [...(trendResp.rows || [])].sort((a, b) => (a.keys[0] > b.keys[0] ? 1 : -1));
    for (const row of trendRows) {
      gscLabels.push(dateLabel(row.keys[0]));
      gscClicks.push(row.clicks || 0);
      gscImpressions.push(row.impressions || 0);
      gscPosition.push(Number((row.position || 0).toFixed(1)));
    }

    gscQueries = (queryResp.rows || []).map((row) => ({ label: row.keys[0], value: fmtInt(row.clicks) }));
    gscPages = (pageResp.rows || []).map((row) => ({ label: row.keys[0], value: fmtInt(row.clicks) }));
  } catch (err) {
    gscOk = false;
    warnings.push(`GSC error: ${err.message}`);
  }

  const sessionsChange = pctChange(overview.sessions, overviewPrev.sessions);
  const usersChange = pctChange(overview.totalUsers, overviewPrev.totalUsers);
  const viewsChange = pctChange(overview.screenPageViews, overviewPrev.screenPageViews);

  function changeFields(change) {
    if (change === null || Number.isNaN(change)) return {};
    return { change: `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`, direction: change >= 0 ? 'up' : 'down', tone: change >= 0 ? 'good' : 'bad' };
  }

  const overviewCards = [
    { label: '工作階段', value: fmtInt(overview.sessions), sub: 'GA4 sessions', ...changeFields(sessionsChange) },
    { label: '使用者', value: fmtInt(overview.totalUsers), sub: 'GA4 totalUsers', ...changeFields(usersChange) },
    { label: '瀏覽量', value: fmtInt(overview.screenPageViews), sub: 'GA4 screenPageViews', ...changeFields(viewsChange) },
  ];

  const gscCards = [
    { label: '搜尋點擊', value: fmtInt(gscSummary.clicks), sub: 'GSC clicks' },
    { label: '搜尋曝光', value: fmtInt(gscSummary.impressions), sub: 'GSC impressions' },
    { label: 'CTR', value: fmtPct(gscSummary.ctr), sub: 'GSC ctr' },
  ];

  const labels = ga4Labels.length ? ga4Labels : gscLabels;

  return {
    status: ga4Ok || gscOk ? 'ok' : 'error',
    statusLabel: ga4Ok && gscOk ? '資料已同步' : '部分來源失敗',
    statusMessage: warnings.length ? warnings.join(' | ') : 'GA4 與 GSC 指標已完成更新',
    rangeLabel: `近 28 天 (${rangeStart} ~ ${rangeEnd})`,
    gscSite: siteUrl,
    overviewCards,
    gscCards,
    countries,
    referrals,
    topPages,
    deviceLegend,
    deviceModels,
    screenResolutions,
    newVsReturning,
    charts: {
      labels,
      sessions: ga4Sessions,
      views: ga4Views,
      gscClicks,
      gscImpressions,
      gscPosition,
      channelLabels,
      channelValues,
      deviceLabels: deviceLegend.map((d) => d.label),
      deviceValues: deviceLegend.map((d) => Number(String(d.percent).replace('%', ''))),
      deviceColors: deviceLegend.map((d) => d.color),
    },
    realtime,
    gscQueries,
    gscPages,
    warnings,
  };
}

module.exports = { buildDashboardPayload };
