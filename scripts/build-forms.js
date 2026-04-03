const fs = require('fs');
const path = require('path');

const pairs = [
  ['public/questionnaire.template.html', 'public/questionnaire.html'],
  ['public/enquire.template.html', 'public/enquire.html'],
];

pairs.forEach(([fromRel, toRel]) => {
  const from = path.join(__dirname, '..', fromRel);
  const to = path.join(__dirname, '..', toRel);
  fs.copyFileSync(from, to);
  console.log(`Built ${toRel}`);
});
