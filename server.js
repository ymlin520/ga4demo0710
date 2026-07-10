const path = require('path');
const express = require('express');
const config = require('./src/config');
const { createClient } = require('./src/auth');
const { buildDashboardPayload } = require('./src/normalize');

const app = express();
const authClient = createClient();

let cache = null;
let cacheAt = 0;
const CACHE_MS = 10 * 60 * 1000;

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/dashboard', async (req, res) => {
  try {
    const fresh = req.query.refresh === '1';
    if (!cache || fresh || Date.now() - cacheAt > CACHE_MS) {
      cache = await buildDashboardPayload(authClient, {
        propertyId: config.ga4PropertyId,
        siteUrl: config.gscSiteUrl,
      });
      cacheAt = Date.now();
    }
    res.json(cache);
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.listen(config.port, () => {
  console.log(`GA4 + GSC dashboard running at http://localhost:${config.port}`);
});
