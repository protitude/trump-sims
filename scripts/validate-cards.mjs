// Checks a JSON file of duty cards against the rules the game expects.
// Usage: node scripts/validate-cards.mjs src/game/cards/<file>.json [expectedCount]
// guests.json (the Mar-a-Lago guests) has its own, simpler shape and is checked separately.

import { readFileSync } from 'node:fs';

const [file, expected] = process.argv.slice(2);
if (!file) {
  console.error('usage: node scripts/validate-cards.mjs <file.json> [expectedCount]');
  process.exit(2);
}

const KINDS = ['briefing', 'decision', 'press', 'call', 'crisis', 'hybrid'];
const errors = [];
let cards;
try {
  cards = JSON.parse(readFileSync(file, 'utf8'));
} catch (e) {
  console.error(`Not valid JSON: ${e.message}`);
  process.exit(1);
}
if (!Array.isArray(cards)) {
  console.error('Top level must be an array of cards.');
  process.exit(1);
}

const seen = new Set();
const titles = new Set();
const within = (n, lo, hi) => typeof n === 'number' && Number.isInteger(n) && n >= lo && n <= hi;
const text = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;

// Guests at Mar-a-Lago: a parody name, an ask, and what taking the coin gives.
if (cards.some((card) => card?.exposed !== undefined)) {
  cards.forEach((guest, index) => {
    const bad = (message) => errors.push(`#${index + 1} (${guest?.id ?? 'no id'}): ${message}`);
    if (!/^guest(-[a-z0-9]+)+$/.test(guest.id ?? '')) bad('id must be kebab-case and start with "guest-"');
    if (seen.has(guest.id)) bad('duplicate id');
    seen.add(guest.id);
    if (titles.has(guest.title)) bad('duplicate title');
    titles.add(guest.title);
    if (!['ceo', 'media'].includes(guest.kind)) bad('kind must be ceo or media');
    if (!text(guest.title, 40)) bad('title missing or longer than 40 characters');
    if (!text(guest.text, 190)) bad('text missing or longer than 190 characters');
    if (!text(guest.result, 190)) bad('result missing or longer than 190 characters');
    if (!text(guest.exposed, 190)) bad('exposed missing or longer than 190 characters');
    if (!text(guest.inspiredBy, 200)) bad('inspiredBy missing or longer than 200 characters');
    // The parody name is all the game shows; the real one stays in inspiredBy.
    const shown = `${guest.title} ${guest.text} ${guest.result} ${guest.exposed}`.toLowerCase();
    const surname = String(guest.inspiredBy ?? '').trim().split(/\s+/).pop().toLowerCase();
    if (surname.length > 3 && shown.includes(surname)) bad(`real surname "${surname}" appears in the shown text`);
    const fx = guest.effects ?? {};
    for (const key of Object.keys(fx)) if (!['ego', 'stability', 'coin'].includes(key)) bad(`unknown effect "${key}"`);
    if (!within(fx.ego, 5, 9)) bad('ego must be 5..9');
    if (!within(fx.stability, 4, 10)) bad('stability must be 4..10');
    if (!within(fx.coin, 1, 5)) bad('coin must be 1..5');
  });
  if (expected && cards.length !== Number(expected)) errors.push(`expected ${expected} guests, found ${cards.length}`);
  if (errors.length > 0) {
    console.error(`${errors.length} problem(s) in ${file}:`);
    for (const e of errors) console.error(`  ${e}`);
    process.exit(1);
  }
  console.log(`OK: ${cards.length} guests in ${file}`);
  process.exit(0);
}

