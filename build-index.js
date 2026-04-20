// Run locally to rebuild the game index: node build-index.js
// Fetches all game listings from Vimm's Lair and saves to public/games-index.json

const fetch = require('node-fetch');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const VIMM_BASE = 'https://vimm.net';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'Accept-Encoding': 'gzip, deflate',
  'Referer': 'https://vimm.net/',
};

const SYSTEMS = [
  { code: 'NES',       name: 'NES' },
  { code: 'SNES',      name: 'SNES' },
  { code: 'N64',       name: 'Nintendo 64' },
  { code: 'GameCube',  name: 'GameCube' },
  { code: 'Wii',       name: 'Wii' },
  { code: 'GB',        name: 'Game Boy' },
  { code: 'GBC',       name: 'Game Boy Color' },
  { code: 'GBA',       name: 'Game Boy Advance' },
  { code: 'DS',        name: 'Nintendo DS' },
  { code: '3DS',       name: '3DS' },
  { code: 'SMS',       name: 'Master System' },
  { code: 'Genesis',   name: 'Genesis' },
  { code: 'SegaCD',    name: 'Sega CD' },
  { code: '32X',       name: '32X' },
  { code: 'Saturn',    name: 'Saturn' },
  { code: 'Dreamcast', name: 'Dreamcast' },
  { code: 'GG',        name: 'Game Gear' },
  { code: 'PS1',       name: 'PlayStation' },
  { code: 'PS2',       name: 'PlayStation 2' },
  { code: 'PS3',       name: 'PlayStation 3' },
  { code: 'PSP',       name: 'PSP' },
  { code: 'Xbox',      name: 'Xbox' },
  { code: 'Xbox360',   name: 'Xbox 360' },
  { code: 'Jaguar',    name: 'Jaguar' },
  { code: 'TG16',      name: 'TurboGrafx-16' },
  { code: 'Lynx',      name: 'Lynx' },
  { code: 'CDi',       name: 'CD-i' },
];

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ#'.split('').map(l => l === '#' ? '%23' : l);

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function fetchPage(url, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, { headers: HEADERS });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (e) {
      if (i === retries) return null;
      await sleep(1000);
    }
  }
}

function parseGames(html, systemCode, systemName) {
  if (!html) return [];
  const $ = cheerio.load(html);
  const games = [];
  $('table tr').each((_, row) => {
    const titleCell = $(row).find('td').first();
    const a = titleCell.find('a[href^="/vault/"]').first();
    const href = a.attr('href');
    if (!href) return;
    const match = href.match(/^\/vault\/(\d+)$/);
    if (!match) return;
    const title = a.text().trim();
    if (!title) return;
    // Check for the 'T' translation badge (<b class="redBorder">T</b>)
    const isTranslation = titleCell.find('b.redBorder').text().trim() === 'T';
    if (isTranslation) return;
    const ratingText = $(row).find('td').last().find('a').text().trim();
    const rating = ratingText || null;
    games.push({ id: match[1], title, system: systemCode, systemName, rating });
  });
  return games;
}

async function buildIndex() {
  const allGames = [];
  let total = 0;

  for (const sys of SYSTEMS) {
    process.stdout.write(`\n${sys.code} `);
    const sysGames = [];

    // Fetch letters with limited concurrency (5 at a time)
    for (let i = 0; i < LETTERS.length; i += 5) {
      const batch = LETTERS.slice(i, i + 5);
      const results = await Promise.all(batch.map(async letter => {
        const url = `${VIMM_BASE}/vault/${sys.code}/${letter}`;
        const html = await fetchPage(url);
        return parseGames(html, sys.code, sys.name);
      }));
      results.forEach(games => sysGames.push(...games));
      process.stdout.write('.');
      await sleep(200);
    }

    allGames.push(...sysGames);
    total += sysGames.length;
    process.stdout.write(` ${sysGames.length} games`);
  }

  console.log(`\n\nTotal: ${total} games`);

  const out = path.join(__dirname, 'public', 'games-index.json');
  fs.writeFileSync(out, JSON.stringify({ built: new Date().toISOString(), games: allGames }));
  console.log(`Saved to ${out}`);
}

buildIndex().catch(console.error);
