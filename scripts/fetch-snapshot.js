const fs = require('fs');
const path = require('path');
const config = require('../src/config');
const { createClient } = require('../src/auth');
const { buildDashboardPayload } = require('../src/normalize');

(async () => {
  const authClient = createClient();
  const data = await buildDashboardPayload(authClient, {
    propertyId: config.ga4PropertyId,
    siteUrl: config.gscSiteUrl,
  });
  const outPath = path.join(__dirname, '..', 'payload.live.json');
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2));
  console.log('Saved snapshot to', outPath);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
