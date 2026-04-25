"use strict";

(function bootstrapTimestampParser(global) {
  const LuxonRef = global.Luxon || global.luxon || (typeof require === "function" ? require("luxon") : null);
  const DateTime = LuxonRef?.DateTime;

  if (!DateTime) {
    throw new Error("Luxon.DateTime is required for timestamp parsing.");
  }

  function getEffectiveSourceZone(sourceTz, options = {}) {
    if (sourceTz === "LOCAL") {
      return options.localTimezone || DateTime.local().zoneName;
    }

    return sourceTz;
  }

  function stripSurroundingNoise(value) {
    let cleaned = value.trim().replace(/\s+/g, " ");
    const enclosingPairs = {
      "(": ")",
      "[": "]",
      "{": "}",
      "<": ">",
      '"': '"',
      "'": "'",
    };

    let changed = true;
    while (changed && cleaned.length > 1) {
      changed = false;
      const expectedCloser = enclosingPairs[cleaned[0]];
      if (expectedCloser && cleaned[cleaned.length - 1] === expectedCloser) {
        cleaned = cleaned.slice(1, -1).trim().replace(/\s+/g, " ");
        changed = true;
      }
    }

    return cleaned;
  }

  function isUsableZone(zoneName) {
    return typeof zoneName === "string" && DateTime.now().setZone(zoneName).isValid;
  }

  function extractZoneFromCandidate(candidate) {
    if (!candidate) return null;

    if (typeof candidate === "string") {
      return isUsableZone(candidate) ? candidate : null;
    }

    if (Array.isArray(candidate)) {
      for (const item of candidate) {
        const zoneName = extractZoneFromCandidate(item);
        if (zoneName) return zoneName;
      }
      return null;
    }

    if (typeof candidate === "object") {
      const nestedValues = [
        candidate.zone,
        candidate.timezone,
        candidate.iana,
        candidate.ianaZone,
        candidate.name,
        candidate.value,
        candidate.canonical,
        candidate.zones,
        candidate.timezones,
      ];

      for (const value of nestedValues) {
        const zoneName = extractZoneFromCandidate(value);
        if (zoneName) return zoneName;
      }
    }

    return null;
  }

  function resolveTimezoneAbbreviation(abbreviation) {
    if (!abbreviation || !global.timezoneAbbreviations) return null;

    const lib = global.timezoneAbbreviations;
    const upper = abbreviation.toUpperCase();
    const lower = abbreviation.toLowerCase();
    const attempts = [];

    if (typeof lib === "function") {
      attempts.push(() => lib(upper));
      attempts.push(() => lib(lower));
    }

    for (const methodName of ["get", "resolve", "lookup", "find", "getZone", "resolveZone"]) {
      if (typeof lib[methodName] === "function") {
        attempts.push(() => lib[methodName](upper));
        attempts.push(() => lib[methodName](lower));
      }
    }

    attempts.push(
      () => lib[upper],
      () => lib[lower],
      () => lib.abbreviations?.[upper],
      () => lib.abbreviations?.[lower],
      () => lib.zones?.[upper],
      () => lib.zones?.[lower],
      () => lib.timezones?.[upper],
      () => lib.timezones?.[lower]
    );

    for (const attempt of attempts) {
      try {
        const zoneName = extractZoneFromCandidate(attempt());
        if (zoneName) return zoneName;
      } catch {
        // Ignore malformed provider responses and continue.
      }
    }

    return null;
  }

  function isTimeOnlyInput(input) {
    return /^\d{1,2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:\s*[ap]m)?$/i.test(input.trim());
  }

  function coerceAnyDateParserResult(result, zoneName, input, nowRef) {
    if (!result) return null;

    let dt = null;

    if (result instanceof Date) {
      dt = DateTime.fromJSDate(result, { zone: zoneName });
    } else if (typeof result === "number") {
      dt = DateTime.fromMillis(result, { zone: zoneName });
    } else if (typeof result === "string") {
      const parsedMillis = Date.parse(result);
      if (!Number.isNaN(parsedMillis)) {
        dt = DateTime.fromMillis(parsedMillis, { zone: zoneName });
      }
    } else if (typeof result === "object") {
      if (result.date instanceof Date) {
        dt = DateTime.fromJSDate(result.date, { zone: zoneName });
      } else if (typeof result.toDate === "function") {
        const asDate = result.toDate();
        if (asDate instanceof Date) dt = DateTime.fromJSDate(asDate, { zone: zoneName });
      } else if (typeof result.toJSDate === "function") {
        const asDate = result.toJSDate();
        if (asDate instanceof Date) dt = DateTime.fromJSDate(asDate, { zone: zoneName });
      } else if ([result.year, result.month, result.day].some(part => part != null)) {
        const monthValue = typeof result.month === "number" && result.month >= 0 && result.month <= 11
          ? result.month + 1
          : result.month;
        dt = DateTime.fromObject({
          year: result.year,
          month: monthValue,
          day: result.day,
          hour: result.hour || 0,
          minute: result.minute || 0,
          second: result.second || 0,
          millisecond: result.millisecond || result.ms || 0,
        }, { zone: zoneName });
      } else if ([result.hour, result.minute, result.second, result.millisecond, result.ms].some(part => part != null)) {
        const base = nowRef.setZone(zoneName).startOf("day");
        dt = base.set({
          hour: result.hour || 0,
          minute: result.minute || 0,
          second: result.second || 0,
          millisecond: result.millisecond || result.ms || 0,
        });
      }
    }

    if (!dt || !dt.isValid) return null;

    if (isTimeOnlyInput(input)) {
      const base = nowRef.setZone(zoneName).startOf("day");
      dt = base.set({
        hour: dt.hour,
        minute: dt.minute,
        second: dt.second,
        millisecond: dt.millisecond,
      });
    }

    return dt.isValid ? dt : null;
  }

  function parseWithAnyDateParser(input, zoneName, nowRef) {
    if (!global.anyDateParser) return null;

    const lib = global.anyDateParser;
    const attempts = [];

    if (typeof lib === "function") attempts.push(() => lib(input));

    for (const methodName of ["fromString", "parse", "parseDate", "attempt", "tryParse"]) {
      if (typeof lib[methodName] === "function") {
        attempts.push(() => lib[methodName](input));
      }
    }

    for (const attempt of attempts) {
      try {
        const dt = coerceAnyDateParserResult(attempt(), zoneName, input, nowRef);
        if (dt) return dt;
      } catch {
        // Continue trying other parser methods.
      }
    }

    return null;
  }

  function parseTimestamp(raw, sourceTz, options = {}) {
    const nowRef = options.now || DateTime.now();
    let str = stripSurroundingNoise(raw);
    if (!str) return { error: "empty" };

    let actualZone = getEffectiveSourceZone(sourceTz, options);

    // 1 & 2 — Epoch integers (10 or 13 digits, optional ms suffix)
    if (/^\d{10}$/.test(str)) {
      return { millis: parseInt(str, 10) * 1000 };
    }
    if (/^\d{13}$/.test(str)) {
      return { millis: parseInt(str, 10) };
    }

    // 2.25 — Relative shorthand (e.g. "-2h", "-30m", "now-1h")
    const relativeShorthandMatch = str.match(/^(?:now\s*)?-\s*(\d+)\s*(s|m|h|d)$/i);
    if (relativeShorthandMatch) {
      const [, amountStr, unitToken] = relativeShorthandMatch;
      const unitMap = { s: "seconds", m: "minutes", h: "hours", d: "days" };
      return {
        millis: nowRef.setZone(actualZone).minus({ [unitMap[unitToken.toLowerCase()]]: parseInt(amountStr, 10) }).toMillis(),
      };
    }

    // 2.5 — Trailing timezone abbreviation extraction (local to this call only)
    const trailingTzMatch = str.match(/^(.*?)(?:\s+|,\s*)([A-Za-z]{2,5})$/);
    if (trailingTzMatch) {
      const [, body, abbreviation] = trailingTzMatch;
      if (!/^(am|pm)$/i.test(abbreviation)) {
        const resolvedZone = resolveTimezoneAbbreviation(abbreviation);
        if (resolvedZone) {
          actualZone = resolvedZone;
          str = body.trim();
        }
      }
    }

    // 2.75 — 4-digit military time (e.g. "1545") — route directly to natural parser
    //        to avoid Luxon interpreting it as year 1545 via fromISO
    if (/^\d{4}$/.test(str)) {
      const nowEarly = nowRef.setZone(actualZone);
      const militaryDT = parseNaturalTimestamp(str, nowEarly, actualZone);
      if (militaryDT) return { millis: militaryDT.toMillis() };
      return { error: `Unable to parse date: "${str}"` };
    }

    // 2.9 — Log-native / loose formats via anyDateParser
    const anyDateParsed = parseWithAnyDateParser(str, actualZone, nowRef);
    if (anyDateParsed) return { millis: anyDateParsed.toMillis() };

    // 3 — ISO 8601 (with or without timezone info)
    const isoAttempt = DateTime.fromISO(str);
    if (isoAttempt.isValid) {
      if (str.match(/[Zz]|[+-]\d{2}:?\d{2}/)) {
        return { millis: isoAttempt.toMillis() };
      }
      const reanchored = DateTime.fromISO(str, { zone: actualZone });
      if (reanchored.isValid) return { millis: reanchored.toMillis() };
    }

    // 3.5 — chrono-node natural language (if available)
    if (global.chrono?.parseDate) {
      try {
        const chronoDate = global.chrono.parseDate(str, nowRef.setZone(actualZone).toJSDate());
        if (chronoDate instanceof Date && !Number.isNaN(chronoDate.getTime())) {
          return { millis: chronoDate.getTime() };
        }
      } catch {
        // Ignore chrono parse failures and continue.
      }
    }

    // 4 — Lightweight natural language parser
    const nowInSource = nowRef.setZone(actualZone);
    const natural = parseNaturalTimestamp(str, nowInSource, actualZone);
    if (natural) return { millis: natural.toMillis() };

    return { error: `Unable to parse date: "${str}"` };
  }

  function parseNaturalTimestamp(raw, nowInSource, zone) {
    const normalized = raw.trim().toLowerCase().replace(/\s+/g, " ");

    const relativeMatch = normalized.match(/^(today|yesterday|tomorrow)(?:\s+at)?(?:\s+(.+))?$/i);
    if (relativeMatch) {
      const [, keyword, timePart] = relativeMatch;
      const dayOffsets = { today: 0, yesterday: -1, tomorrow: 1 };
      const base = nowInSource.plus({ days: dayOffsets[keyword] }).startOf("day");
      return applyParsedTime(base, parseTimeOfDay(timePart), zone);
    }

    const lastWeekdayMatch = normalized.match(/^(last)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s+at)?(?:\s+(.+))?$/i);
    if (lastWeekdayMatch) {
      const [, , weekdayName, timePart] = lastWeekdayMatch;
      const targetWeekday = weekdayNameToNumber(weekdayName);
      const daysBack = ((nowInSource.weekday - targetWeekday + 7) % 7) || 7;
      const base = nowInSource.minus({ days: daysBack }).startOf("day");
      return applyParsedTime(base, parseTimeOfDay(timePart), zone);
    }

    const timeOnly = parseTimeOfDay(normalized);
    if (timeOnly) {
      return applyParsedTime(nowInSource.startOf("day"), timeOnly, zone);
    }

    const MONTHS = {
      january:1,february:2,march:3,april:4,may:5,june:6,
      july:7,august:8,september:9,october:10,november:11,december:12,
    };
    const monthDayMatch = normalized.match(
      /^(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s+at)?(?:\s+(.+))?$/i
    );
    if (monthDayMatch) {
      const [, monthName, dayStr, timePart] = monthDayMatch;
      const month = MONTHS[monthName.toLowerCase()];
      const day = parseInt(dayStr, 10);
      const year = nowInSource.year;
      const base = DateTime.fromObject({ year, month, day }, { zone });
      if (base.isValid) return applyParsedTime(base, parseTimeOfDay(timePart), zone);
    }

    return null;
  }

  function applyParsedTime(baseDate, parsedTime, zone) {
    const time = parsedTime || { hour: 0, minute: 0, second: 0 };
    const withTime = DateTime.fromObject(
      {
        year: baseDate.year,
        month: baseDate.month,
        day: baseDate.day,
        hour: time.hour,
        minute: time.minute,
        second: time.second,
      },
      { zone }
    );

    return withTime.isValid ? withTime : null;
  }

  function parseTimeOfDay(raw) {
    if (!raw) return null;

    const militaryMatch = raw.trim().match(/^(\d{2})(\d{2})$/);
    if (militaryMatch) {
      const hour = parseInt(militaryMatch[1], 10);
      const minute = parseInt(militaryMatch[2], 10);
      if (hour <= 23 && minute <= 59) return { hour, minute, second: 0 };
    }

    const match = raw.trim().toLowerCase().match(/^(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?\s*([ap]m)?$/i);
    if (!match) return null;

    let [, hours, minutes = "0", seconds = "0", meridiem] = match;
    let hour = parseInt(hours, 10);
    const minute = parseInt(minutes, 10);
    const second = parseInt(seconds, 10);

    if (minute > 59 || second > 59) return null;

    if (meridiem) {
      if (hour < 1 || hour > 12) return null;
      if (meridiem === "pm" && hour !== 12) hour += 12;
      if (meridiem === "am" && hour === 12) hour = 0;
    } else if (hour > 23) {
      return null;
    }

    return { hour, minute, second };
  }

  function weekdayNameToNumber(weekdayName) {
    return {
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6,
      sunday: 7,
    }[weekdayName.toLowerCase()] || null;
  }

  const api = {
    parseTimestamp,
    parseNaturalTimestamp,
    parseTimeOfDay,
    applyParsedTime,
    weekdayNameToNumber,
    getEffectiveSourceZone,
  };

  global.DevClockTimestampParser = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(globalThis);
