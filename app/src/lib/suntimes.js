// Solar position + sunrise/sunset for a fixed location, computed locally — no
// network, no API dependency. A wall kiosk must decide "is it dark out?" even
// when the weather API is down, so this is pure math (the NOAA solar-position
// algorithm; official -0.833° geometric altitude → accounts for atmospheric
// refraction + the sun's disc). Accuracy is well under a minute, far tighter
// than a theme switch needs.
//
// Everything works from the absolute instant of a Date (via its UTC fields),
// so results are timezone-independent: the same moment yields the same answer
// on the Atlanta kiosk and on a UTC CI box. sunrise()/sunset() return Date
// instants (or null on the polar edge where the sun never rises/sets).

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;
const SUN_ALTITUDE = -0.833; // sun's geometric altitude at rise/set (degrees)

const sinDeg = (d) => Math.sin(d * D2R);
const cosDeg = (d) => Math.cos(d * D2R);
const tanDeg = (d) => Math.tan(d * D2R);
const mod = (n, m) => ((n % m) + m) % m;
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

// Sun's declination (deg) and the equation of time (minutes) at `date`. Both
// vary slowly, so evaluating them once for the instant of interest is plenty.
function solarParams(date) {
  const jd = date.getTime() / 86_400_000 + 2440587.5;
  const T = (jd - 2451545.0) / 36525; // Julian centuries since J2000.0

  const L0 = mod(280.46646 + T * (36000.76983 + T * 0.0003032), 360);
  const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
  const C = sinDeg(M) * (1.914602 - T * (0.004817 + 0.000014 * T))
          + sinDeg(2 * M) * (0.019993 - 0.000101 * T)
          + sinDeg(3 * M) * 0.000289;

  const trueLong = L0 + C;
  const omega = 125.04 - 1934.136 * T;
  const lambda = trueLong - 0.00569 - 0.00478 * sinDeg(omega);
  const eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
  const eps = eps0 + 0.00256 * cosDeg(omega);

  const dec = R2D * Math.asin(sinDeg(eps) * sinDeg(lambda));

  const y = tanDeg(eps / 2) ** 2;
  const eqTime = 4 * R2D * (
    y * sinDeg(2 * L0)
    - 2 * e * sinDeg(M)
    + 4 * e * y * sinDeg(M) * cosDeg(2 * L0)
    - 0.5 * y * y * sinDeg(4 * L0)
    - 1.25 * e * e * sinDeg(2 * M)
  );

  return { dec, eqTime };
}

// Sun's altitude above the horizon (degrees) at `date` for the given location.
export function solarAltitude(date, lat, lon) {
  const { dec, eqTime } = solarParams(date);
  const utMinutes = date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60;
  const trueSolarTime = mod(utMinutes + eqTime + 4 * lon, 1440);
  const hourAngle = trueSolarTime / 4 - 180;
  const cosZenith = sinDeg(lat) * sinDeg(dec) + cosDeg(lat) * cosDeg(dec) * cosDeg(hourAngle);
  return 90 - R2D * Math.acos(clamp(cosZenith, -1, 1));
}

export function isDaytime(date, lat, lon) {
  return solarAltitude(date, lat, lon) > SUN_ALTITUDE;
}

// Sunrise / sunset for the UTC calendar day of `date`, anchored to solar noon
// so the returned instant is unambiguous even where sunset falls after 00:00
// UTC (as it does for far-western longitudes like Atlanta). Returns null when
// the sun never crosses the horizon that day.
function event(date, lat, lon, isSunrise) {
  const { dec, eqTime } = solarParams(date);
  const cosH = (sinDeg(SUN_ALTITUDE) - sinDeg(lat) * sinDeg(dec)) / (cosDeg(lat) * cosDeg(dec));
  if (cosH > 1 || cosH < -1) return null; // never rises / never sets

  const H = R2D * Math.acos(cosH);              // half-day arc, degrees
  const noonMin = 720 - 4 * lon - eqTime;        // UTC minutes of solar noon
  const minutes = noonMin + (isSunrise ? -4 * H : 4 * H);
  const dayStart = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return new Date(dayStart + minutes * 60_000);
}

export function sunrise(date, lat, lon) {
  return event(date, lat, lon, true);
}

export function sunset(date, lat, lon) {
  return event(date, lat, lon, false);
}
