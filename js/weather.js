function parseHourlyResponse(data) {
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
    temp3pm: i15 >= 0 ? Math.round(temps[i15]) : null,
    realFeel3pm: i15 >= 0 ? Math.round(feels[i15]) : null,
    precipitation: Math.round(totalPrecip * 100) / 100,
    fetchedAt: new Date().toISOString(),
  };
}

function todayLocalISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function fetchWeather(lat, lon, dateISO) {
  const target = dateISO || todayLocalISO();
  const isPast = target < todayLocalISO();
  const isFuture = target > todayLocalISO();

  // Forecast endpoint covers today and a few days back (past_days), plus future.
  // Archive endpoint covers older dates (with a ~5 day delay).
  const tryUrls = [];
  if (!isPast) {
    tryUrls.push(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,apparent_temperature,precipitation&temperature_unit=fahrenheit&precipitation_unit=inch&timezone=auto&start_date=${target}&end_date=${target}`);
  } else {
    // Try forecast with past_days first (covers up to ~92 days)
    const daysBack = Math.min(92, Math.ceil((Date.now() - new Date(target + 'T00:00:00').getTime()) / 86400000));
    tryUrls.push(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,apparent_temperature,precipitation&temperature_unit=fahrenheit&precipitation_unit=inch&timezone=auto&past_days=${daysBack}&forecast_days=1&start_date=${target}&end_date=${target}`);
    // Then archive endpoint (works back to 1940)
    tryUrls.push(`https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,apparent_temperature,precipitation&temperature_unit=fahrenheit&precipitation_unit=inch&timezone=auto&start_date=${target}&end_date=${target}`);
  }
  if (isFuture) throw new Error('Cannot fetch weather for future dates');

  let lastErr = null;
  for (const url of tryUrls) {
    try {
      const res = await fetch(url);
      if (!res.ok) { lastErr = new Error('HTTP ' + res.status); continue; }
      const data = await res.json();
      if (!data.hourly || !data.hourly.time || data.hourly.time.length === 0) {
        lastErr = new Error('No hourly data returned'); continue;
      }
      return parseHourlyResponse(data);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('Weather fetch failed');
}

async function fetchWeatherForDate(lat, lon, dateISO) {
  try {
    return await fetchWeather(lat, lon, dateISO);
  } catch (_) {
    return null;
  }
}

async function getOrFetchWeatherForToday(record) {
  if (record.weather && record.weather.fetchedAt) return record.weather;
  const loc = await getSetting('location');
  if (!loc || loc.lat == null || loc.lon == null) {
    throw new Error('No location set — open Settings to add one.');
  }
  return await fetchWeather(loc.lat, loc.lon, record.date);
}
