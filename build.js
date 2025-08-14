const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const ASSETS_SRC_DIR = path.join(ROOT, 'assets');
const ASSETS_DEST_DIR = path.join(PUBLIC_DIR, 'assets');
const IMAGES_DEST_DIR = path.join(PUBLIC_DIR, 'images');
const AVAIL_DEST_DIR = path.join(PUBLIC_DIR, 'availability');
const CONFIG_DIR = path.join(ROOT, 'data');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

function normalizeBasePath(input) {
  if (!input || input === '/') return '/';
  let bp = String(input).trim();
  if (!bp.startsWith('/')) bp = '/' + bp;
  if (!bp.endsWith('/')) bp = bp + '/';
  return bp;
}

const BASE_PATH = normalizeBasePath(process.env.BASE_PATH || '/');

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

async function ensureDir(dirPath) {
  await fsp.mkdir(dirPath, { recursive: true });
}

function isImageFile(fileName) {
  return /(\.jpe?g|\.png|\.webp|\.avif)$/i.test(fileName);
}

async function listSuiteDirectories() {
  const dirents = await fsp.readdir(ROOT, { withFileTypes: true });
  const candidates = dirents
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .filter(name => /^casa yahua\s*-\s*/i.test(name));
  const suites = [];

  for (const dirName of candidates) {
    const abs = path.join(ROOT, dirName);
    const files = await fsp.readdir(abs);
    const imageFiles = files.filter(isImageFile);
    if (imageFiles.length === 0) continue;
    const slug = slugify(dirName);
    suites.push({
      name: dirName,
      slug,
      srcDir: abs,
      images: imageFiles.map(f => ({ fileName: f, absPath: path.join(abs, f) })),
    });
  }
  return suites.sort((a, b) => a.name.localeCompare(b.name));
}

async function copyAssets() {
  if (!fs.existsSync(ASSETS_SRC_DIR)) return;
  await ensureDir(ASSETS_DEST_DIR);
  async function copyDirRecursive(srcDir, destDir) {
    await ensureDir(destDir);
    const entries = await fsp.readdir(srcDir, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = path.join(srcDir, entry.name);
      const destPath = path.join(destDir, entry.name);
      if (entry.isDirectory()) {
        await copyDirRecursive(srcPath, destPath);
      } else if (entry.isFile()) {
        await fsp.copyFile(srcPath, destPath);
      }
    }
  }
  await copyDirRecursive(ASSETS_SRC_DIR, ASSETS_DEST_DIR);
}

async function copySuiteImages(suites) {
  await ensureDir(IMAGES_DEST_DIR);
  for (const suite of suites) {
    const destDir = path.join(IMAGES_DEST_DIR, suite.slug);
    await ensureDir(destDir);
    for (const image of suite.images) {
      const dest = path.join(destDir, image.fileName);
      await fsp.copyFile(image.absPath, dest);
    }
  }
}

