/**
 * services/weatherService.ts
 * 
 * Free & Unlimited Weather Integration
 * Using Open-Meteo API (completely free, no API key required)
 * Provides real weather data for better prediction accuracy
 */

export interface WeatherContext {
  temperature: number;        // Celsius
  humidity: number;           // 0-100%
  windSpeed: number;          // km/h
  windDirection: number;      // degrees (0-360)
  condition: string;          // "clear" | "cloudy" | "rainy" | "snowy" | "thunderstorm"
  precipitation: number;      // mm
  cloudCover: number;         // 0-100%
  visibility: number;         // meters
  uvIndex: number;            // 0-11+
}

export interface StadiumLocation {
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  city: string;
}

/**
 * Major UK Football Stadiums (Add more as needed)
 */
const STADIUMS: Record<string, StadiumLocation> = {
  // Premier League
  "Etihad Stadium": { name: "Etihad Stadium", latitude: 53.4835, longitude: -2.2001, country: "England", city: "Manchester" },
  "Anfield": { name: "Anfield", latitude: 53.4309, longitude: -2.9613, country: "England", city: "Liverpool" },
  "Old Trafford": { name: "Old Trafford", latitude: 53.4629, longitude: -2.2913, country: "England", city: "Manchester" },
  "Emirates Stadium": { name: "Emirates Stadium", latitude: 51.5549, longitude: -0.1084, country: "England", city: "London" },
  "Stamford Bridge": { name: "Stamford Bridge", latitude: 51.4819, longitude: -0.1909, country: "England", city: "London" },
  "Tottenham Hotspur Stadium": { name: "Tottenham Stadium", latitude: 51.6041, longitude: -0.0660, country: "England", city: "London" },
  "Goodison Park": { name: "Goodison Park", latitude: 53.4385, longitude: -2.6662, country: "England", city: "Liverpool" },
  "King Power Stadium": { name: "King Power", latitude: 52.6200, longitude: -1.1423, country: "England", city: "Leicester" },
  "St James Park": { name: "St James Park", latitude: 54.9754, longitude: -1.6213, country: "England", city: "Newcastle" },
  "Selhurst Park": { name: "Selhurst Park", latitude: 51.3981, longitude: -0.0850, country: "England", city: "London" },
  
  // La Liga (Spain)
  "Santiago Bernabéu": { name: "Santiago Bernabéu", latitude: 40.4530, longitude: -3.6883, country: "Spain", city: "Madrid" },
  "Camp Nou": { name: "Camp Nou", latitude: 41.5609, longitude: 1.9913, country: "Spain", city: "Barcelona" },
  "Wanda Metropolitano": { name: "Wanda Metropolitano", latitude: 40.4356, longitude: -3.5995, country: "Spain", city: "Madrid" },
  "Mestalla": { name: "Mestalla", latitude: 39.4740, longitude: -0.3580, country: "Spain", city: "Valencia" },
  
  // Serie A (Italy)
  "San Siro": { name: "San Siro", latitude: 45.4769, longitude: 9.1171, country: "Italy", city: "Milan" },
  "Stadio Olimpico": { name: "Stadio Olimpico", latitude: 41.9342, longitude: 12.6428, country: "Italy", city: "Rome" },
  
  // Bundesliga (Germany)
  "Allianz Arena": { name: "Allianz Arena", latitude: 48.2188, longitude: 11.6241, country: "Germany", city: "Munich" },
  "Signal Iduna Park": { name: "Signal Iduna Park", latitude: 51.4432, longitude: 7.4415, country: "Germany", city: "Dortmund" },
  "Mercedes-Benz Arena": { name: "Mercedes-Benz Arena", latitude: 48.7272, longitude: 9.1212, country: "Germany", city: "Stuttgart" },
  
  // Ligue 1 (France)
  "Parc des Princes": { name: "Parc des Princes", latitude: 48.8450, longitude: 2.2528, country: "France", city: "Paris" },
  "Stade de France": { name: "Stade de France", latitude: 48.9261, longitude: 2.3603, country: "France", city: "Paris" },
};

/**
 * Fetch real weather data from Open-Meteo (FREE, UNLIMITED)
 * No API key required, no rate limits
 */
