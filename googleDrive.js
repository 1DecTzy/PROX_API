// const { google } = require('googleapis');
// const path = require('path');
// const dotenv = require('dotenv');
// const fs = require('fs');
// dotenv.config();

// // Path to your service account key file
// const SERVICE_ACCOUNT_KEY_FILE = path.resolve(process.env.SERVICE_ACCOUNT_KEY_FILE);
// const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_KEY_FILE, 'utf8'));

// const auth = new google.auth.GoogleAuth({
//   credentials: serviceAccount,
//   scopes: ['https://www.googleapis.com/auth/drive.file'],
// });

// const drive = google.drive({ version: 'v3', auth });

// module.exports = drive;

const { google } = require('googleapis');
const { JWT } = require('google-auth-library');

// Debugging statements to check environment variables
console.log('TYPE:', process.env.TYPE);
console.log('PROJECT_ID:', process.env.PROJECT_ID);
console.log('PRIVATE_KEY_ID:', process.env.PRIVATE_KEY_ID);
console.log('PRIVATE_KEY:', process.env.PRIVATE_KEY ? 'Exists' : 'Undefined');
console.log('CLIENT_EMAIL:', process.env.CLIENT_EMAIL);
console.log('CLIENT_ID:', process.env.CLIENT_ID);
console.log('AUTH_URI:', process.env.AUTH_URI);
console.log('TOKEN_URI:', process.env.TOKEN_URI);
console.log('AUTH_PROVIDER_X509_CERT_URL:', process.env.AUTH_PROVIDER_X509_CERT_URL);
console.log('CLIENT_X509_CERT_URL:', process.env.CLIENT_X509_CERT_URL);

const privateKey = process.env.PRIVATE_KEY ? process.env.PRIVATE_KEY.replace(/\\n/g, '\n') : null;

if (!privateKey) {
  console.error('Error: PRIVATE_KEY environment variable is not set or is undefined.');
  process.exit(1);
}

const apikey = {
  type: process.env.TYPE,
  project_id: process.env.PROJECT_ID,
  private_key_id: process.env.PRIVATE_KEY_ID,
  private_key: privateKey,
  client_email: process.env.CLIENT_EMAIL,
  client_id: process.env.CLIENT_ID,
  auth_uri: process.env.AUTH_URI,
  token_uri: process.env.TOKEN_URI,
  auth_provider_x509_cert_url: process.env.AUTH_PROVIDER_X509_CERT_URL,
  client_x509_cert_url: process.env.CLIENT_X509_CERT_URL,
};

const auth = new google.auth.GoogleAuth({
  credentials: apikey,
  scopes: ['https://www.googleapis.com/auth/drive'],
});

const drive = google.drive({ version: 'v3', auth });

module.exports = drive;