function htmlEscape(text) {
  return text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function makeBaseHtml({ title, body, extraHead = '' }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex, nofollow" />
    <meta name="base-path" content="${BASE_PATH}" />
    <title>${htmlEscape(title)}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="${BASE_PATH}assets/styles.css" />
    ${extraHead}
  </head>
  <body>
    <header class="site-header">
      <div class="container">
        <a class="brand" href="${BASE_PATH}">Casa Yahua</a>
        <nav class="nav">
          <a href="${BASE_PATH}">Suites</a>
          <a href="#contact">Contact</a>
        </nav>
      </div>
    </header>
    <main class="container">
      ${body}
    </main>
    <footer class="site-footer">
      <div class="container">
        <span>&copy; ${new Date().getFullYear()} Casa Yahua</span>
      </div>
    </footer>
    <script src="${BASE_PATH}assets/site.js" defer></script>
  </body>
</html>`;
}

function makeIndexHtml(suites) {
  const cards = suites.map(suite => {
    const cover = `${BASE_PATH}images/${suite.slug}/${encodeURIComponent(suite.images[0].fileName)}`;
    return `
      <a class="card" href="${BASE_PATH}listings/${suite.slug}/">
        <div class="card-image" style="background-image:url('${cover}')" aria-hidden="true"></div>
        <div class="card-body">
          <h2 class="card-title">${htmlEscape(suite.name)}</h2>
          <div class="card-sub">View details →</div>
        </div>
      </a>
    `;
  }).join('\n');

  const body = `
    <section class="hero">
      <h1>Stay at Casa Yahua</h1>
      <p>Thoughtfully designed suites in a calm, convenient location. Simple booking, clear availability.</p>
      <div class="search-bar">
        <div class="field">
          <label>Check-in</label>
          <input type="date" id="search-check-in" />
        </div>
        <div class="field">
          <label>Check-out</label>
          <input type="date" id="search-check-out" />
        </div>
        <div class="field">
          <label>Guests</label>
          <input type="number" id="search-guests" min="1" value="2" />
        </div>
        <button class="btn-primary" id="search-button" type="button">Search suites</button>
      </div>
    </section>
    <section id="suites" class="grid">
      ${cards}
    </section>
  `;

  return makeBaseHtml({ title: 'Casa Yahua — Suites', body });
}

function makeListingHtml(suite) {
  const gallery = suite.images.map(img => {
    const src = `${BASE_PATH}images/${suite.slug}/${encodeURIComponent(img.fileName)}`;
    return `<a href="${src}" target="_blank" rel="noopener"><img loading="lazy" src="${src}" alt="${htmlEscape(suite.name)} photo" /></a>`;
  }).join('\n');

  const amenities = [
    'Fast Wi‑Fi',
    'Air conditioning',
    'Fully equipped kitchen',
    'Comfortable queen bed',
    'Private bathroom',
    'Workspace',
  ];

  const bookingAside = `
    <aside class="booking-card" data-airbnb-id="${suite.airbnbId || ''}">
      <div class="price-line"><span class="price">Book on Airbnb</span></div>
      <form id="booking-form" novalidate>
        <div class="row">
          <label>Check‑in<input type="date" name="check_in" required></label>
          <label>Check‑out<input type="date" name="check_out" required></label>
        </div>
        <label>Guests<input type="number" name="adults" min="1" value="2"></label>
        <button type="submit" class="btn-primary" ${suite.airbnbId ? '' : 'disabled'}>${suite.airbnbId ? 'Check availability' : 'Open Airbnb'}</button>
        ${suite.airbnbId ? '' : '<p class="muted">Listing link unavailable. You can still browse photos and availability.</p>'}
      </form>
      <p class="secure-note">Secure booking via Airbnb</p>
    </aside>`;

  const body = `
    <a class="back" href="${BASE_PATH}">← Back to all suites</a>
    <h1>${htmlEscape(suite.name)}</h1>
    <div class="listing-layout">
      <div class="listing-main">
        <section>
          <h2>Gallery</h2>
          <div class="gallery">${gallery}</div>
        </section>
        <section>
          <h2>Availability</h2>
          <div id="availability" data-slug="${suite.slug}"></div>
          <div class="ical-hint">
            <p>To enable the calendar, add the Airbnb iCal URL for this listing to <code>data/config.json</code> under the key <code>${suite.slug}</code>, then run <code>npm run sync-calendars</code>.</p>
          </div>
        </section>
        <section class="amenities">
          <h2>Amenities</h2>
          <ul class="amenities-list">${amenities.map(a => `<li>${a}</li>`).join('')}</ul>
        </section>
        <section class="house-rules">
          <h2>House rules</h2>
          <ul class="rules-list">
            <li>No smoking</li>
            <li>No parties or events</li>
            <li>Quiet hours after 10pm</li>
          </ul>
        </section>
      </div>
      ${bookingAside}
    </div>
  `;

  return makeBaseHtml({ title: `${suite.name} — Casa Yahua`, body });
}

async function writeFile(fp, content) {
  await ensureDir(path.dirname(fp));
  await fsp.writeFile(fp, content, 'utf8');
}

async function writeIndexPage(suites) {
  const html = makeIndexHtml(suites);
  await writeFile(path.join(PUBLIC_DIR, 'index.html'), html);
}

async function writeListingPages(suites) {
  for (const suite of suites) {
    const html = makeListingHtml(suite);
    const dest = path.join(PUBLIC_DIR, 'listings', suite.slug, 'index.html');
    await writeFile(dest, html);
  }
}

async function write404Redirect() {
  const html = `<!doctype html><html><head>
    <meta charset="utf-8" />
    <meta http-equiv="refresh" content="0; url=${BASE_PATH}" />
    <meta name="robots" content="noindex, nofollow" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Not Found</title>
  </head>
  <body>
    <p>Not found. <a href="${BASE_PATH}">Return to site</a>.</p>
  </body></html>`;
  await writeFile(path.join(PUBLIC_DIR, '404.html'), html);
}

async function ensureConfig(suites) {
  await ensureDir(CONFIG_DIR);
  let current = {};
  if (fs.existsSync(CONFIG_PATH)) {
    try { current = JSON.parse(await fsp.readFile(CONFIG_PATH, 'utf8')); } catch {}
  }
  for (const suite of suites) {
    if (!current[suite.slug]) {
      current[suite.slug] = { name: suite.name, icalUrl: "" };
    } else {
      current[suite.slug].name = suite.name;
      if (typeof current[suite.slug].icalUrl !== 'string') {
        current[suite.slug].icalUrl = "";
      }
    }
  }
  await fsp.writeFile(CONFIG_PATH, JSON.stringify(current, null, 2), 'utf8');
}

async function ensureEmptyAvailability(suites) {
  await ensureDir(AVAIL_DEST_DIR);
  for (const suite of suites) {
    const fp = path.join(AVAIL_DEST_DIR, `${suite.slug}.json`);
    if (!fs.existsSync(fp)) {
      const payload = { bookedDates: [], note: "Add iCal URL in data/config.json and run 'npm run sync-calendars'" };
      await fsp.writeFile(fp, JSON.stringify(payload), 'utf8');
    }
  }
}

async function readConfig() {
  if (!fs.existsSync(CONFIG_PATH)) return {};
  try {
    return JSON.parse(await fsp.readFile(CONFIG_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function getAirbnbIdFromIcalUrl(icalUrl) {
  if (!icalUrl) return null;
  const match = /calendar\/ical\/(\d+)\.ics/i.exec(icalUrl);
  return match ? match[1] : null;
}

async function enrichSuitesWithConfig(suites) {
  const cfg = await readConfig();
  for (const suite of suites) {
    const icalUrl = cfg[suite.slug] ? cfg[suite.slug].icalUrl : '';
    suite.airbnbId = getAirbnbIdFromIcalUrl(icalUrl);
  }
}

async function main() {
  await ensureDir(PUBLIC_DIR);
  const suites = await listSuiteDirectories();
  if (suites.length === 0) {
    console.warn('No suite directories found. Create folders like "Casa Yahua - Suite X" with images.');
  }
  await enrichSuitesWithConfig(suites);
  await copyAssets();
  await copySuiteImages(suites);
  await writeIndexPage(suites);
  await writeListingPages(suites);
  await write404Redirect();
  await ensureConfig(suites);
  await ensureEmptyAvailability(suites);
  console.log(`Built site with ${suites.length} suite(s). Open public/index.html or run: npm start`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});


