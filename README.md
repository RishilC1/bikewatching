# Bikewatching

Interactive Mapbox GL JS and D3 visualization of March 2024 Bluebikes traffic in Boston and Cambridge, built for DSC 106 Lab 7.

To preview, run `python3 -m http.server 8000` from this folder and visit `http://localhost:8000/`. The browser needs internet access for Mapbox and D3. The basemap uses a public Mapbox token in `map.js`; never put a secret token in the client.

To publish, add this existing repository to GitHub Desktop and publish it as `RishilC1/bikewatching`. In the repository's **Settings → Pages**, choose **Deploy from a branch → main → /(root)**.

## Data and filtering

- [Bluebikes stations](https://dsc106.com/labs/lab07/data/bluebikes-stations.json) and [March 2024 trips](https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv), supplied by DSC 106.
- [Boston bike lanes](https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson) and [Cambridge bike facilities](https://raw.githubusercontent.com/cambridgegis/cambridgegis_data/main/Recreation/Bike_Facilities/RECREATION_BikeFacilities.geojson).

To regenerate the browser assets, save these four inputs as `stations.json`, `trips.csv`, `boston.geojson`, and `cambridge.geojson` in a separate directory, then run `python3 scripts/prepare_data.py /path/to/inputs`.

Departure and arrival counts use their respective Boston wall-clock timestamps. A time filter includes the selected minute and the 60 minutes on either side, wrapping across midnight. An endpoint only counts when its station ID matches the station file. Map panning does not change the aggregate counts in the sidebar.
