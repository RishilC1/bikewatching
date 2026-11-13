export const minutesPerDay = 1440;
export const halfWindow = 60;

function prefixCounts(minutes, column) {
  const prefix = new Uint32Array(minutesPerDay + 1);
  for (const row of minutes) prefix[row[0] + 1] = row[column];
  for (let i = 1; i < prefix.length; i++) prefix[i] += prefix[i - 1];
  return prefix;
}

export function indexStation({ minutes, ...station }) {
  return { ...station, departureIndex: prefixCounts(minutes, 1), arrivalIndex: prefixCounts(minutes, 2) };
}

function countWindow(prefix, minute) {
  const dailyTotal = prefix[minutesPerDay];
  if (minute === -1) return dailyTotal;
  const start = minute - halfWindow;
  const end = minute + halfWindow + 1;
  if (start < 0) return dailyTotal - prefix[start + minutesPerDay] + prefix[end];
  if (end > minutesPerDay) return dailyTotal - prefix[start] + prefix[end - minutesPerDay];
  return prefix[end] - prefix[start];
}

export function stationTraffic(station, minute) {
  const departures = countWindow(station.departureIndex, minute);
  const arrivals = countWindow(station.arrivalIndex, minute);
  return { id: station.id, name: station.name, lat: station.lat, lon: station.lon,
    departures, arrivals, total: departures + arrivals };
}
