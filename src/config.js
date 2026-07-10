const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const port = Number(process.env.PORT) || 4300;

module.exports = {
  port,
  ga4PropertyId: process.env.GA4_PROPERTY_ID,
  gscSiteUrl: process.env.GSC_SITE_URL,
  serviceAccountKeyPath: path.join(__dirname, '..', 'service-account.json'),
};
