const test = require('node:test');
const assert = require('node:assert/strict');
const { DateTime } = require('luxon');
const { parseTimestamp } = require('../../timestamp-parser');

const FIXED_NOW = DateTime.fromISO('2026-04-26T15:45:30', { zone: 'UTC' });

function parse(raw, sourceTz, extraOptions = {}) {
  return parseTimestamp(raw, sourceTz, {
    now: FIXED_NOW,
    localTimezone: extraOptions.localTimezone,
  });
}

test('parses epoch seconds', () => {
  assert.deepEqual(parse('1718000000', 'UTC'), { millis: 1718000000000 });
});

test('parses epoch milliseconds', () => {
  assert.deepEqual(parse('1718000000000', 'UTC'), { millis: 1718000000000 });
});

test('parses ISO with explicit timezone independently of source timezone', () => {
  const result = parse('2024-06-10T14:30:00Z', 'America/New_York');
  assert.equal(result.millis, DateTime.fromISO('2024-06-10T14:30:00Z').toMillis());
});

test('parses naive ISO in selected source timezone', () => {
  const result = parse('2024-06-10T14:30:00', 'America/New_York');
  const expected = DateTime.fromISO('2024-06-10T14:30:00', { zone: 'America/New_York' }).toMillis();
  assert.equal(result.millis, expected);
});

test('parses 4-digit military time as today in source timezone', () => {
  const result = parse('1545', 'UTC');
  const expected = DateTime.fromISO('2026-04-26T15:45:00', { zone: 'UTC' }).toMillis();
  assert.equal(result.millis, expected);
});

test('parses time-only input as today in source timezone', () => {
  const result = parse('09:00', 'Europe/London');
  const expected = DateTime.fromISO('09:00', { zone: 'Europe/London' }).toMillis();
  assert.equal(result.millis, expected);
});

test('parses yesterday at 5pm in source timezone', () => {
  const result = parse('yesterday at 5pm', 'UTC');
  const expected = DateTime.fromISO('2026-04-25T17:00:00', { zone: 'UTC' }).toMillis();
  assert.equal(result.millis, expected);
});

test('parses last weekday expressions', () => {
  const result = parse('last monday 08:30', 'UTC');
  const expected = DateTime.fromISO('2026-04-20T08:30:00', { zone: 'UTC' }).toMillis();
  assert.equal(result.millis, expected);
});

test('parses month day expressions using current year', () => {
  const result = parse('October 30th 2pm', 'UTC');
  const expected = DateTime.fromISO('2026-10-30T14:00:00', { zone: 'UTC' }).toMillis();
  assert.equal(result.millis, expected);
});

test('uses localTimezone override when source timezone is LOCAL', () => {
  const result = parse('09:00', 'LOCAL', { localTimezone: 'Asia/Tokyo' });
  const expected = DateTime.fromISO('09:00', { zone: 'Asia/Tokyo' }).toMillis();
  assert.equal(result.millis, expected);
});

test('returns error for invalid input', () => {
  const result = parse('Meeting with Bob', 'UTC');
  assert.deepEqual(result, { error: 'Unable to parse date: "Meeting with Bob"' });
});

test('returns empty error for blank input', () => {
  assert.deepEqual(parse('   ', 'UTC'), { error: 'empty' });
});

test('normalizes surrounding brackets and whitespace before parsing', () => {
  const result = parse('   [ 2024-06-10T14:30:00Z ]   ', 'UTC');
  const expected = DateTime.fromISO('2024-06-10T14:30:00Z').toMillis();
  assert.equal(result.millis, expected);
});

test('supports relative shorthand offsets', () => {
  const result = parse('now-1h', 'UTC');
  const expected = FIXED_NOW.setZone('UTC').minus({ hours: 1 }).toMillis();
  assert.equal(result.millis, expected);
});

test('uses trailing timezone abbreviations for local resolution within the call', async (t) => {
  global.timezoneAbbreviations = {
    resolve(abbreviation) {
      return abbreviation === 'PST' ? 'America/Los_Angeles' : null;
    },
  };

  t.after(() => {
    delete global.timezoneAbbreviations;
  });

  const result = parse('2026-04-25T14:30:00 PST', 'UTC');
  const expected = DateTime.fromISO('2026-04-25T14:30:00', { zone: 'America/Los_Angeles' }).toMillis();
  assert.equal(result.millis, expected);
});

test('falls back to anyDateParser for log-native formats', async (t) => {
  global.anyDateParser = {
    fromString(input) {
      if (input === '10/Oct/2000:13:55:36 -0700') {
        return new Date('2000-10-10T20:55:36.000Z');
      }
      return null;
    },
  };

  t.after(() => {
    delete global.anyDateParser;
  });

  const result = parse('10/Oct/2000:13:55:36 -0700', 'UTC');
  assert.equal(result.millis, Date.parse('2000-10-10T20:55:36.000Z'));
});

test('defaults anyDateParser time-only results to today', async (t) => {
  global.anyDateParser = {
    fromString(input) {
      if (input === '14:30:22.455') {
        return { hour: 14, minute: 30, second: 22, millisecond: 455 };
      }
      return null;
    },
  };

  t.after(() => {
    delete global.anyDateParser;
  });

  const result = parse('14:30:22.455', 'UTC');
  const expected = FIXED_NOW.setZone('UTC').startOf('day').set({
    hour: 14,
    minute: 30,
    second: 22,
    millisecond: 455,
  }).toMillis();
  assert.equal(result.millis, expected);
});
