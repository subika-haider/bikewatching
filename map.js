let timeFilter = -1;  // -1 means “any time”

let stationFlow = d3.scaleQuantize().domain([0, 1]).range([0, 0.5, 1]);

// Helper to convert minutes-since-midnight into "h:mm AM/PM"
function formatTime(minutes) {
  const date = new Date(0, 0, 0, Math.floor(minutes / 60), minutes % 60);
  return date.toLocaleString('en-US', { timeStyle: 'short' });
}

function minutesSinceMidnight(date) {
  return date.getHours() * 60 + date.getMinutes();
}

function computeStationTraffic(stations, trips) {
  // departures  (by start station)
  const departures = d3.rollup(
    trips,
    v => v.length,
    d => d.start_station_id
  );

  // arrivals  (by end station)
  const arrivals = d3.rollup(
    trips,
    v => v.length,
    d => d.end_station_id
  );

  // merge counts into each station record
  return stations.map(st => {
    const id = st.short_name;              // ← station ID used in trips CSV
    st.departures   = departures.get(id) ?? 0;
    st.arrivals     = arrivals.get(id)   ?? 0;
    st.totalTraffic = st.departures + st.arrivals;
    return st;
  });
}



// Import Mapbox as an ESM module
import mapboxgl from 'https://cdn.jsdelivr.net/npm/mapbox-gl@2.15.0/+esm';

import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

function getCoords(station) {
  const point = new mapboxgl.LngLat(+station.lon, +station.lat);
  const { x, y } = map.project(point);
  return { cx: x, cy: y };
}

console.log('Mapbox GL JS Loaded:', mapboxgl);
mapboxgl.accessToken = 'pk.eyJ1Ijoic2hhaWRlciIsImEiOiJjbWF0MWZxY3UwbzJmMmtwc2I2MWxvMG92In0.btDCG9rpCf_c0RNVp5QsRA';

const map = new mapboxgl.Map({
  container: 'map',                           // matches <div id="map">
  style: 'mapbox://styles/mapbox/streets-v12',// basemap style
  center: [-71.09415, 42.36027],              // [lng, lat] around Cambridge/Boston
  zoom: 12,                                   // initial zoom
  minZoom: 5,                                 // prevent zooming out too far
  maxZoom: 18                                 // prevent zooming in too close
});




