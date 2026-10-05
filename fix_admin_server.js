const fs = require('fs');

const envFile = '.env';
if (!fs.existsSync(envFile) || !fs.readFileSync(envFile, 'utf8').includes('TOURNAMENT_ADMIN_PASSWORD')) {
  fs.appendFileSync(envFile, '\nTOURNAMENT_ADMIN_PASSWORD=Admin@9988\n');
}

console.log('TOURNAMENT_ADMIN_PASSWORD set to Admin@9988 successfully!');
