import { describe, it, expect } from 'vitest';
import { sunrise, sunset, isDaytime, solarAltitude } from './suntimes.js';

// ZIP 30324 (NE Atlanta). Reference sun times below are published Atlanta
// values; the algorithm is accurate to ~1-3 min, so we assert an 8-minute
// tolerance. All comparisons use absolute instants, so the suite is
// timezone-independent (passes on an Atlanta laptop and a UTC CI box alike).
const LAT = 33.82;
const LON = -84.35;
const TOL_MS = 8 * 60_000;

function closeTo(actual, isoExpected) {
  return Math.abs(actual.getTime() - new Date(isoExpected).getTime()) < TOL_MS;
}

describe('sunrise / sunset', () => {
  it('matches published Atlanta times at the summer solstice', () => {
    const day = new Date('2026-06-21T12:00:00Z');
    expect(closeTo(sunrise(day, LAT, LON), '2026-06-21T10:26:00Z')).toBe(true); // 06:26 EDT
    expect(closeTo(sunset(day, LAT, LON), '2026-06-22T00:52:00Z')).toBe(true);  // 20:52 EDT
  });

  it('matches published Atlanta times at the winter solstice', () => {
    const day = new Date('2026-12-21T12:00:00Z');
    expect(closeTo(sunrise(day, LAT, LON), '2026-12-21T12:41:00Z')).toBe(true); // 07:41 EST
    expect(closeTo(sunset(day, LAT, LON), '2026-12-21T22:35:00Z')).toBe(true);  // 17:35 EST
  });

  it('rises before it sets', () => {
    const day = new Date('2026-09-15T12:00:00Z');
    expect(sunrise(day, LAT, LON).getTime()).toBeLessThan(sunset(day, LAT, LON).getTime());
  });

  it('has longer days in summer than winter', () => {
    const summer = sunset(new Date('2026-06-21T12:00:00Z'), LAT, LON) - sunrise(new Date('2026-06-21T12:00:00Z'), LAT, LON);
    const winter = sunset(new Date('2026-12-21T12:00:00Z'), LAT, LON) - sunrise(new Date('2026-12-21T12:00:00Z'), LAT, LON);
    expect(summer).toBeGreaterThan(winter);
  });

  it('returns null on the polar edge (midnight sun)', () => {
    const arctic = new Date('2026-06-21T12:00:00Z');
    expect(sunset(arctic, 78, 15)).toBeNull();  // Svalbard: sun never sets
    expect(sunrise(arctic, 78, 15)).toBeNull();
  });
});

describe('solarAltitude / isDaytime', () => {
  it('peaks near (90 - lat + declination) at solar noon', () => {
    // Summer-solstice noon in Atlanta ≈ 17:39 UTC; max altitude ≈ 79.6°.
    const alt = solarAltitude(new Date('2026-06-21T17:39:00Z'), LAT, LON);
    expect(alt).toBeGreaterThan(78);
    expect(alt).toBeLessThan(81);
  });

  it('is daytime at local midday, night in the small hours', () => {
    expect(isDaytime(new Date('2026-06-21T17:39:00Z'), LAT, LON)).toBe(true);  // ~1:39pm EDT
    expect(isDaytime(new Date('2026-06-22T06:00:00Z'), LAT, LON)).toBe(false); // ~2:00am EDT
  });
});