cards.forEach((card, index) => {
  const where = `#${index + 1} (${card?.id ?? 'no id'})`;
  const bad = (message) => errors.push(`${where}: ${message}`);
  if (typeof card !== 'object' || card === null) return bad('not an object');

  if (!/^[a-z0-9]+(-[a-z0-9]+)+$/.test(card.id ?? '')) bad('id must be lowercase-kebab-case with a prefix');
  if (seen.has(card.id)) bad('duplicate id');
  seen.add(card.id);
  if (titles.has(card.title)) bad('duplicate title');
  titles.add(card.title);

  if (!KINDS.includes(card.kind)) return bad(`kind must be one of ${KINDS.join(', ')}`);
  if (!text(card.title, 48)) bad('title missing or longer than 48 characters');
  if (!text(card.text, 190)) bad('text missing or longer than 190 characters');
  if (card.kind === 'crisis' && !card.title?.startsWith('CRISIS: ')) bad('crisis titles start with "CRISIS: "');
  if (card.kind === 'hybrid' && !card.title?.startsWith('OPPORTUNITY: ')) bad('hybrid titles start with "OPPORTUNITY: "');
  if (!text(card.inspiredBy, 200)) bad('inspiredBy missing or longer than 200 characters');

  const single = ['briefing', 'crisis', 'hybrid'].includes(card.kind);
  const maxCost = card.kind === 'crisis' || card.kind === 'hybrid' ? 3 : 2;
  const minCost = card.kind === 'briefing' ? 2 : card.kind === 'crisis' ? 3 : card.kind === 'hybrid' ? 2 : 1;
  if (!within(card.cost, minCost, maxCost)) bad(`cost must be ${minCost}..${maxCost} for ${card.kind}`);

  if (!Array.isArray(card.options) || card.options.length !== (single ? 1 : 2)) {
    return bad(`${card.kind} cards need exactly ${single ? 1 : 2} option(s)`);
  }
  card.options.forEach((option, i) => {
    if (!text(option.label, 46)) bad(`option ${i} label missing or longer than 46 characters`);
    if (!text(option.result, 160)) bad(`option ${i} result missing or longer than 160 characters`);
    const fx = option.effects ?? {};
    for (const key of Object.keys(fx)) {
      if (!['ego', 'stability', 'gold', 'names'].includes(key)) bad(`option ${i} has unknown effect "${key}"`);
    }
    const ego = fx.ego ?? 0;
    const stability = fx.stability ?? 0;
    if (card.kind === 'hybrid') {
      if (!within(ego, 6, 12) || !within(stability, 6, 12)) bad('hybrid needs ego 6..12 and stability 6..12');
    } else if (card.kind === 'crisis') {
      if (!within(stability, 9, 11) || !within(ego, -8, -5)) bad('crisis needs stability 9..11 and ego -8..-5');
    } else if (i === 0) {
      const big = card.cost === 2;
      if (!within(stability, big ? 8 : 4, big ? 10 : 7)) bad(`option 0 stability out of range for cost ${card.cost}`);
      if (!within(ego, -5, -2)) bad('option 0 ego must be -5..-2');
    } else {
      const big = card.cost === 2;
      if (!within(ego, big ? 5 : 3, big ? 8 : 7)) bad(`option 1 ego out of range for cost ${card.cost}`);
      if (!within(stability, -8, -2)) bad('option 1 stability must be -8..-2');
    }
    if (fx.gold !== undefined && !within(fx.gold, 1, 2)) bad('gold must be 1..2');
    if (fx.names !== undefined && !within(fx.names, 1, 1)) bad('names must be 1');
  });

  const ignore = card.ignore ?? {};
  if (!text(ignore.text, 130)) bad('ignore.text missing or longer than 130 characters');
  if (card.kind === 'hybrid') {
    if (ignore.stability !== 0) bad('hybrid ignore.stability must be 0');
  } else if (card.kind === 'crisis') {
    if (ignore.stability !== -18) bad('crisis ignore.stability must be -18');
  } else if (!within(ignore.stability, -7, -2)) bad('ignore.stability must be -7..-2');
});

if (expected && cards.length !== Number(expected)) errors.push(`expected ${expected} cards, found ${cards.length}`);

if (errors.length > 0) {
  console.error(`${errors.length} problem(s) in ${file}:`);
  for (const e of errors) console.error(`  ${e}`);
  process.exit(1);
}
const counts = {};
for (const card of cards) counts[card.kind] = (counts[card.kind] ?? 0) + 1;
console.log(`OK: ${cards.length} cards in ${file}`, counts);
