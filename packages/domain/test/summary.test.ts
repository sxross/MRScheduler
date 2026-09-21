import { describe, expect, it } from 'vitest';
import { describeDays, describeEndpoint, describeReason, describeSchedule } from '../src/scheduling/summary.js';
import { EVERY_DAY } from './fixtures.js';

describe('generated summaries', () => {
  it('describes astronomical endpoints in plain language', () => {
    expect(describeEndpoint({ kind: 'astro', event: 'sunset', offsetMinutes: -20 })).toBe('20 minutes before sunset');
    expect(describeEndpoint({ kind: 'astro', event: 'sunrise', offsetMinutes: 30 })).toBe('30 minutes after sunrise');
    expect(describeEndpoint({ kind: 'astro', event: 'dusk', offsetMinutes: 0 })).toBe('at dusk');
    expect(describeEndpoint({ kind: 'astro', event: 'nauticalDawn', offsetMinutes: 90 })).toBe('1 hour 30 minutes after nautical dawn');
  });

  it('describes absolute endpoints on a 12-hour clock', () => {
    expect(describeEndpoint({ kind: 'absolute', minutesOfDay: 18 * 60 + 30 })).toBe('at 6:30 PM');
    expect(describeEndpoint({ kind: 'absolute', minutesOfDay: 0 })).toBe('at 12:00 AM');
  });

  it('produces compact reasons for the upcoming-events list', () => {
    expect(describeReason({ kind: 'astro', event: 'sunset', offsetMinutes: -20 })).toBe('Sunset - 20 min');
    expect(describeReason({ kind: 'absolute', minutesOfDay: 0 })).toBe('Absolute time');
  });

  it('collapses common day selections', () => {
    expect(describeDays(EVERY_DAY)).toBe('every day');
    expect(describeDays(['mon', 'tue', 'wed', 'thu', 'fri'])).toBe('weekdays');
    expect(describeDays(['sat', 'sun'])).toBe('weekends');
    expect(describeDays(['wed', 'mon'])).toBe('Mon, Wed');
  });

  it('names an exemption in the summary rather than hiding it', () => {
    const text = describeSchedule({
      id: 'k', deviceId: 'kitchen', enabled: true,
      on: { kind: 'absolute', minutesOfDay: 6 * 60 },
      off: { kind: 'absolute', minutesOfDay: 9 * 60 },
      days: EVERY_DAY,
      exemptFrom: ['on'],
    });
    expect(text).toBe('Turns on at 6:00 AM and off at 9:00 AM, every day. Exempt from the ON fence.');
  });
});
