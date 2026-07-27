import type { WeatherData } from '../types';

function mapWmoCodeToIconAndCondition(code: number): { condition: string; icon: string } {
  if (code === 0) return { condition: 'Clear', icon: '01d' };
  if (code === 1 || code === 2 || code === 3) return { condition: 'Partly Cloudy', icon: '02d' };
  if (code === 45 || code === 48) return { condition: 'Foggy', icon: '50d' };
  if (code === 51 || code === 53 || code === 55 || code === 56 || code === 57) return { condition: 'Drizzle', icon: '09d' };
  if (code === 61 || code === 63 || code === 65 || code === 66 || code === 67) return { condition: 'Rain', icon: '10d' };
  if (code === 71 || code === 73 || code === 75 || code === 77) return { condition: 'Snow', icon: '13d' };
  if (code === 80 || code === 81 || code === 82) return { condition: 'Rain Showers', icon: '09d' };
  if (code === 85 || code === 86) return { condition: 'Snow Showers', icon: '13d' };
  if (code === 95 || code === 96 || code === 99) return { condition: 'Thunderstorm', icon: '11d' };
  return { condition: 'Cloudy', icon: '03d' };
}

/**
 * Fetches current weather and forecast data from Open-Meteo API keylessly.
 * Uses geocoding API to resolve city names to coordinates.
 */
export async function fetchLiveWeatherKeyless(location: string): Promise<WeatherData> {
  const isUS = location.toLowerCase().includes(', us') || location.toLowerCase().endsWith(' us');
  const tempUnit = isUS ? 'fahrenheit' : 'celsius';
  const windUnit = isUS ? 'mph' : 'ms';

  // 1. Geocode location to get latitude & longitude
  const geocodeUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=en&format=json`;
  const geoRes = await fetch(geocodeUrl);
  if (!geoRes.ok) {
    throw new Error(`Geocoding failed for ${location}`);
  }
  const geoData = await geoRes.json();
  if (!geoData.results || geoData.results.length === 0) {
    throw new Error(`No coordinates found for location: ${location}`);
  }

  const { latitude, longitude } = geoData.results[0];

  // 2. Fetch current weather and forecast
  const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,showers,snowfall,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,precipitation_sum,rain_sum,showers_sum,snowfall_sum&temperature_unit=${tempUnit}&wind_speed_unit=${windUnit}&timezone=auto`;
  
  const weatherRes = await fetch(forecastUrl);
  if (!weatherRes.ok) {
    throw new Error(`Open-Meteo forecast failed (${weatherRes.status})`);
  }
  const weatherData = await weatherRes.json();

  const current = weatherData.current;
  const daily = weatherData.daily;

  // Map current weather
  const currentCondition = mapWmoCodeToIconAndCondition(current.weather_code);

  // Map forecast (Open-Meteo returns next 7 days. We want the next 3 days: index 1, 2, 3)
  const mappedForecast = [];
  for (let i = 1; i <= 3; i++) {
    const dateStr = daily.time[i];
    const date = new Date(dateStr + 'T00:00:00'); // prevent timezone shift
    const weekday = date.toLocaleDateString([], { weekday: 'short' });
    const fcCondition = mapWmoCodeToIconAndCondition(daily.weather_code[i]);

    mappedForecast.push({
      date: weekday,
      temp: Math.round((daily.temperature_2m_max[i] + daily.temperature_2m_min[i]) / 2),
      tempMin: Math.round(daily.temperature_2m_min[i]),
      tempMax: Math.round(daily.temperature_2m_max[i]),
      condition: fcCondition.condition,
      icon: fcCondition.icon,
    });
  }

  return {
    temp: Math.round(current.temperature_2m),
    condition: currentCondition.condition,
    icon: currentCondition.icon,
    tempMin: Math.round(daily.temperature_2m_min[0]),
    tempMax: Math.round(daily.temperature_2m_max[0]),
    description: currentCondition.condition,
    forecast: mappedForecast,
  };
}
