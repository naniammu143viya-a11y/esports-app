const http = require('http');
// Let's check if the server main file exists and can be required without crash
try {
  const app = require('./index.js'); // or check server file
  console.log('Server file loaded successfully!');
} catch (e) {
  console.error('SERVER LOAD ERROR:', e.message);
}
