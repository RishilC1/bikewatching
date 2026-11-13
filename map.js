import { select, scaleSqrt, scaleQuantize, max, sum } from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import { indexStation, stationTraffic } from './traffic.js';

const slider = document.querySelector('#time-slider');
const status = document.querySelector('#map-status');
const display = document.querySelector('#time-display');
const presets = document.querySelectorAll('[data-time]');
const stationName = document.querySelector('#station-name');
const stationCounts = document.querySelector('#station-counts');
const format = new Intl.NumberFormat('en-US');
const timeFormat = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' });
const palette = ['#dc692e', '#825eb3', '#235fc4'];
const flow = scaleQuantize().domain([0, 1]).range(palette);
const center = [-71.09415, 42.36027];
const initialZoom = 11.9;

async function loadJSON(path) {
  const response = await fetch(new URL(path, import.meta.url));
  if (!response.ok) throw new Error(path + ': HTTP ' + response.status);
  return response.json();
}

function timeLabel(minute) {
  return minute === -1 ? 'Any time' : timeFormat.format(new Date(minute * 60000));
}

function details(station) {
  return format.format(station.total) + ' trips · ' + format.format(station.departures) +
    ' departures · ' + format.format(station.arrivals) + ' arrivals';
}

function startMap() {
  const gl = window.mapboxgl;
  if (!gl) throw new Error('Mapbox GL did not load.');
  gl.accessToken = 'pk.eyJ1IjoicmNoaW50YWxhcGF0aSIsImEiOiJjbXdmbHZpYTkwMTU2MndxN3BwNmZrM2xrIn0.rVLbRIFqikyzflI4SePgLA';
  const map = new gl.Map({
    container: 'map', style: 'mapbox://styles/mapbox/light-v11', center, zoom: initialZoom,
    minZoom: 8, maxZoom: 18, dragRotate: false, pitchWithRotate: false,
    cooperativeGestures: true,
  });
  map.touchZoomRotate.disableRotation();
  map.addControl(new gl.NavigationControl({ showCompass: false }), 'top-right');

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('The basemap took too long to load.')), 22000);
    map.once('load', () => { clearTimeout(timeout); resolve(map); });
    map.on('error', (event) => {
      if ([401, 403].includes(event.error?.status)) {
        clearTimeout(timeout);
        reject(new Error('Mapbox rejected the public token for this URL.'));
      }
    });
  });
}

async function init() {
  const [map, dataset, boston, cambridge] = await Promise.all([
    startMap(), loadJSON('data/traffic.json'), loadJSON('data/boston.geojson'), loadJSON('data/cambridge.geojson'),
  ]);
  for (const [city, data] of [['boston', boston], ['cambridge', cambridge]]) {
    map.addSource(city + '-routes', { type: 'geojson', data });
    map.addLayer({
      id: city + '-lanes', type: 'line', source: city + '-routes',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#16845c', 'line-opacity': 0.58,
        'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.7, 15, 3.4] },
    });
  }

  const stations = dataset.stations.map(indexStation);
  const maximum = max(stations, (station) => stationTraffic(station, -1).total);
  const radius = scaleSqrt().domain([0, maximum]).clamp(true);
  const svg = select(map.getContainer()).append('svg').attr('class', 'station-overlay')
    .attr('role', 'group').attr('aria-label', 'Bluebikes stations');
  let circles = svg.selectAll('circle');
  let selectedId = null;
  let hoveredId = null;
  let current = new Map();

  function showStation() {
    const station = current.get(hoveredId ?? selectedId);
    stationName.textContent = station?.name ?? 'Hover over or select a station to see exact counts.';
    stationCounts.hidden = !station;
    stationCounts.textContent = station ? details(station) : '';
    circles.classed('active', (item) => item.id === selectedId);
  }

  function position() {
    circles.each(function(station) {
      const { x, y } = map.project([station.lon, station.lat]);
      this.setAttribute('cx', x);
      this.setAttribute('cy', y);
    });
  }

  function update() {
    const minute = Number(slider.value);
    const text = timeLabel(minute);
    display.textContent = text;
    slider.setAttribute('aria-valuetext', text);
    presets.forEach((button) => button.setAttribute('aria-pressed', String(Number(button.dataset.time) === minute)));
    radius.range([0, minute === -1 ? 24 : 44]);
    const traffic = stations.map((station) => stationTraffic(station, minute));
    current = new Map(traffic.map((station) => [station.id, station]));
    const active = traffic.filter((station) => station.total > 0).sort((a, b) => b.total - a.total);
    if (hoveredId && !current.get(hoveredId)?.total) hoveredId = null;
    circles = svg.selectAll('circle').data(active, (station) => station.id).join((enter) => {
      const marks = enter.append('circle').attr('role', 'button').attr('tabindex', 0)
        .on('pointerenter focus', (event, station) => { hoveredId = station.id; showStation(); })
        .on('pointerleave blur', () => { hoveredId = null; showStation(); })
        .on('click', (event, station) => {
          event.stopPropagation();
          selectedId = selectedId === station.id ? null : station.id;
          showStation();
        })
        .on('keydown', (event, station) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            selectedId = selectedId === station.id ? null : station.id;
            showStation();
          }
        });
      marks.append('title');
      return marks;
    }).order().attr('r', (station) => radius(station.total))
      .attr('fill', (station) => flow(station.departures / station.total))
      .attr('aria-label', (station) => station.name + ': ' + details(station));
    circles.select('title').text((station) => station.name + ' — ' + details(station));
    document.querySelector('#departure-count').textContent = format.format(sum(traffic, (station) => station.departures));
    document.querySelector('#arrival-count').textContent = format.format(sum(traffic, (station) => station.arrivals));
    status.textContent = format.format(active.length) + ' active stations · ' + format.format(dataset.rides) + ' rides in the source data';
    position();
    showStation();
  }

  map.on('move', position);
  map.on('resize', position);
  map.on('click', () => { selectedId = null; showStation(); });
  slider.addEventListener('input', update);
  presets.forEach((button) => {
    button.disabled = false;
    button.addEventListener('click', () => { slider.value = button.dataset.time; update(); });
  });
  slider.disabled = false;
  update();
}

try {
  await init();
} catch (error) {
  console.error('Bikewatching could not initialize:', error);
  status.textContent = error.message.includes('public token')
    ? 'Mapbox could not load at this address. Check the public token’s URL settings.'
    : 'The map could not load. Please reload and try again.';
}
