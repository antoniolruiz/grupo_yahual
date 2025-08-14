const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const http = require('http');
const https = require('https');

const ROOT = __dirname;
const CONFIG_PATH = path.join(ROOT, 'data', 'config.json');
const AVAIL_DEST_DIR = path.join(ROOT, 'public', 'availability');

function fetchIcs(url) {
  return new Promise((resolve, reject) => {
    const getter = url.startsWith('http://') ? http.get : https.get;
    getter(url, res => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // Follow one redirect
        return resolve(fetchIcs(res.headers.location));
      }
      if (res.statusCode !== 200) {
        reject(new Error(`Failed to fetch ICS: ${res.statusCode}`));
        res.resume();
        return;
      }
      let data = '';
      res.setEncoding('utf8');
      res.on('data', chunk => (data += chunk));
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function parseDateFromLine(line) {
  // Handles: DTSTART;VALUE=DATE:20250101 or DTSTART:20250101 or DTSTART:20250101T150000Z
  const m = line.match(/:(\d{8})(?:T\d{6}Z?)?$/);
  if (!m) return null;
  const y = m[1].slice(0, 4);
  const mo = m[1].slice(4, 6);
  const d = m[1].slice(6, 8);
  return `${y}-${mo}-${d}`;
}

function enumerateDates(startYmd, endYmdExclusive) {
  const dates = [];
  const start = new Date(startYmd);
  const end = new Date(endYmdExclusive);
  for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    dates.push(`${y}-${m}-${day}`);
  }
  return dates;
}

function parseIcsToBookedDates(ics) {
  // Very lightweight parser focusing on DTSTART/DTEND
  const booked = new Set();
  const vevents = ics.split(/BEGIN:VEVENT/).slice(1);
  for (const block of vevents) {
    const endOf = block.indexOf('END:VEVENT');
    const body = endOf >= 0 ? block.slice(0, endOf) : block;
    const lines = body.split(/\r?\n/);
    const dtstartLine = lines.find(l => l.startsWith('DTSTART')) || '';
    const dtendLine = lines.find(l => l.startsWith('DTEND')) || '';
    const start = parseDateFromLine(dtstartLine);
    let endExclusive = null;
    if (dtendLine) {
      const e = parseDateFromLine(dtendLine);
      if (e) endExclusive = e; // ICS DTEND is exclusive for date-only events
    }
    if (!start) continue;
    if (!endExclusive) {
      // Treat as single-day if DTEND missing
      endExclusive = start;
      const d = new Date(start);
      d.setDate(d.getDate() + 1);
      endExclusive = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    }
    for (const day of enumerateDates(start, endExclusive)) {
      booked.add(day);
    }
  }
  return Array.from(booked).sort();
}

async function main() {
  if (!fs.existsSync(CONFIG_PATH)) {
    console.error('Missing data/config.json. Run `npm run build` first.');
    process.exit(1);
  }
  const config = JSON.parse(await fsp.readFile(CONFIG_PATH, 'utf8'));
  await fsp.mkdir(AVAIL_DEST_DIR, { recursive: true });

  const entries = Object.entries(config);
  if (entries.length === 0) {
    console.log('No suites found in config. Run `npm run build` to generate.');
    return;
  }

  for (const [slug, { icalUrl, name }] of entries) {
    if (!icalUrl) {
      console.log(`Skipping ${name} (${slug}): no iCal URL set.`);
      continue;
    }
    try {
      console.log(`Fetching iCal for ${name}...`);
      const ics = await fetchIcs(icalUrl);
      const bookedDates = parseIcsToBookedDates(ics);
      const outPath = path.join(AVAIL_DEST_DIR, `${slug}.json`);
      await fsp.writeFile(outPath, JSON.stringify({ bookedDates }, null, 2), 'utf8');
      console.log(`Saved availability: availability/${slug}.json (${bookedDates.length} booked days)`);
    } catch (err) {
      console.error(`Failed for ${name}:`, err.message);
    }
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});


