const englandBounds = L.latLngBounds(
  [49.8, -6.0],
  [56.2, 2.2]
);

const map = L.map('map', {
  minZoom: 5,
  maxZoom: 12,
  maxBounds: englandBounds.pad(0.6),
  maxBoundsViscosity: 0.9,
}).setView([52.7, -1.7], 6);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors',
}).addTo(map);

let cloudLayer;
let frames = [];
let currentFrame = 0;
let marker;

const slider = document.getElementById('frame-slider');
const frameTime = document.getElementById('frame-time');
const statusEl = document.getElementById('status');
const selectionEl = document.getElementById('selection');
const forecastBody = document.getElementById('forecast-body');

function setStatus(message, ok = true) {
  statusEl.textContent = message;
  statusEl.className = `status ${ok ? 'good' : 'bad'}`;
}

function frameUrl(frame) {
  return `https://tilecache.rainviewer.com${frame.path}/256/{z}/{x}/{y}/0/0_0.png`;
}

function applyFrame(index) {
  if (!frames[index]) return;

  currentFrame = index;
  slider.value = index;

  if (cloudLayer) {
    map.removeLayer(cloudLayer);
  }

  cloudLayer = L.tileLayer(frameUrl(frames[index]), {
    opacity: 0.55,
    attribution: 'RainViewer satellite',
    zIndex: 10,
  }).addTo(map);

  const date = new Date(frames[index].time * 1000);
  frameTime.textContent = `Satellite frame: ${date.toLocaleString()}`;
}

async function loadSatelliteFrames() {
  try {
    const response = await fetch('https://api.rainviewer.com/public/weather-maps.json');
    if (!response.ok) throw new Error(`Satellite API status ${response.status}`);

    const data = await response.json();
    frames = [...(data.satellite?.infrared?.past || []), ...(data.satellite?.infrared?.nowcast || [])];

    if (!frames.length) {
      throw new Error('No frames returned from RainViewer.');
    }

    slider.max = String(frames.length - 1);
    applyFrame(frames.length - 1);
    setStatus('Satellite cloud layer connected. Auto-refresh runs every minute.');
  } catch (error) {
    setStatus(`Could not load satellite cloud layer: ${error.message}`, false);
  }
}

slider.addEventListener('input', (event) => {
  applyFrame(Number(event.target.value));
});

setInterval(async () => {
  await loadSatelliteFrames();
  if (frames.length) {
    applyFrame(frames.length - 1);
  }
}, 60 * 1000);

function renderForecastTable(hourly) {
  forecastBody.innerHTML = '';

  hourly.time.forEach((time, idx) => {
    const tr = document.createElement('tr');
    const values = [
      new Date(time).toLocaleString(),
      `${hourly.cloud_cover[idx]}%`,
      `${hourly.cloud_cover_low[idx]}%`,
      `${hourly.cloud_cover_mid[idx]}%`,
      `${hourly.cloud_cover_high[idx]}%`,
    ];

    for (const value of values) {
      const td = document.createElement('td');
      td.textContent = value;
      tr.appendChild(td);
    }

    forecastBody.appendChild(tr);
  });
}

async function loadForecast(lat, lon, label = 'Selected point') {
  selectionEl.textContent = `${label} (${lat.toFixed(4)}, ${lon.toFixed(4)})`;

  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', lat);
  url.searchParams.set('longitude', lon);
  url.searchParams.set('hourly', 'cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high');
  url.searchParams.set('forecast_days', '2');
  url.searchParams.set('timezone', 'Europe/London');

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Forecast API status ${response.status}`);

    const data = await response.json();
    if (!data.hourly?.time?.length) throw new Error('No hourly forecast in response.');

    renderForecastTable(data.hourly);
    setStatus('Forecast loaded for selected location.');
  } catch (error) {
    setStatus(`Could not load forecast: ${error.message}`, false);
  }
}

function chooseLocation(lat, lon, label) {
  if (marker) marker.remove();

  marker = L.marker([lat, lon]).addTo(map).bindPopup(label).openPopup();
  map.flyTo([lat, lon], Math.max(8, map.getZoom()));
  loadForecast(lat, lon, label);
}

map.on('click', (event) => {
  chooseLocation(event.latlng.lat, event.latlng.lng, 'Map selection');
});

document.getElementById('search-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const query = document.getElementById('town-search').value.trim();
  if (!query) return;

  try {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('q', `${query}, England`);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('limit', '1');
    url.searchParams.set('countrycodes', 'gb');

    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) throw new Error(`Search API status ${response.status}`);

    const data = await response.json();
    if (!data.length) throw new Error('No matching location found in England.');

    const hit = data[0];
    chooseLocation(Number(hit.lat), Number(hit.lon), hit.display_name);
  } catch (error) {
    setStatus(`Could not search location: ${error.message}`, false);
  }
});

loadSatelliteFrames();
loadForecast(51.5072, -0.1276, 'London');
