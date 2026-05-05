// src/services/weather.service.js
const axios = require("axios");
const logger = require("../utils/logger");

const BASE_URL = "https://api.openweathermap.org/data/2.5";
const GEO_URL = "https://api.openweathermap.org/geo/1.0";

// Simple in-memory cache: key → { data, expiresAt }
const cache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

const cached = (key, fn) => {
  const hit = cache.get(key);
  if (hit && Date.now() < hit.expiresAt) return Promise.resolve(hit.data);
  return fn().then((data) => {
    cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
    return data;
  });
};

const apiKey = () => {
  const key = process.env.OPENWEATHER_API_KEY;
  if (!key) throw new Error("OPENWEATHER_API_KEY is not set");
  return key;
};

/**
 * Geocode a city string → { lat, lon }
 */
const geocode = async (location) => {
  const key = `geo:${location}`;
  return cached(key, async () => {
   const { data } = await axios.get(`${GEO_URL}/direct`, {
  params: { q: location.split(',')[0].trim(), limit: 1, appid: apiKey() },
});
if (!data.length) throw new Error(`Location not found: ${location}`);
    const { lat, lon } = data[0];
    return { lat, lon };
  });
};

/**
 * Current weather for a location string or lat/lon
 */
const getCurrentWeather = async ({ location, lat, lon }) => {
  const coords = lat && lon ? { lat, lon } : await geocode(location);
  const key = `current:${coords.lat.toFixed(2)}:${coords.lon.toFixed(2)}`;

  return cached(key, async () => {
    const { data } = await axios.get(`${BASE_URL}/weather`, {
      params: { lat: coords.lat, lon: coords.lon, units: "metric", appid: apiKey() },
    });
    return formatCurrent(data);
  });
};

/**
 * 5-day / 3-hour forecast for a location
 */
const getForecast = async ({ location, lat, lon }) => {
  const coords = lat && lon ? { lat, lon } : await geocode(location);
  const key = `forecast:${coords.lat.toFixed(2)}:${coords.lon.toFixed(2)}`;

  return cached(key, async () => {
    const { data } = await axios.get(`${BASE_URL}/forecast`, {
      params: { lat: coords.lat, lon: coords.lon, units: "metric", appid: apiKey() },
    });
    return formatForecast(data);
  });
};

// ─── Formatters ────────────────────────────────────────────────────────────

const formatCurrent = (d) => ({
  temperature: Math.round(d.main.temp),
  feelsLike: Math.round(d.main.feels_like),
  humidity: d.main.humidity,
  description: d.weather[0].description,
  icon: `https://openweathermap.org/img/wn/${d.weather[0].icon}@2x.png`,
  windSpeed: d.wind.speed,
  cityName: d.name,
  country: d.sys.country,
  sunrise: new Date(d.sys.sunrise * 1000).toISOString(),
  sunset: new Date(d.sys.sunset * 1000).toISOString(),
});

const formatForecast = (d) => {
  // Group by day — pick the noon slot per day
  const byDay = {};
  for (const item of d.list) {
    const date = item.dt_txt.split(" ")[0];
    const hour = item.dt_txt.split(" ")[1];
    if (!byDay[date] || hour === "12:00:00") {
      byDay[date] = {
        date,
        tempMin: Math.round(item.main.temp_min),
        tempMax: Math.round(item.main.temp_max),
        description: item.weather[0].description,
        icon: `https://openweathermap.org/img/wn/${item.weather[0].icon}@2x.png`,
        humidity: item.main.humidity,
        windSpeed: item.wind.speed,
        precipitation: item.pop ? Math.round(item.pop * 100) : 0,
      };
    }
  }
  return {
    cityName: d.city.name,
    country: d.city.country,
    days: Object.values(byDay).slice(0, 5),
  };
};

module.exports = { getCurrentWeather, getForecast, geocode };
