# Casa Yahua — Static Site

Simple static website that lists your suites with photo galleries and an availability placeholder fed by Airbnb iCal URLs.

## How it works

- Place your suite photos in folders like `Casa Yahua - Suite 1`, `Casa Yahua - Suite 2`, etc. (already present).
- Run the build to generate pages in `public/`.
- Add Airbnb iCal URLs in `data/config.json` after the first build.
- Sync calendars to create `public/availability/<slug>.json`, then the site will render booked days on a calendar.

## Commands

```bash
npm run build          # scans folders, copies images, builds pages to public/
npm run sync-calendars # fetches iCal URLs from data/config.json and writes availability/*.json
npm start              # serves public/ at http://localhost:5173
```

## Add new listings

1) Create a new folder in this directory, e.g. `Casa Yahua - Suite 6`, and drop photos inside.
2) Run `npm run build` to regenerate pages and update `data/config.json`.
3) Paste the Airbnb iCal URL for the new listing into `data/config.json` under its slug.
4) Run `npm run sync-calendars` to pull availability.

## About iCal fetching

Fetching `.ics` from the browser is often blocked by CORS. The sync script runs in Node and avoids CORS issues by fetching on the server side and pre-generating JSON files the site can load.


