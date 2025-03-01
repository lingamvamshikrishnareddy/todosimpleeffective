const crypto = require('crypto');

// Generate a random JWT secret
const JWT_SECRET = crypto.randomBytes(64).toString('hex');

console.log('Your JWT Secret for testing:');
console.log(JWT_SECRET);