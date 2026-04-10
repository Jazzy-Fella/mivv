const express = require('express');
const fetch = require('node-fetch');
const cheerio = require('cheerio');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

const VIMM_BASE = 'https://vimm.net';
const VIMM_DL = 'https://dl.vimm.net';
const LIBRETRO_BASE = 'https://raw.githubusercontent.com/libretro-thumbnails';

// Maps Vimm system codes to libretro-thumbnails repo folder names
const LIBRETRO_SYSTEMS = {
  NES:       'Nintendo_-_Nintendo_Entertainment_System',
  SNES:      'Nintendo_-_Super_Nintendo_Entertainment_System',
  N64:       'Nintendo_-_Nintendo_64',
  GameCube:  'Nintendo_-_GameCube',
  Wii:       'Nintendo_-_Wii',
  GB:        'Nintendo_-_Game_Boy',
  GBC:       'Nintendo_-_Game_Boy_Color',
  GBA:       'Nintendo_-_Game_Boy_Advance',
  DS:        'Nintendo_-_Nintendo_DS',
  '3DS':     'Nintendo_-_Nintendo_3DS',
  VB:        'Nintendo_-_Virtual_Boy',
  SMS:       'Sega_-_Master_System_-_Mark_III',
  Genesis:   'Sega_-_Mega_Drive_-_Genesis',
  SegaCD:    'Sega_-_Mega-CD_-_Sega_CD',
  '32X':     'Sega_-_32X',
  Saturn:    'Sega_-_Saturn',
  Dreamcast: 'Sega_-_Dreamcast',
  GG:        'Sega_-_Game_Gear',
  PS1:       'Sony_-_PlayStation',
  PS2:       'Sony_-_PlayStation_2',
  PS3:       'Sony_-_PlayStation_3',
  PSP:       'Sony_-_PlayStation_Portable',
  Xbox:      'Microsoft_-_Xbox',
  Xbox360:   'Microsoft_-_Xbox_360',
  Atari2600: 'Atari_-_2600',
  Atari5200: 'Atari_-_5200',
  Atari7800: 'Atari_-_7800',
  Jaguar:    'Atari_-_Jaguar',
  TG16:      'NEC_-_PC_Engine_-_TurboGrafx_16',
  TGCD:      'NEC_-_PC_Engine_CD_-_TurboGrafx-CD',
  Lynx:      'Atari_-_Lynx',
};

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'Accept-Encoding': 'gzip, deflate',
  'Referer': 'https://vimm.net/',
  'Connection': 'keep-alive',
};

const SYSTEMS = [
  // Consoles
  { code: 'NES',       name: 'NES',              group: 'Consoles' },
  { code: 'SNES',      name: 'SNES',             group: 'Consoles' },
  { code: 'N64',       name: 'Nintendo 64',       group: 'Consoles' },
  { code: 'GameCube',  name: 'GameCube',          group: 'Consoles' },
  { code: 'Wii',       name: 'Wii',              group: 'Consoles' },
  { code: 'WiiWare',   name: 'WiiWare',          group: 'Consoles' },
  { code: 'SMS',       name: 'Master System',     group: 'Consoles' },
  { code: 'Genesis',   name: 'Genesis',          group: 'Consoles' },
  { code: 'SegaCD',    name: 'Sega CD',          group: 'Consoles' },
  { code: '32X',       name: '32X',              group: 'Consoles' },
  { code: 'Saturn',    name: 'Saturn',           group: 'Consoles' },
  { code: 'Dreamcast', name: 'Dreamcast',        group: 'Consoles' },
  { code: 'PS1',       name: 'PlayStation',      group: 'Consoles' },
  { code: 'PS2',       name: 'PlayStation 2',    group: 'Consoles' },
  { code: 'PS3',       name: 'PlayStation 3',    group: 'Consoles' },
  { code: 'Xbox',      name: 'Xbox',             group: 'Consoles' },
  { code: 'Xbox360',   name: 'Xbox 360',          group: 'Consoles' },
  { code: 'X360-D',   name: 'Xbox 360 Digital',  group: 'Consoles' },
  { code: 'Atari2600', name: 'Atari 2600',       group: 'Consoles' },
  { code: 'Atari5200', name: 'Atari 5200',       group: 'Consoles' },
  { code: 'Atari7800', name: 'Atari 7800',       group: 'Consoles' },
  { code: 'Jaguar',    name: 'Jaguar',           group: 'Consoles' },
  { code: 'JaguarCD',  name: 'Jaguar CD',        group: 'Consoles' },
  { code: 'TG16',      name: 'TurboGrafx-16',    group: 'Consoles' },
  { code: 'TGCD',      name: 'TurboGrafx-CD',    group: 'Consoles' },
  { code: 'CDi',       name: 'CD-i',             group: 'Consoles' },
  // Handhelds
  { code: 'GB',        name: 'Game Boy',         group: 'Handhelds' },
  { code: 'GBC',       name: 'Game Boy Color',   group: 'Handhelds' },
  { code: 'GBA',       name: 'Game Boy Advance', group: 'Handhelds' },
  { code: 'DS',        name: 'Nintendo DS',      group: 'Handhelds' },
  { code: '3DS',       name: '3DS',              group: 'Handhelds' },
  { code: 'GG',        name: 'Game Gear',        group: 'Handhelds' },
  { code: 'Lynx',      name: 'Lynx',             group: 'Handhelds' },
  { code: 'VB',        name: 'Virtual Boy',      group: 'Handhelds' },
  { code: 'PSP',       name: 'PSP',              group: 'Handhelds' },
];

