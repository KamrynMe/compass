async function fetchWeather(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,apparent_temperature,precipitation&temperature_unit=fahrenheit&precipitation_unit=inch&timezone=auto&forecast_days=1`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Weather fetch failed');
  const data = await res.json();
  const times = data.hourly.time;
  const temps = data.hourly.temperature_2m;
  const feels = data.hourly.apparent_temperature;
  const precip = data.hourly.precipitation;

  const hourOf = (idx) => parseInt(times[idx].slice(11, 13), 10);
  let i6 = -1, i15 = -1;
  for (let i = 0; i < times.length; i++) {
    if (i6 === -1 && hourOf(i) === 6) i6 = i;
    if (i15 === -1 && hourOf(i) === 15) i15 = i;
  }
  const totalPrecip = precip.reduce((s, x) => s + (x || 0), 0);
  return {
    temp6am: i6 >= 0 ? Math.round(temps[i6]) : null,
    realFeel3pm: i15 >= 0 ? Math.round(feels[i15]) : null,
    precipitation: Math.round(totalPrecip * 100) / 100,
    fetchedAt: new Date().toISOString(),
  };
}

async function getOrFetchWeatherForToday(record) {
  if (record.weather && record.weather.fetchedAt) return record.weather;
  const loc = await getSetting('location');
  if (!loc || loc.lat == null || loc.lon == null) {
    throw new Error('No location set');
  }
  const w = await fetchWeather(loc.lat, loc.lon);
  return w;
}
