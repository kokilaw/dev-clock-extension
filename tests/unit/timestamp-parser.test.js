const test = require('node:test');
const assert = require('node:assert/strict');
const { DateTime } = require('luxon');
const { parseTimestamp } = require('../../src/shared/timestamp-parser');

const FIXED_NOW = DateTime.fromISO('2026-04-26T15:45:30', { zone: 'UTC' });

function parse(raw, sourceTz, extraOptions = {}) {
  return parseTimestamp(raw, sourceTz, {
    now: FIXED_NOW,
    localTimezone: extraOptions.localTimezone,
  });
}

function expectParsedMillis(raw, sourceTz, expectedMillis, extraOptions = {}) {
  const result = parse(raw, sourceTz, extraOptions);
  assert.equal(result.millis, expectedMillis, `Expected \"${raw}\" to parse in ${sourceTz}`);
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
  const expected = FIXED_NOW.setZone('Europe/London').startOf('day').set({
    hour: 9,
    minute: 0,
    second: 0,
    millisecond: 0,
  }).toMillis();
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
  const expected = FIXED_NOW.setZone('Asia/Tokyo').startOf('day').set({
    hour: 9,
    minute: 0,
    second: 0,
    millisecond: 0,
  }).toMillis();
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

test('uses bundled timezone abbreviation data for trailing abbreviations', () => {
  const result = parse('2026-04-25T14:30:00 PST', 'UTC');
  const expected = DateTime.fromISO('2026-04-25T22:30:00Z').toMillis();
  assert.equal(result.millis, expected);
});

test('parses time-only input with trailing UTC abbreviation without external abbreviation data', () => {
  const result = parse('09:00 UTC', 'America/New_York');
  const expected = DateTime.fromObject(
    { year: 2026, month: 4, day: 26, hour: 9, minute: 0, second: 0, millisecond: 0 },
    { zone: 'UTC' }
  ).toMillis();
  assert.equal(result.millis, expected);
});

test('parses Apache-style log-native formats', () => {
  const result = parse('10/Oct/2000:13:55:36 -0700', 'UTC');
  assert.equal(result.millis, Date.parse('2000-10-10T20:55:36.000Z'));
});

test('parses fractional time-only input as today', () => {
  const result = parse('14:30:22.455', 'UTC');
  const expected = FIXED_NOW.setZone('UTC').startOf('day').set({
    hour: 14,
    minute: 30,
    second: 22,
    millisecond: 455,
  }).toMillis();
  assert.equal(result.millis, expected);
});

test('core parser input families', async (t) => {
  await t.test('supports ISO-like families', () => {
    const cases = [
      {
        raw: '2024-06-10T14:30:00+05:30',
        sourceTz: 'UTC',
        expected: DateTime.fromISO('2024-06-10T14:30:00+05:30').toMillis(),
      },
      {
        raw: '2024-06-10',
        sourceTz: 'America/New_York',
        expected: DateTime.fromISO('2024-06-10', { zone: 'America/New_York' }).toMillis(),
      },
      {
        raw: '2026-04-25 14:30:00',
        sourceTz: 'UTC',
        expected: DateTime.fromObject(
          { year: 2026, month: 4, day: 25, hour: 14, minute: 30, second: 0, millisecond: 0 },
          { zone: 'UTC' }
        ).toMillis(),
      },
    ];

    for (const { raw, sourceTz, expected } of cases) {
      expectParsedMillis(raw, sourceTz, expected);
    }
  });

  await t.test('supports time-only families', () => {
    const cases = [
      {
        raw: '9pm',
        sourceTz: 'UTC',
        expected: DateTime.fromObject(
          { year: 2026, month: 4, day: 26, hour: 21, minute: 0, second: 0, millisecond: 0 },
          { zone: 'UTC' }
        ).toMillis(),
      },
      {
        raw: '09:00:15',
        sourceTz: 'UTC',
        expected: DateTime.fromObject(
          { year: 2026, month: 4, day: 26, hour: 9, minute: 0, second: 15, millisecond: 0 },
          { zone: 'UTC' }
        ).toMillis(),
      },
      {
        raw: '0005',
        sourceTz: 'UTC',
        expected: DateTime.fromObject(
          { year: 2026, month: 4, day: 26, hour: 0, minute: 5, second: 0, millisecond: 0 },
          { zone: 'UTC' }
        ).toMillis(),
      },
    ];

    for (const { raw, sourceTz, expected } of cases) {
      expectParsedMillis(raw, sourceTz, expected);
    }
  });

  await t.test('supports relative shorthand variants', () => {
    const cases = [
      {
        raw: '-30m',
        sourceTz: 'UTC',
        expected: FIXED_NOW.setZone('UTC').minus({ minutes: 30 }).toMillis(),
      },
      {
        raw: '-2d',
        sourceTz: 'UTC',
        expected: FIXED_NOW.setZone('UTC').minus({ days: 2 }).toMillis(),
      },
      {
        raw: 'now - 15s',
        sourceTz: 'UTC',
        expected: FIXED_NOW.setZone('UTC').minus({ seconds: 15 }).toMillis(),
      },
    ];

    for (const { raw, sourceTz, expected } of cases) {
      expectParsedMillis(raw, sourceTz, expected);
    }
  });

  await t.test('supports natural relative-day phrases', () => {
    const cases = [
      {
        raw: 'today',
        sourceTz: 'UTC',
        expected: DateTime.fromObject(
          { year: 2026, month: 4, day: 26, hour: 0, minute: 0, second: 0, millisecond: 0 },
          { zone: 'UTC' }
        ).toMillis(),
      },
      {
        raw: 'today 9am',
        sourceTz: 'UTC',
        expected: DateTime.fromObject(
          { year: 2026, month: 4, day: 26, hour: 9, minute: 0, second: 0, millisecond: 0 },
          { zone: 'UTC' }
        ).toMillis(),
      },
      {
        raw: 'tomorrow 08:30',
        sourceTz: 'UTC',
        expected: DateTime.fromObject(
          { year: 2026, month: 4, day: 27, hour: 8, minute: 30, second: 0, millisecond: 0 },
          { zone: 'UTC' }
        ).toMillis(),
      },
    ];

    for (const { raw, sourceTz, expected } of cases) {
      expectParsedMillis(raw, sourceTz, expected);
    }
  });

  await t.test('supports last-weekday variants', () => {
    const cases = [
      {
        raw: 'last friday',
        sourceTz: 'UTC',
        expected: DateTime.fromObject(
          { year: 2026, month: 4, day: 24, hour: 0, minute: 0, second: 0, millisecond: 0 },
          { zone: 'UTC' }
        ).toMillis(),
      },
      {
        raw: 'last sunday at 11:15pm',
        sourceTz: 'UTC',
        expected: DateTime.fromObject(
          { year: 2026, month: 4, day: 19, hour: 23, minute: 15, second: 0, millisecond: 0 },
          { zone: 'UTC' }
        ).toMillis(),
      },
    ];

    for (const { raw, sourceTz, expected } of cases) {
      expectParsedMillis(raw, sourceTz, expected);
    }
  });

  await t.test('supports month-day variants', () => {
    const cases = [
      {
        raw: 'October 30th',
        sourceTz: 'UTC',
        expected: DateTime.fromObject(
          { year: 2026, month: 10, day: 30, hour: 0, minute: 0, second: 0, millisecond: 0 },
          { zone: 'UTC' }
        ).toMillis(),
      },
      {
        raw: 'January 1st at 12:01am',
        sourceTz: 'UTC',
        expected: DateTime.fromObject(
          { year: 2026, month: 1, day: 1, hour: 0, minute: 1, second: 0, millisecond: 0 },
          { zone: 'UTC' }
        ).toMillis(),
      },
    ];

    for (const { raw, sourceTz, expected } of cases) {
      expectParsedMillis(raw, sourceTz, expected);
    }
  });

  await t.test('supports built-in timezone suffix variants', () => {
    const cases = [
      {
        raw: '13:00 GMT',
        sourceTz: 'America/New_York',
        expected: DateTime.fromObject(
          { year: 2026, month: 4, day: 26, hour: 13, minute: 0, second: 0, millisecond: 0 },
          { zone: 'UTC' }
        ).toMillis(),
      },
      {
        raw: '2026-04-25T14:30:00 Z',
        sourceTz: 'America/New_York',
        expected: DateTime.fromISO('2026-04-25T14:30:00Z').toMillis(),
      },
    ];

    for (const { raw, sourceTz, expected } of cases) {
      expectParsedMillis(raw, sourceTz, expected);
    }
  });
});

test('bundled parser vendor families', () => {
  const cases = [
    ['13:00 EST', 'UTC', DateTime.fromISO('2026-04-26T18:00:00Z').toMillis()],
    ['2026-04-25T14:30:00 AEDT', 'UTC', DateTime.fromISO('2026-04-25T04:30:00Z').toMillis()],
    ['2026-04-25 14:30 BST', 'UTC', DateTime.fromISO('2026-04-25T14:30:00Z').toMillis()],
    ['2026/04/25 14:30:00', 'UTC', DateTime.fromISO('2026-04-25T14:30:00Z').toMillis()],
    ['Fri, 25 Apr 2026 14:30:00 GMT', 'UTC', DateTime.fromISO('2026-04-25T14:30:00Z').toMillis()],
  ];

  for (const [raw, sourceTz, expected] of cases) {
    expectParsedMillis(raw, sourceTz, expected);
  }
});

test('uses chrono fallback for advanced natural-language phrases', () => {
  const result = parse('first business day of next month', 'UTC');
  const localReference = FIXED_NOW.setZone(DateTime.local().zoneName).plus({ months: 1 });
  const expected = DateTime.fromObject(
    {
      year: localReference.year,
      month: localReference.month,
      day: localReference.day,
      hour: localReference.hour,
      minute: localReference.minute,
      second: localReference.second,
      millisecond: localReference.millisecond,
    },
    { zone: 'UTC' }
  ).toMillis();
  assert.equal(result.millis, expected);
});

test('README input examples smoke test', () => {
  const samples = [
    ['[2024-06-10T14:30:00Z]', 'UTC'],
    ['("2024-06-10T14:30:00Z")', 'UTC'],
    ['-2h', 'UTC'],
    ['-30m', 'UTC'],
    ['now-1h', 'UTC'],
    ['-45s', 'UTC'],
    ['1718000000', 'UTC'],
    ['1718000000000', 'UTC'],
    ['2024-06-10T14:30:00Z', 'America/New_York'],
    ['2026-04-25T04:15:22.455Z', 'UTC'],
    ['2024-06-10T09:00:00-05:00', 'UTC'],
    ['2024-06-10T14:30:00', 'America/New_York'],
    ['2026-04-25 04:15Z', 'UTC'],
    ['2026-04-25T14:30:00 PST', 'UTC'],
    ['10/Oct/2000:13:55:36 -0700', 'UTC'],
    ['Oct 10 13:55:36', 'UTC'],
    ['2026-04-25 14:30:22.455', 'UTC'],
    ['14:30:22.455', 'UTC'],
    ['2026-04-25 14:30 EST', 'UTC'],
    ['2026-04-25 14:30 AEDT', 'UTC'],
    ['2026-04-25 14:30 BST', 'UTC'],
    ['09:00', 'UTC'],
    ['14:30', 'UTC'],
    ['08:30:45', 'UTC'],
    ['3:14pm', 'UTC'],
    ['9am', 'UTC'],
    ['1545', 'UTC'],
    ['0900', 'UTC'],
    ['today at 5pm', 'UTC'],
    ['today 14:30', 'UTC'],
    ['yesterday at 5pm', 'UTC'],
    ['tomorrow 9am', 'UTC'],
    ['last Monday 08:30', 'UTC'],
    ['last Friday at 3pm', 'UTC'],
    ['October 30th 2pm', 'UTC'],
    ['January 1st 9am', 'UTC'],
    ['next friday 4pm', 'UTC'],
    ['2 hours ago', 'UTC'],
    ['tomorrow noon', 'UTC'],
  ];

  for (const [raw, sourceTz] of samples) {
    const result = parse(raw, sourceTz);
    assert.equal(Number.isFinite(result.millis), true, `README sample should parse: ${raw}`);
  }
});