// Serve sw.js with correct headers so it can control the root scope
app.get('/sw.js', (req, res) => {
  res.set('Service-Worker-Allowed', '/');
  res.set('Cache-Control', 'no-cache');
  res.sendFile(path.join(__dirname, 'public', 'sw.js'));
});

app.use(express.static(path.join(__dirname, 'public')));

// Return systems list for frontend dropdown
app.get('/api/systems', (req, res) => {
  const sorted = [...SYSTEMS].sort((a, b) =>
    a.group.localeCompare(b.group) || a.name.localeCompare(b.name)
  );
  res.json(sorted);
});

// Search games
// Browse all games for a system A-Z
app.get('/api/browse/:system', (req, res) => {
  const { system } = req.params;
  const sysObj = SYSTEMS.find(s => s.code === system);
  if (!sysObj) return res.status(404).json({ error: 'Unknown system' });
  const games = getIndex()
    .filter(g => g.system === system)
    .sort((a, b) => a.title.localeCompare(b.title));
  res.json({ system: sysObj.code, name: sysObj.name, total: games.length, games });
});

app.get('/api/search', (req, res) => {
  const { q, system } = req.query;
  if (!q || q.trim().length < 2) return res.json([]);
  try {
    res.json(searchGames(q.trim(), system));
  } catch (err) {
    console.error('Search error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Get game details
app.get('/api/game/:id', async (req, res) => {
  const { id } = req.params;
  if (!/^\d+$/.test(id)) return res.status(400).json({ error: 'Invalid ID' });

  try {
    const game = await getGameDetails(id);
    res.json(game);
  } catch (err) {
    console.error('Game detail error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Vimm's placeholder "no image" PNG is always exactly 579 bytes (with webp Accept header)
const VIMM_PLACEHOLDER_SIZE = 579;

// Image proxy — avoids CORS issues loading dl.vimm.net images in browser
app.get('/api/image', async (req, res) => {
  const { id } = req.query;
  if (!id || !/^\d+$/.test(id)) return res.status(400).send('Invalid ID');

  const url = `${VIMM_DL}/image.php?type=box&id=${id}`;

  try {
    const imgRes = await fetch(url, { headers: HEADERS });
    if (!imgRes.ok) return res.status(404).send('No boxart');

    // Buffer the response so we can check if it's the placeholder
    const buffer = await imgRes.buffer();
    if (buffer.length === VIMM_PLACEHOLDER_SIZE) {
      return res.status(404).send('No boxart');
    }

    const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(buffer);
  } catch (err) {
    res.status(500).send('Image fetch failed');
  }
});

// Download proxy — POSTs to Vimm's download server and streams the file back
app.get('/api/download', async (req, res) => {
  const { mediaId } = req.query;
  if (!mediaId || !/^\d+$/.test(mediaId)) return res.status(400).send('Invalid mediaId');

  try {
    const dlRes = await fetch(`https://dl3.vimm.net/?mediaId=${mediaId}`, {
      method: 'GET',
      headers: {
        ...HEADERS,
        'Referer': 'https://vimm.net/',
      },
    });

    if (!dlRes.ok) return res.status(dlRes.status).send('Download failed');

    // Forward filename from Content-Disposition if present, else use generic name
    const disposition = dlRes.headers.get('content-disposition') || '';
    const contentType = dlRes.headers.get('content-type') || 'application/octet-stream';
    res.set('Content-Type', contentType);
    res.set('Content-Disposition', disposition || `attachment; filename="game_${mediaId}.zip"`);
    const contentLength = dlRes.headers.get('content-length');
    if (contentLength) res.set('Content-Length', contentLength);
    dlRes.body.pipe(res);
  } catch (err) {
    console.error('Download error:', err.message);
    res.status(500).send('Download failed');
  }
});

// Screenshot proxy — tries candidate filenames in parallel across common region/lang patterns
app.get('/api/screenshot', async (req, res) => {
  const { title, system, imgtype } = req.query;
  if (!title || !system) return res.status(400).send('Missing params');

  const folder = LIBRETRO_SYSTEMS[system];
  if (!folder) return res.status(404).send('System not mapped');

  const kind = imgtype === 'snap' ? 'Named_Snaps' : 'Named_Titles';
  const base = `${LIBRETRO_BASE}/${folder}/master/${kind}`;

  // Normalise title: colon → ' -'
  const t = title.replace(/:\s*/g, ' - ').replace(/\s+/g, ' ').trim();

  // Candidate suffixes in rough priority order (regions + common language tags)
  const suffixes = [
    '(USA)', '(USA) (En)', '(USA, Europe)', '(USA, Europe) (En)',
    '(USA, Europe, Brazil) (En)', '(USA, Europe, Brazil)',
    '(USA, Europe, Japan)', '(USA, Europe, Japan) (En)',
    '(Europe)', '(Europe) (En)', '(Europe, Brazil) (En)',
    '(Japan)', '(Japan) (En,Ja)', '(World)', '(World) (En)',
    '(USA) (Rev 1)', '(USA) (Rev 01)', '(USA) (v1.1)',
    '',
  ];

  const candidates = suffixes.map(s =>
    s ? `${t} ${s}.png` : `${t}.png`
  );

  // Race all HEAD requests — return first hit
  try {
    const result = await new Promise((resolve, reject) => {
      let pending = candidates.length;
      let resolved = false;
      candidates.forEach((filename, i) => {
        const url = `${base}/${encodeURIComponent(filename)}`;
        fetch(url, { method: 'HEAD' })
          .then(r => {
            if (r.ok && !resolved) { resolved = true; resolve({ url, filename }); }
            else if (--pending === 0 && !resolved) reject(new Error('not found'));
          })
          .catch(() => { if (--pending === 0 && !resolved) reject(new Error('not found')); });
      });
    });

    const imgRes = await fetch(result.url);
    if (!imgRes.ok) return res.status(404).send('Screenshot not found');
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'public, max-age=86400');
    imgRes.body.pipe(res);
  } catch {
    res.status(404).send('Screenshot not found');
  }
});

// ── Game index (pre-built locally, used for search on Vercel) ───────────────
let gameIndex = null;
function getIndex() {
  if (!gameIndex) {
    try {
      const data = require('./public/games-index.json');
      gameIndex = data.games;
    } catch {
      gameIndex = [];
    }
  }
  return gameIndex;
}

// ── Scraping helpers ────────────────────────────────────────────────────────

async function fetchPage(url) {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

function getLetter(query) {
  const first = query[0].toUpperCase();
  return /[0-9]/.test(first) ? '%23' : first;
}

function searchGames(query, system) {
  const qLower = query.toLowerCase();
  const games = getIndex();

  let results = games.filter(g => {
    if (system && system !== '0' && g.system !== system) return false;
    return g.title.toLowerCase().includes(qLower);
  });

  // Sort: exact start matches first, then alphabetical
  results.sort((a, b) => {
    const aStarts = a.title.toLowerCase().startsWith(qLower);
    const bStarts = b.title.toLowerCase().startsWith(qLower);
    if (aStarts && !bStarts) return -1;
    if (!aStarts && bStarts) return 1;
    return a.title.localeCompare(b.title);
  });

  return results.slice(0, 60);
}

function parseGameList(html, systemCode) {
  const $ = cheerio.load(html);
  const systemName = SYSTEMS.find(s => s.code === systemCode)?.name || systemCode;
  const games = [];

  $('table tr').each((_, row) => {
    const titleCell = $(row).find('td').first();
    const link = titleCell.find('a[href^="/vault/"]').first();
    const href = link.attr('href');
    if (!href) return;

    const match = href.match(/^\/vault\/(\d+)$/);
    if (!match) return;

    const title = link.text().trim();
    if (!title) return;

    // Skip fan translations (marked with <b class="redBorder">T</b>)
    if (titleCell.find('b.redBorder').text().trim() === 'T') return;

    const ratingCell = $(row).find('td').last().find('a');
    const rating = ratingCell.text().trim() || null;

    const regions = [];
    $(row).find('img[src*="/images/flags/"]').each((_, img) => {
      const src = $(img).attr('src') || '';
      const region = src.replace('/images/flags/', '').replace('.png', '');
      regions.push(region);
    });

    games.push({ id: match[1], title, system: systemCode, systemName, rating, regions });
  });

  return games;
}

async function getGameDetails(id) {
  const url = `${VIMM_BASE}/vault/${id}`;
  const html = await fetchPage(url);
  const $ = cheerio.load(html);

  // Page title: "The Vault: Sonic The Hedgehog (SMS)"
  const rawPageTitle = $('title').text().trim()
    .replace(/^The Vault\s*[:\-–]\s*/i, '').trim();

  // Extract system code from trailing (CODE) — e.g. "(SMS)", "(NES)"
  let systemCode = '';
  let systemName = '';
  let title = rawPageTitle;
  const sysCodeMatch = rawPageTitle.match(/\(([A-Za-z0-9\-]+)\)$/);
  if (sysCodeMatch) {
    const candidate = sysCodeMatch[1];
    const found = SYSTEMS.find(s => s.code === candidate);
    if (found) {
      systemCode = found.code;
      systemName = found.name;
      title = rawPageTitle.replace(/\s*\([A-Za-z0-9\-]+\)$/, '').trim();
    }
  }
  // Also try finding the system from the nav link if not found yet
  if (!systemCode) {
    $('a[href^="/vault/"]').each((_, a) => {
      const href = $(a).attr('href') || '';
      const m = href.match(/^\/vault\/([A-Za-z0-9\-]+)\/?$/);
      if (m) {
        const found = SYSTEMS.find(s => s.code === m[1]);
        if (found) {
          systemCode = found.code;
          systemName = found.name;
          return false;
        }
      }
    });
  }

  // Metadata from table rows — structure is 3 cells: key | spacer | value
  const meta = {};
  $('table').first().find('tr').each((_, row) => {
    const cells = $(row).find('td');
    if (cells.length === 3) {
      const key = $(cells[0]).text().trim().replace(/:$/, '').toLowerCase();
      const val = $(cells[2]).text().trim();
      if (key && val && val.length < 200) meta[key] = val;
    } else if (cells.length === 2) {
      const key = $(cells[0]).text().trim().replace(/:$/, '').toLowerCase();
      const val = $(cells[1]).text().trim();
      if (key && val && val.length < 200) meta[key] = val;
    }
  });

  // Parse let media=[...] JS for version and file size
  const mediaMatch = html.match(/let\s+media\s*=\s*(\[[\s\S]*?\]);/);
  if (mediaMatch) {
    try {
      const mediaArr = JSON.parse(mediaMatch[1]);
      const entry = mediaArr[0];
      if (entry) {
        if (!meta['version'] && entry.Version) meta['version'] = entry.Version;
        if (!meta['file size'] && entry.Zipped) meta['file size'] = `${entry.Zipped} KB`;
        if (entry.ID) meta['mediaId'] = String(entry.ID);
      }
    } catch {}
  }

  // Also try to get mediaId from the download form directly
  if (!meta['mediaId']) {
    const mediaIdMatch = html.match(/name="mediaId"\s+value="(\d+)"/);
    if (mediaIdMatch) meta['mediaId'] = mediaIdMatch[1];
  }

  // Ratings — look in meta or dedicated rating elements
  const ratings = {};
  ['graphics', 'sound', 'gameplay', 'overall'].forEach(label => {
    const raw = meta[label] || '';
    if (raw) ratings[label] = raw.replace(/\s*\(.*$/, '').trim();
  });

  // Regions from flag images
  const regions = [];
  $('img[src*="/images/flags/"]').each((_, img) => {
    const src = $(img).attr('src') || '';
    const region = src.replace('/images/flags/', '').replace('.png', '');
    if (region && !regions.includes(region)) regions.push(region);
  });

  // Screenshots — check JS and img tags
  const screenshots = [];
  const screenshotMatches = html.matchAll(/image\.php\?type=screenshot[^"'\s]*?id=(\d+)/g);
  for (const m of screenshotMatches) {
    if (!screenshots.includes(m[1])) screenshots.push(m[1]);
  }
  $('img[src*="type=screenshot"]').each((_, img) => {
    const src = $(img).attr('src') || '';
    const m = src.match(/id=(\d+)/);
    if (m && !screenshots.includes(m[1])) screenshots.push(m[1]);
  });

  // Clean up version (page sometimes duplicates "1.0   1.0")
  const rawVersion = meta['version'] || null;
  const cleanVersion = rawVersion
    ? rawVersion.trim().replace(/\s+/g, ' ').split(' ')[0]
    : null;

  return {
    id,
    title,
    systemCode,
    systemName,
    year: meta['year'] || null,
    players: meta['players'] || null,
    publisher: meta['publisher'] || null,
    version: cleanVersion,
    fileSize: meta['file size'] || null,
    regions,
    ratings,
    screenshots,
    mediaId: meta['mediaId'] || null,
    boxArt: `/api/image?type=box&id=${id}`,
    // Libretro screenshot URLs — frontend tries these and hides if 404
    screenshotTitle: LIBRETRO_SYSTEMS[systemCode]
      ? `/api/screenshot?system=${systemCode}&title=${encodeURIComponent(title)}&imgtype=title`
      : null,
    screenshotSnap: LIBRETRO_SYSTEMS[systemCode]
      ? `/api/screenshot?system=${systemCode}&title=${encodeURIComponent(title)}&imgtype=snap`
      : null,
    vaultUrl: url,
  };
}

// Wikipedia summary for a game title + system
app.get('/api/wiki', async (req, res) => {
  const { title, system } = req.query;
  if (!title) return res.json({ extract: null });

  try {
    // Search Wikipedia — include system name for better precision
    const query = system ? `${title} ${system} video game` : `${title} video game`;
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=1&origin=*`;
    const searchRes = await fetch(searchUrl, { headers: { 'User-Agent': 'MIVV-Vault-Search/1.0' } });
    const searchData = await searchRes.json();

    const results = searchData.query?.search;
    if (!results?.length) return res.json({ extract: null });

    // Fetch the page summary from the REST API
    const pageTitle = results[0].title;
    const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle)}`;
    const summaryRes = await fetch(summaryUrl, { headers: { 'User-Agent': 'MIVV-Vault-Search/1.0' } });
    const summary = await summaryRes.json();

    res.json({
      extract: summary.extract || null,
      url: summary.content_urls?.desktop?.page || null,
    });
  } catch (e) {
    res.json({ extract: null });
  }
});

// Export for Vercel serverless; listen locally when run directly
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Vimm Search running at http://localhost:${PORT}`);
  });
}

module.exports = app;
