// Deterministic, library-free sunrise/sunset calculation.
//
// Why compute instead of reading the weather API's sun.sunrise/sunset?
// The theme switch runs synchronously at page load and on a 5-minute interval
// (see theme-mode.js + main.js). Weather data resolves asynchronously and is
// null in mock/offline mode, so hanging the theme decision off it would make
// the kiosk's day/night state depend on network timing. A closed-form solar
// calculation is synchronous, works offline, and only needs lat/lon + the date.
// theme-mode.js still ACCEPTS a precomputed { sunrise, sunset } override, so if
// we ever want to prefer the API's figures we can pass them in — but the robust
// default is this local calc.
//
// Algorithm: the standard "sunrise equation" (NOAA / Wikipedia). Accurate to
// ~1 minute at mid latitudes, which is far tighter than a theme flip needs.

const RAD = Math.PI / 180;
const OBLIQUITY = 23.4397; // Earth's axial tilt, degrees
// Standard solar-disc correction: geometric center is 0.833° below the horizon
// at apparent sunrise/sunset (refraction + solar radius).
const HORIZON = -0.833;

// Julian date <-> epoch milliseconds. 2440587.5 is the Julian date of the Unix
// epoch (1970-01-01T00:00:00Z); 86400000 = ms per day.
function toJulian(ms) { return ms / 86400000 + 2440587.5; }
function fromJulian(jd) { return new Date((jd - 2440587.5) * 86400000); }

/**
 * Compute apparent sunrise and sunset for the local calendar day of `date`.
 *
 * @param {Date} date  Any instant on the target day (local time zone is used
 *                     to pick which calendar day).
 * @param {number} lat Latitude in degrees (north positive).
 * @param {number} lon Longitude in degrees (EAST positive; Atlanta ≈ -84.39).
 * @returns {{sunrise: Date|null, sunset: Date|null, transit: Date,
 *            alwaysDay: boolean, alwaysNight: boolean}}
 *          For polar day/night, sunrise/sunset are null and the corresponding
 *          flag is set.
 */
export function sunTimes(date, lat, lon) {
  // Anchor to local noon so we compute the solar events for the day the caller
  // means, regardless of UTC offset. Epoch comparisons downstream stay TZ-safe.
  const noon = new Date(date);
  noon.setHours(12, 0, 0, 0);

  // n: integer day count since J2000.0, corrected for leap seconds (0.0008).
  const n = Math.round(toJulian(noon.getTime()) - 2451545.0 + 0.0008);

  // Mean solar time at this longitude. Longitude is east-positive, so western
  // longitudes (Atlanta ≈ -84.39) push solar noon later than UTC noon.
  const Jstar = n - lon / 360;

  // Solar mean anomaly.
  const M = (357.5291 + 0.98560028 * Jstar) % 360;
  const Mr = M * RAD;

  // Equation of the center.
  const C = 1.9148 * Math.sin(Mr) + 0.0200 * Math.sin(2 * Mr) + 0.0003 * Math.sin(3 * Mr);

  // Ecliptic longitude of the sun.
  const lambda = (M + C + 180 + 102.9372) % 360;
  const lambdaR = lambda * RAD;

  // Solar transit (local solar noon) as a Julian date.
  const Jtransit = 2451545.0 + Jstar + 0.0053 * Math.sin(Mr) - 0.0069 * Math.sin(2 * lambdaR);

  // Declination of the sun.
  const sinDec = Math.sin(lambdaR) * Math.sin(OBLIQUITY * RAD);
  const cosDec = Math.cos(Math.asin(sinDec));

  const latR = lat * RAD;
  // Hour angle at the horizon.
  const cosOmega =
    (Math.sin(HORIZON * RAD) - Math.sin(latR) * sinDec) / (Math.cos(latR) * cosDec);

  const transit = fromJulian(Jtransit);

  // Polar cases: the sun stays up or down all day at this latitude/date.
  if (cosOmega > 1) {
    return { sunrise: null, sunset: null, transit, alwaysDay: false, alwaysNight: true };
  }
  if (cosOmega < -1) {
    return { sunrise: null, sunset: null, transit, alwaysDay: true, alwaysNight: false };
  }

  const omega = Math.acos(cosOmega) / RAD; // degrees
  const Jrise = Jtransit - omega / 360;
  const Jset = Jtransit + omega / 360;

  return {
    sunrise: fromJulian(Jrise),
    sunset: fromJulian(Jset),
    transit,
    alwaysDay: false,
    alwaysNight: false,
  };
}

/**
 * True when `date` falls in daylight — at or after sunrise and before sunset
 * for its local calendar day. Before sunrise and after sunset both count as
 * night, which is exactly the "dark after sunset until the next sunrise" rule.
 *
 * An optional { sunrise, sunset } pair (e.g. from the weather API) is used
 * verbatim when both are present; otherwise sunTimes() computes them.
 */
export function isDaytime(date, { lat, lon, sun } = {}) {
  if (sun && sun.sunrise && sun.sunset) {
    const sunrise = new Date(sun.sunrise);
    const sunset = new Date(sun.sunset);
    if (!Number.isNaN(sunrise.getTime()) && !Number.isNaN(sunset.getTime())) {
      return date >= sunrise && date < sunset;
    }
  }
  const t = sunTimes(date, lat, lon);
  if (t.alwaysDay) return true;
  if (t.alwaysNight) return false;
  return date >= t.sunrise && date < t.sunset;
}
