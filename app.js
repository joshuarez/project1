const ENGLAND_CENTER = [52.7, -1.7];
const ENGLAND_BOUNDS = L.latLngBounds([49.8, -6], [56.2, 2.2]);

const map = L.map('map', {
  minZoom: 5,
  maxZoom: 11,
  maxBounds: ENGLAND_BOUNDS.pad(0.35),
  maxBoundsViscosity: 0.9,
}).setView(ENGLAND_CENTER, 6);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors',
}).addTo(map);

const statusEl = document.getElementById('status');
const selectionEl = document.getElementById('selection');
const cloudNowEl = document.getElementById('cloud-now');
const chartEl = document.getElementById('hourly-chart');
const hourSlider = document.getElementById('hour-slider');
const hourLabel = document.getElementById('hour-label');

let selectedMarker;
let locationForecast = null;
let gridForecast = [];
let gridLayer = L.layerGroup().addTo(map);
let selectedHour = new Date().getHours();

hourSlider.value = String(selectedHour);

function setStatus(message, ok = true) {
  statusEl.textContent = message;
  statusEl.className = `status ${ok ? '' : 'bad'}`;
}

function formatHour(hour) {
  return `${String(hour).padStart(2, '0')}:00`;
}

function cloudColor(value) {
  if (value < 20) return '#2df35f';
  if (value < 45) return '#8fff4a';
  if (value < 70) return '#ffd84d';
  return '#ff7f50';
}

function drawHourlyGraphic(hourlyClouds) {
  const w = 320;
  const h = 160;
  const left = 20;
  const right = 10;
  const top = 16;
  const bottom = 22;
  const chartW = w - left - right;
  const chartH = h - top - bottom;

  const points = hourlyClouds.slice(0, 24).map((value, i) => {
    const x = left + (i / 23) * chartW;
    const y = top + (1 - value / 100) * chartH;
    return `${x},${y}`;
  });

  const areaPath = `M ${left},${h - bottom} L ${points.join(' L ')} L ${left + chartW},${h - bottom} Z`;
  const linePath = `M ${points.join(' L ')}`;

  const ticks = [0, 6, 12, 18, 23]
    .map((t) => `<text x="${left + (t / 23) * chartW}" y="${h - 5}" fill="#8bcf97" font-size="9" text-anchor="middle">${String(t).padStart(2, '0')}</text>`)
    .join('');

  const hourX = left + (selectedHour / 23) * chartW;

  chartEl.innerHTML = `
    <defs>
      <linearGradient id="fillGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#47ff73" stop-opacity="0.55" />
        <stop offset="100%" stop-color="#47ff73" stop-opacity="0.08" />
      </linearGradient>
    </defs>
    <path d="${areaPath}" fill="url(#fillGrad)" />
    <path d="${linePath}" fill="none" stroke="#7dff96" stroke-width="2.5" />
    <line x1="${hourX}" y1="${top}" x2="${hourX}" y2="${h - bottom}" stroke="#e7ffea" stroke-dasharray="4 3" opacity="0.85" />
    ${ticks}
  `;
}

function renderGridForHour(hour) {
  gridLayer.clearLayers();

  for (const point of gridForecast) {
    const cloud = point.hourly_cloud_cover[hour] ?? 0;
    L.circleMarker([point.latitude, point.longitude], {
      radius: 8,
      weight: 1,
      color: '#0d220f',
      fillColor: cloudColor(cloud),
      fillOpacity: 0.16 + cloud / 140,
    })
      .bindTooltip(`${point.name}<br>${formatHour(hour)} cloud cover: ${cloud}%`)
      .addTo(gridLayer);
  }
}

async function loadEnglandGridForecast() {
  const coords = [];
  for (let lat = 50.1; lat <= 55.7; lat += 0.7) {
    for (let lon = -5.7; lon <= 1.8; lon += 0.85) {
      coords.push({ latitude: Number(lat.toFixed(3)), longitude: Number(lon.toFixed(3)) });
    }
  }

  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', coords.map((c) => c.latitude).join(','));
  url.searchParams.set('longitude', coords.map((c) => c.longitude).join(','));
  url.searchParams.set('hourly', 'cloud_cover');
  url.searchParams.set('forecast_days', '1');
  url.searchParams.set('timezone', 'Europe/London');

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Map cloud API status ${response.status}`);

  const data = await response.json();
  const arr = Array.isArray(data) ? data : [data];

  gridForecast = arr.map((item, idx) => ({
    latitude: item.latitude,
    longitude: item.longitude,
    name: `Grid point ${idx + 1}`,
    hourly_cloud_cover: item.hourly?.cloud_cover || new Array(24).fill(0),
  }));

  renderGridForHour(selectedHour);
}

async function loadLocationForecast(lat, lon, label = 'Selected location') {
  selectionEl.textContent = `${label} (${lat.toFixed(3)}, ${lon.toFixed(3)})`;

  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', lat);
  url.searchParams.set('longitude', lon);
  url.searchParams.set('hourly', 'cloud_cover');
  url.searchParams.set('forecast_days', '1');
  url.searchParams.set('timezone', 'Europe/London');

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Location API status ${response.status}`);

  const data = await response.json();
  locationForecast = data.hourly?.cloud_cover || new Array(24).fill(0);

  const currentCloud = locationForecast[selectedHour] ?? 0;
  cloudNowEl.textContent = `Cloud cover at ${formatHour(selectedHour)}: ${currentCloud}%`;
  drawHourlyGraphic(locationForecast);
}

function selectLocation(lat, lon, label) {
  if (selectedMarker) {
    selectedMarker.remove();
  }

  selectedMarker = L.marker([lat, lon]).addTo(map).bindPopup(label).openPopup();
  map.flyTo([lat, lon], Math.max(8, map.getZoom()));

  loadLocationForecast(lat, lon, label)
    .then(() => setStatus('Cloud simulation loaded. Use the hour slider to view the day.'))
    .catch((error) => setStatus(`Could not load location forecast: ${error.message}`, false));
}

hourSlider.addEventListener('input', () => {
  selectedHour = Number(hourSlider.value);
  hourLabel.textContent = formatHour(selectedHour);
  renderGridForHour(selectedHour);

  if (locationForecast) {
    cloudNowEl.textContent = `Cloud cover at ${formatHour(selectedHour)}: ${locationForecast[selectedHour] ?? 0}%`;
    drawHourlyGraphic(locationForecast);
  }
});

map.on('click', (event) => {
  selectLocation(event.latlng.lat, event.latlng.lng, 'Map selection');
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

    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Search API status ${response.status}`);

    const data = await response.json();
    if (!data.length) throw new Error('No matching location found in England.');

    const hit = data[0];
    selectLocation(Number(hit.lat), Number(hit.lon), hit.display_name);
  } catch (error) {
    setStatus(`Could not search location: ${error.message}`, false);
  }
});

(async function init() {
  try {
    hourLabel.textContent = formatHour(selectedHour);
    await loadEnglandGridForecast();
    selectLocation(51.5072, -0.1276, 'London');
    setStatus('Ready. Move slider to inspect clouds by hour.');
  } catch (error) {
    setStatus(`Could not initialize app: ${error.message}`, false);
  }
})();