export async function getMatchWeather(
  venueName: string | null,
  matchDateTime: string,  // ISO format: "2026-04-02T15:00:00Z"
  lat?: number,
  lng?: number
): Promise<WeatherContext | null> {
  try {
    // Determine coordinates
    let latitude = lat;
    let longitude = lng;

    if (!latitude || !longitude) {
      if (!venueName) {
        // Default to London if no venue
        latitude = 51.5074;
        longitude = -0.1278;
      } else {
        const stadium = STADIUMS[venueName];
        if (!stadium) {
          console.warn(`[weather] Stadium not found: "${venueName}" - using London as fallback`);
          latitude = 51.5074;
          longitude = -0.1278;
        } else {
          latitude = stadium.latitude;
          longitude = stadium.longitude;
        }
      }
    }

    const dateOnly = matchDateTime.split("T")[0]; // "2026-04-02"

    // Open-Meteo API (completely free, no auth needed)
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.append("latitude", String(latitude));
    url.searchParams.append("longitude", String(longitude));
    url.searchParams.append("start_date", dateOnly);
    url.searchParams.append("end_date", dateOnly);
    url.searchParams.append("hourly", "temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m,cloud_cover,visibility,uv_index");
    url.searchParams.append("temperature_unit", "celsius");
    url.searchParams.append("wind_speed_unit", "kmh");
    url.searchParams.append("timezone", "UTC");

    const res = await fetch(url.toString(), { cache: "no-store" });

    if (!res.ok) {
      console.warn(`[weather] Open-Meteo error: ${res.status}`);
      return null;
    }

    const data = await res.json();

    if (!data.hourly?.time || data.hourly.time.length === 0) {
      console.warn(`[weather] No hourly data returned`);
      return null;
    }

    // Get data for match time (use 15:00 UTC if not specified)
    const matchHour = matchDateTime.includes("T") 
      ? parseInt(matchDateTime.split("T")[1].split(":")[0])
      : 15;

    const hourIndex = data.hourly.time.findIndex((t: string) => 
      t.startsWith(`${dateOnly}T${String(matchHour).padStart(2, "0")}`)
    );

    const idx = hourIndex >= 0 ? hourIndex : 0;

    const weatherCode = data.hourly.weather_code?.[idx] ?? 0;
    const condition = mapWMOCode(weatherCode);

    return {
      temperature: Math.round((data.hourly.temperature_2m?.[idx] ?? 15) * 10) / 10,
      humidity: data.hourly.relative_humidity_2m?.[idx] ?? 60,
      windSpeed: Math.round((data.hourly.wind_speed_10m?.[idx] ?? 5) * 10) / 10,
      windDirection: data.hourly.wind_direction_10m?.[idx] ?? 0,
      condition,
      precipitation: data.hourly.precipitation?.[idx] ?? 0,
      cloudCover: data.hourly.cloud_cover?.[idx] ?? 50,
      visibility: data.hourly.visibility?.[idx] ?? 10000,
      uvIndex: data.hourly.uv_index?.[idx] ?? 2
    };
  } catch (err: any) {
    console.warn("[weather] Error:", err.message);
    return null;
  }
}

/**
 * Convert WMO weather codes to readable conditions
 * Reference: https://www.open-meteo.com/en/docs
 */
function mapWMOCode(code: number): string {
  if (code === 0 || code === 1) return "clear";
  if (code === 2 || code === 3) return "cloudy";
  if (code >= 45 && code <= 48) return "foggy";
  if (code >= 51 && code <= 67) return "rainy";
  if (code >= 71 && code <= 77) return "snowy";
  if (code >= 80 && code <= 82) return "rainy";
  if (code >= 85 && code <= 86) return "shower";
  if (code >= 95 && code <= 99) return "thunderstorm";
  return "unknown";
}

/**
 * Get weather impact description for AI
 */
export function analyzeWeatherImpact(weather: WeatherContext): string {
  const impacts: string[] = [];

  // Temperature analysis
  if (weather.temperature < 0) {
    impacts.push("Freezing pitch affects ball control & passing accuracy");
  } else if (weather.temperature < 5) {
    impacts.push("Cold weather increases injury risk, reduces player mobility");
  } else if (weather.temperature > 28) {
    impacts.push("Hot weather causes fatigue - expect slower play in 2nd half");
  }

  // Precipitation analysis
  if (weather.precipitation > 5) {
    impacts.push("Heavy rain reduces scoring - wet ball harder to control");
    if (weather.windSpeed > 25) {
      impacts.push("Combined rain + wind makes long passes unreliable");
    }
  } else if (weather.precipitation > 0) {
    impacts.push("Light rain - slightly slower play, more defensive focus");
  }

  // Wind analysis
  if (weather.windSpeed > 35) {
    impacts.push("Strong wind (>35km/h) makes ball unpredictable");
  } else if (weather.windSpeed > 25) {
    impacts.push("Moderate wind affects long-range shooting & crosses");
  }

  // Cloud cover
  if (weather.cloudCover > 90) {
    impacts.push("Heavy cloud cover reduces visibility - more defensive play");
  }

  // Visibility
  if (weather.visibility < 5000) {
    impacts.push("Poor visibility affects aerial play & long passes");
  }

  // UV Index (affects player energy)
  if (weather.uvIndex > 8) {
    impacts.push("High UV index increases sun fatigue - rotate players");
  }

  return impacts.length > 0 
    ? impacts.join(". ")
    : "Normal playing conditions.";
}

/**
 * Format weather for AI prompt
 */
export function formatWeatherForAI(weather: WeatherContext, venue?: string): string {
  const venueStr = venue ? `\nVenue: ${venue}` : "";
  
  return `WEATHER CONDITIONS:${venueStr}
Temperature: ${weather.temperature}°C
Humidity: ${weather.humidity}%
Wind: ${weather.windSpeed}km/h (${weather.windDirection}°)
Precipitation: ${weather.precipitation}mm
Cloud Cover: ${weather.cloudCover}%
Conditions: ${weather.condition.toUpperCase()}

WEATHER IMPACT ON PLAY:
${analyzeWeatherImpact(weather)}`;
}
