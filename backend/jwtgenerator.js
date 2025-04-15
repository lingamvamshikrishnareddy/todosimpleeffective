const crypto = require('crypto');

// Generate access token secret
const JWT_SECRET = crypto.randomBytes(64).toString('hex');
console.log('Access Token Secret:', JWT_SECRET);

// Generate refresh token secret
const JWT_REFRESH_SECRET = crypto.randomBytes(64).toString('hex');
console.log('Refresh Token Secret:', JWT_REFRESH_SECRET);

