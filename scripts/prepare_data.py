"""Prepare browser-ready station totals and bike-lane geometry from Lab 7 data."""
import argparse
import csv
import json
from collections import Counter
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("inputs", type=Path, help="Directory with stations.json, trips.csv, boston.geojson and cambridge.geojson")
args = parser.parse_args()
target = Path(__file__).resolve().parents[1] / "data"
target.mkdir(exist_ok=True)

def write_json(name, value):
    (target / name).write_text(json.dumps(value, separators=(",", ":"), ensure_ascii=False) + "\n")

source = args.inputs
stations = {}
for row in json.loads((source / "stations.json").read_text())["data"]["stations"]:
    station_id = row.get("short_name")
    if station_id and row.get("lat") is not None and row.get("lon") is not None:
        stations[station_id] = {
            "id": station_id, "name": row["name"], "lat": float(row["lat"]), "lon": float(row["lon"]),
        }

departures = Counter()
arrivals = Counter()
ride_count = 0

def minute_of_day(timestamp):
    # The course CSV records Boston wall-clock time, not the viewer's time zone.
    return int(timestamp[11:13]) * 60 + int(timestamp[14:16])

with (source / "trips.csv").open(newline="") as file:
    for row in csv.DictReader(file):
        ride_count += 1
        start, end = row["start_station_id"], row["end_station_id"]
        if start in stations:
            departures[start, minute_of_day(row["started_at"])] += 1
        if end in stations:
            arrivals[end, minute_of_day(row["ended_at"])] += 1

for station_id, station in stations.items():
    station["minutes"] = [
        [m, departures[station_id, m], arrivals[station_id, m]]
        for m in range(1440) if departures[station_id, m] or arrivals[station_id, m]
    ]

write_json("traffic.json", {
    "rides": ride_count, "departures": sum(departures.values()), "arrivals": sum(arrivals.values()),
    "stations": list(stations.values()),
})
for city in ("boston", "cambridge"):
    features = json.loads((source / f"{city}.geojson").read_text())["features"]
    write_json(f"{city}.geojson", {
        "type": "FeatureCollection",
        "features": [
            {"type": "Feature", "geometry": item["geometry"], "properties": {}}
            for item in features if item["geometry"] and item["geometry"]["type"] in ("LineString", "MultiLineString")
        ],
    })

print(f"{ride_count:,} rides; {len(stations):,} stations; {sum(departures.values()):,} matched departures and {sum(arrivals.values()):,} matched arrivals")