map.on('load', async () => {

  map.addSource('boston_route', {
    type: 'geojson',
    data: 'https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson',
  });

  // draw it as a semi-transparent green line
  map.addLayer({
    id: 'bike-lanes',
    type: 'line',
    source: 'boston_route',
    paint: {
      'line-color': 'blue',
      'line-width': 1.5,
      'line-opacity': 0.4
    }
  });

    map.addSource('cambridge_route', {
    type: 'geojson',
    data: 'https://raw.githubusercontent.com/cambridgegis/cambridgegis_data/main/Recreation/Bike_Facilities/RECREATION_BikeFacilities.geojson'
  });

  map.addLayer({
    id: 'cambridge-bike-lanes',
    type: 'line',
    source: 'cambridge_route',
    paint: {
      'line-color': 'red',
      'line-width': 1.5,
      'line-opacity': 0.4
    }
});

const svg = d3.select('#map').select('svg');

let stations;

  const jsonurl = 'https://dsc106.com/labs/lab07/data/bluebikes-stations.json';
  const jsonData = await d3.json(jsonurl);

  console.log('Loaded JSON Data:', jsonData);

  stations = jsonData; // Data is already an array
  stations = stations.data.stations


  console.log('Stations Array:', stations);


if (!Array.isArray(stations)) {
  console.error('Expected an array but got:', stations.data.stations);
  return;
}



const trafficURL = 'https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv';
let trips = await d3.csv(
  'https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv',
  (trip) => {
    trip.started_at = new Date(trip.started_at);
    trip.ended_at = new Date(trip.ended_at);
    return trip;
  },
);
stations = computeStationTraffic(jsonData.data.stations, trips);

console.log("test1",stations)

console.log("Total traffic per station:");
stations.forEach(station => {
  console.log(`Station ${station.short_name}: ${station.totalTraffic}`);
});



const departures = d3.rollup(
  trips,
  v => v.length,
  d => d.start_station_id

);

console.log(stations[0])

const arrivals = d3.rollup(
  trips,
  v => v.length,
  d => d.end_station_id
);

stations = stations.map((station) => {
  const id = station.short_name; // or station.short_name if that's your station ID

  station.departures = departures.get(id) ?? 0;
  station.arrivals = arrivals.get(id) ?? 0;
  station.totalTraffic = station.departures + station.arrivals;

  

  return station;
});

const radiusScale = d3
  .scaleSqrt()
  .domain([0, d3.max(stations, d => d.totalTraffic)])
  .range([0, 25]);




// Append circles to the SVG for each station
const circles = svg
  .selectAll('circle')
  .data(stations, (d) => d.short_name)
  .enter()
  .append('circle')
  .attr('r', d => radiusScale(d.totalTraffic))
  .attr('fill', 'red')
  .attr('stroke', 'white')
  .attr('stroke-width', 1)
  .attr('opacity', 0.6)
  .attr('pointer-events', 'auto')
  .each(function (d) {
    d3.select(this)
      .append('title')
      .text(
        `${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`
      );
    })
.style('--departure-ratio', (d) =>
    stationFlow(d.departures / d.totalTraffic),
  );

// Function to update circle positions when the map moves/zooms
function updatePositions() {
  circles
    .attr('cx', (d) => getCoords(d).cx)
    .attr('cy', (d) => getCoords(d).cy);
}

updatePositions();

map.on('move', updatePositions);
map.on('zoom', updatePositions);
map.on('resize', updatePositions);
map.on('moveend', updatePositions);

// 2a) Grab the slider + display elements by their IDs
const timeSlider   = document.getElementById('time-slider');
const timeDisplay  = document.getElementById('time-display');
const anyTimeLabel = document.getElementById('any-time');
const selectedTime = document.getElementById('#selected-time');

function filterTripsByTime(trips, timeFilter) {
  return timeFilter === -1
    ? trips
    : trips.filter(trip => {
        const startM = minutesSinceMidnight(trip.started_at);
        const endM   = minutesSinceMidnight(trip.ended_at);
        return (
          Math.abs(startM - timeFilter) <= 60 ||
          Math.abs(endM   - timeFilter) <= 60
        );
      });
}


function updateScatterPlot(timeFilter) {
  // Get only the trips that match the selected time filter
  const filteredTrips = filterTripsByTime(trips, timeFilter);

  // Recompute station traffic based on the filtered trips
  const filteredStations = computeStationTraffic(stations, filteredTrips);


  timeFilter === -1 ? radiusScale.range([0, 25]) : radiusScale.range([3, 50]);
  // Update the scatterplot by adjusting the radius of circles
  circles
    .data(filteredStations, (d) => d.short_name)
    .join('circle') // Ensure the data is bound correctly
    .attr('r', (d) => radiusScale(d.totalTraffic)) // Update circle sizes
    .style('--departure-ratio', (d) =>
      stationFlow(d.departures / d.totalTraffic),
    );
}

function updateTimeDisplay() {
  let timeFilter = Number(timeSlider.value); // Get slider value

  if (timeFilter === -1) {
    timeDisplay.textContent = ''; // Clear time display
    anyTimeLabel.style.display = 'block'; // Show "(any time)"
  } else {
    timeDisplay.textContent = formatTime(timeFilter); // Display formatted time
    anyTimeLabel.style.display = 'none'; // Hide "(any time)"
  }

  // Call updateScatterPlot to reflect the changes on the map
  updateScatterPlot(timeFilter);
}



// 2c) Wire up the slider and initialize display
timeSlider.addEventListener('input', updateTimeDisplay);
updateTimeDisplay();





});