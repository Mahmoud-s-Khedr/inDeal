const fs = require('fs');
const path = require('path');
const { socketContracts } = require('../src/core/contracts/socket/registry');

const files = [
  path.join(__dirname, '../src/infrastructure/sockets/chat.handler.js'),
  path.join(__dirname, '../src/infrastructure/socket.service.js'),
];

const source = files.map((f) => fs.readFileSync(f, 'utf8')).join('\n');

const extractEvents = (regex) => {
  const events = new Set();
  let match;
  while ((match = regex.exec(source)) !== null) {
    events.add(match[1]);
  }
  return events;
};

const receivedEvents = extractEvents(/socket\.on\('([^']+)'/g);
const sentEvents = extractEvents(/\.emit\('([^']+)'/g);

const receivedContracts = new Set(
  socketContracts.filter((c) => c.direction === 'receive').map((c) => c.event)
);
const sentContracts = new Set(
  socketContracts.filter((c) => c.direction === 'send').map((c) => c.event)
);

const missingReceive = [...receivedEvents].filter((e) => !receivedContracts.has(e));
const missingSend = [...sentEvents].filter((e) => !sentContracts.has(e));

if (missingReceive.length || missingSend.length) {
  console.error('Socket contract coverage verification failed.');
  if (missingReceive.length) {
    console.error('\nMissing receive contracts:');
    missingReceive.forEach((e) => console.error(`- ${e}`));
  }
  if (missingSend.length) {
    console.error('\nMissing send contracts:');
    missingSend.forEach((e) => console.error(`- ${e}`));
  }
  process.exit(1);
}

console.log(
  `Socket contract coverage verification passed (${receivedContracts.size} receive, ${sentContracts.size} send).`
);
