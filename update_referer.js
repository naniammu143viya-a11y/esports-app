const fs = require('fs');
const glob = require('glob');

const files = [
  './artifacts/api-server/src/routes/auth.ts',
  './artifacts/api-server/src/lib/auth.ts',
  './lib/api-client-react/src/custom-fetch.ts',
  './artifacts/bgmi-tournament/context/TournamentContext.tsx'
];

files.forEach(filePath => {
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    // Normalize Referer header handling
    content = content.replace(/Referer['"]?\s*:\s*['"][^'"]+['"]/g, `'Referer': 'https://replit.com'`);
    content = content.replace(/Referrer['"]?\s*:\s*['"][^'"]+['"]/g, `'Referer': 'https://replit.com'`);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${filePath}`);
  }
});
