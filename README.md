# England Cloud Explorer

A visually refreshed black-and-green weather map experience for England.

## Features

- Left opaque options panel with town/city search and selected-location details.
- Hour slider (`00:00` to `23:00`) at top to inspect cloud conditions at any hour.
- Map cloud simulation layer using Open-Meteo cloud-cover forecast sampled across England.
- 24-hour cloud graphic for the selected town/city.

## Run locally

```bash
python3 -m http.server 8000
```

Open <http://localhost:8000>.

## Data sources

- OpenStreetMap tiles and Nominatim geocoding
- Open-Meteo forecast API (`cloud_cover`)


## Deploy

This is a static site (no build step). For Vercel deployment conflicts/issues, use:

- **Framework preset:** Other
- **Build command:** *(leave empty)*
- **Output directory:** *(leave empty / root)*

The included `vercel.json` forces `/` to serve `index.html` and applies safe cache headers.
