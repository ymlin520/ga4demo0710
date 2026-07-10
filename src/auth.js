const { JWT } = require('google-auth-library');
const config = require('./config');

const SCOPES = [
  'https://www.googleapis.com/auth/analytics.readonly',
  'https://www.googleapis.com/auth/webmasters.readonly',
];

function createClient() {
  const key = require(config.serviceAccountKeyPath);
  return new JWT({
    email: key.client_email,
    key: key.private_key,
    scopes: SCOPES,
  });
}

module.exports = { createClient, SCOPES };
