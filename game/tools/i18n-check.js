const { readFileSync, readdirSync } = require('node:fs');
const { join } = require('node:path');
const root = join(__dirname, '..');
const keys = new Set();
const errors = [];
for (const name of readdirSync(join(root, 'src')).filter(name => /\.tsx?$/.test(name))) {
  const source = readFileSync(join(root, 'src', name), 'utf8');
  for (const match of source.matchAll(/\bt\(\s*(['"])([a-z0-9_.]+)\1/g)) keys.add(match[2]);
}
function placeholders(value) {
  return [...new Set([...value.matchAll(/\{([a-z][a-z0-9_]*)\}/gi)].map(match => match[1]))].sort().join(',');
}
const catalogs = {};
for (const locale of ['ru', 'en']) {
  const catalog = catalogs[locale] = JSON.parse(readFileSync(join(root, 'i18n', locale + '.json'), 'utf8'));
  for (const key of keys) {
    if (!Object.hasOwn(catalog, key)) errors.push(locale + ': missing ' + key);
  }
  for (const [key, message] of Object.entries(catalog)) {
    if (!keys.has(key)) errors.push(locale + ': unused ' + key);
    if (typeof message === 'string') continue;
    const categories = new Intl.PluralRules(locale).resolvedOptions().pluralCategories;
    if (!message || Object.keys(message).length !== categories.length || categories.some(category => typeof message[category] !== 'string')) {
      errors.push(locale + ': invalid plural forms for ' + key);
    } else if (Object.values(message).some(value => placeholders(value) !== placeholders(message.other))) {
      errors.push(locale + ': inconsistent placeholders for ' + key);
    }
  }
}
for (const key of keys) {
  const { ru, en } = catalogs;
  if (!Object.hasOwn(ru, key) || !Object.hasOwn(en, key)) continue;
  if (typeof ru[key] !== typeof en[key] ||
      placeholders(typeof ru[key] === 'string' ? ru[key] : ru[key]?.other ?? '') !==
      placeholders(typeof en[key] === 'string' ? en[key] : en[key]?.other ?? '')) {
    errors.push('RU/EN: different placeholders or plural shape for ' + key);
  }
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(keys.size + ' keys are present in RU and EN');
}
