// src/services/geocoding.ts
// Reusable OpenStreetMap Nominatim and OSRM routing service module

export interface LocationSuggestion {
  id: string;
  displayName: string;
  name: string;
  locality: string;
  lat: number;
  lon: number;
}

export interface RouteResult {
  distanceKm: number;
  durationMin: number;
  summary?: string;
}

export const RATE_PER_KM = 24;

// Central fare calculation rule: actual driving distance (km) * ₹24
export function calculateFare(distanceKm: number): number {
  return Math.round(distanceKm * RATE_PER_KM);
}

/**
 * Searches real places, addresses, or landmarks via OpenStreetMap Nominatim
 */
export async function searchLocations(
  query: string,
  signal?: AbortSignal
): Promise<LocationSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
    trimmed
  )}&addressdetails=1&limit=6&accept-language=en`;

  const response = await fetch(url, {
    signal,
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Location lookup failed (${response.status})`);
  }

  const data = await response.json();

  if (!Array.isArray(data)) return [];

  return data.map((item: any) => {
    const addr = item.address || {};
    const primaryName =
      addr.road ||
      addr.suburb ||
      addr.neighbourhood ||
      addr.commercial ||
      addr.amenity ||
      item.name ||
      item.display_name.split(",")[0];

    const localityParts = [
      addr.suburb,
      addr.city || addr.town || addr.county,
      addr.state,
    ].filter(Boolean);

    const locality = localityParts.length > 0 ? localityParts.join(", ") : item.display_name;

    return {
      id: String(item.place_id || `${item.lat},${item.lon}`),
      displayName: item.display_name,
      name: primaryName,
      locality,
      lat: parseFloat(item.lat),
      lon: parseFloat(item.lon),
    };
  });
}

/**
 * Reverse geocodes coordinates to a readable address using Nominatim
 */
export async function reverseGeocode(
  lat: number,
  lon: number,
  signal?: AbortSignal
): Promise<LocationSuggestion> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1&accept-language=en`;

  const response = await fetch(url, {
    signal,
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Reverse geocoding failed (${response.status})`);
  }

  const item = await response.json();
  const addr = item.address || {};
  const primaryName =
    addr.road ||
    addr.suburb ||
    addr.neighbourhood ||
    item.name ||
    item.display_name.split(",")[0];

  const localityParts = [
    addr.suburb,
    addr.city || addr.town || addr.county,
    addr.state,
  ].filter(Boolean);

  return {
    id: String(item.place_id || `${lat},${lon}`),
    displayName: item.display_name,
    name: primaryName,
    locality: localityParts.join(", "),
    lat,
    lon,
  };
}

/**
 * Computes real driving distance and duration via OSRM public routing API
 */
export async function getDrivingRoute(
  pickup: { lat: number; lon: number },
  dropoff: { lat: number; lon: number },
  signal?: AbortSignal
): Promise<RouteResult> {
  // Validate coordinates
  if (
    typeof pickup.lat !== "number" ||
    typeof pickup.lon !== "number" ||
    typeof dropoff.lat !== "number" ||
    typeof dropoff.lon !== "number"
  ) {
    throw new Error("Invalid pickup or destination coordinates.");
  }

  // Prevent identical coordinates request
  const latDiff = Math.abs(pickup.lat - dropoff.lat);
  const lonDiff = Math.abs(pickup.lon - dropoff.lon);
  if (latDiff < 0.0001 && lonDiff < 0.0001) {
    throw new Error("Pickup and destination locations are identical.");
  }

  // OSRM coordinates format: {lon},{lat};{lon},{lat}
  const url = `https://router.project-osrm.org/route/v1/driving/${pickup.lon},${pickup.lat};${dropoff.lon},${dropoff.lat}?overview=false&alternatives=false&steps=false`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  // Link passed signal if provided
  if (signal) {
    signal.addEventListener("abort", () => controller.abort());
  }

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Routing request returned status ${response.status}`);
    }

    const data = await response.json();

    if (data.code !== "Ok" || !data.routes || data.routes.length === 0) {
      throw new Error(data.message || "No viable driving route found between these locations.");
    }

    const bestRoute = data.routes[0];
    const distanceMeters = bestRoute.distance; // in meters
    const durationSeconds = bestRoute.duration; // in seconds

    const distanceKm = Math.round((distanceMeters / 1000) * 10) / 10; // 1 decimal place
    const durationMin = Math.max(1, Math.round(durationSeconds / 60));

    return {
      distanceKm: Math.max(0.5, distanceKm),
      durationMin,
      summary: bestRoute.legs?.[0]?.summary || "",
    };
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === "AbortError") {
      throw new Error("Route calculation timed out. Please try again.");
    }
    throw error;
  }
}
