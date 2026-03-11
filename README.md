# England Cloud Coverage Viewer

A static HTML site that combines:

- **Near-real-time satellite cloud imagery** for England (RainViewer infrared satellite frames).
- **Town/city lookup + map zoom** (OpenStreetMap Nominatim geocoding).
- **Hourly cloud forecasts** for the selected point (Open-Meteo cloud cover fields).

## Run locally

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

## Data sources

- RainViewer public weather maps API
- OpenStreetMap tile + Nominatim search
- Open-Meteo forecast API

