"use strict";

(function bootstrapTimestampParser(global) {
  function tryRequire(moduleName) {
    if (typeof require !== "function") return null;

    try {
      return require(moduleName);
    } catch {
      return null;
    }
  }

  const LuxonRef = global.Luxon || global.luxon || tryRequire("luxon");
  const DateTime = LuxonRef?.DateTime;
  const FixedOffsetZone = LuxonRef?.FixedOffsetZone;
  const chronoModule = global.chrono || tryRequire("chrono-node");
  const anyDateParserModule = global.anyDateParser || tryRequire("any-date-parser");
  const timezoneAbbreviationModule = global.timezoneAbbreviations || tryRequire("timezone-abbreviations");

  if (!DateTime) {
    throw new Error("Luxon.DateTime is required for timestamp parsing.");
  }

  function normalizeAnyDateParser(moduleValue) {
    if (!moduleValue) return null;

    if (moduleValue.default && typeof moduleValue.fromString !== "function") {
      return moduleValue.default;
    }

    return moduleValue;
  }

  function normalizeTimezoneAbbreviationSource(moduleValue) {
    if (!moduleValue) return null;

    if (Array.isArray(moduleValue?.default)) return moduleValue.default;
    if (Array.isArray(moduleValue)) return moduleValue;
    return moduleValue;
  }

  const anyDateParserRef = normalizeAnyDateParser(anyDateParserModule);
  const timezoneAbbreviationSource = normalizeTimezoneAbbreviationSource(timezoneAbbreviationModule);

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

  function parseUtcOffsetString(offsetValue) {
    if (typeof offsetValue !== "string") return null;

    const match = offsetValue.trim().match(/^UTC([+-])(\d{2})(?::?(\d{2}))?$/i);
    if (!match) return null;

    const [, signToken, hoursToken, minutesToken = "00"] = match;
    const sign = signToken === "+" ? 1 : -1;
    return sign * (parseInt(hoursToken, 10) * 60 + parseInt(minutesToken, 10));
  }

  function offsetMinutesToZone(offsetMinutes) {
    if (!Number.isFinite(offsetMinutes)) return null;

    if (FixedOffsetZone?.instance) {
      return FixedOffsetZone.instance(offsetMinutes);
    }

    const sign = offsetMinutes >= 0 ? "+" : "-";
    const absoluteMinutes = Math.abs(offsetMinutes);
    const hours = String(Math.floor(absoluteMinutes / 60)).padStart(2, "0");
    const minutes = String(absoluteMinutes % 60).padStart(2, "0");
    return `UTC${sign}${hours}:${minutes}`;
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
    if (!abbreviation) return null;

    const builtinZones = {
      UTC: "UTC",
      GMT: "UTC",
      Z: "UTC",
    };
    const upper = abbreviation.toUpperCase();
    if (builtinZones[upper]) return builtinZones[upper];

    if (Array.isArray(timezoneAbbreviationSource)) {
      const matches = timezoneAbbreviationSource.filter(entry => entry?.abbr?.toUpperCase() === upper);

      for (const match of matches) {
        const zoneName = extractZoneFromCandidate([
          match.names,
          match.zone,
          match.timezone,
          match.name,
        ]);
        if (zoneName) return zoneName;
      }

      const uniqueOffsets = [...new Set(
        matches
          .map(match => parseUtcOffsetString(match.offset))
          .filter(offset => Number.isFinite(offset))
      )];

      if (uniqueOffsets.length === 1) {
        return offsetMinutesToZone(uniqueOffsets[0]);
      }

      return null;
    }

    if (!timezoneAbbreviationSource) return null;

    const lib = timezoneAbbreviationSource;
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

  function isDirectTimeInput(input) {
    const trimmed = input.trim();
    return /^\d{4}$/.test(trimmed) || /^\d{1,2}(?::\d{2})?(?::\d{2}(?:\.\d{1,9})?)?(?:\s*[ap]m)?$/i.test(trimmed);
  }

  function hasExplicitAbsoluteZone(input) {
    return /(?:[zZ]|[+-]\d{2}:?\d{2}|\b(?:utc|gmt)\b)/.test(input);
  }

  function parseTimeOnlyInput(input, zoneName, nowRef) {
    const parsedTime = parseTimeOfDay(input);
    if (!parsedTime) return null;

    const base = nowRef.setZone(zoneName).startOf("day");
    return applyParsedTime(base, parsedTime, zoneName);
  }

  function parseApacheLogTimestamp(input) {
    const match = input.match(/^(\d{1,2})\/([A-Za-z]{3})\/(\d{4}):(\d{2}):(\d{2}):(\d{2})\s+([+-]\d{4})$/);
    if (!match) return null;

    const [, dayToken, monthToken, yearToken, hourToken, minuteToken, secondToken, offsetToken] = match;
    const months = {
      jan: 1,
      feb: 2,
      mar: 3,
      apr: 4,
      may: 5,
      jun: 6,
      jul: 7,
      aug: 8,
      sep: 9,
      oct: 10,
      nov: 11,
      dec: 12,
    };

    const month = months[monthToken.toLowerCase()];
    if (!month) return null;

    const isoDate = `${yearToken}-${String(month).padStart(2, "0")}-${String(parseInt(dayToken, 10)).padStart(2, "0")}`;
    const dt = DateTime.fromFormat(`${isoDate} ${hourToken}:${minuteToken}:${secondToken} ${offsetToken}`, "yyyy-MM-dd HH:mm:ss ZZZ", {
      setZone: true,
    });

    return dt.isValid ? dt : null;
  }

  function coerceAnyDateParserResult(result, zoneName, input, nowRef) {
    if (!result) return null;

    if (result instanceof Date) {
      if (Number.isNaN(result.getTime())) return null;
      const dt = DateTime.fromJSDate(result);
      return dt.isValid ? dt : null;
    }

    if (typeof result === "number") {
      const dt = DateTime.fromMillis(result);
      return dt.isValid ? dt : null;
    }

    if (typeof result === "string") {
      const parsedMillis = Date.parse(result);
      if (!Number.isNaN(parsedMillis)) {
        const dt = DateTime.fromMillis(parsedMillis);
        return dt.isValid ? dt : null;
      }

      return null;
    }

    if (typeof result !== "object") return null;

    const reference = nowRef.setZone(zoneName);
    const hasDateParts = [result.year, result.month, result.day].some(part => part != null);
    const hasTimeParts = [result.hour, result.minute, result.second, result.millisecond, result.ms].some(part => part != null);

    if (!hasDateParts && !hasTimeParts) return null;

    const zoneForResult = result.offset != null ? offsetMinutesToZone(result.offset) || zoneName : zoneName;
    const dt = DateTime.fromObject({
      year: result.year ?? reference.year,
      month: result.month ?? reference.month,
      day: result.day ?? reference.day,
      hour: result.hour ?? 0,
      minute: result.minute ?? 0,
      second: result.second ?? 0,
      millisecond: result.millisecond ?? result.ms ?? 0,
    }, { zone: zoneForResult });

    if (!dt.isValid) return null;

    if (!hasDateParts && !hasExplicitAbsoluteZone(input) && result.offset == null) {
      return dt.setZone(zoneName, { keepLocalTime: true });
    }

    return dt;
  }

  function parseWithAnyDateParser(input, zoneName, nowRef) {
    if (!anyDateParserRef) return null;

    const attempts = [];

    if (typeof anyDateParserRef.attempt === "function") {
      attempts.push(() => anyDateParserRef.attempt(input));
    }

    for (const methodName of ["fromString", "parse", "parseDate", "fromAny", "tryParse"]) {
      if (typeof anyDateParserRef[methodName] === "function") {
        attempts.push(() => anyDateParserRef[methodName](input));
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

  function parseWithChrono(input, zoneName, nowRef) {
    if (typeof chronoModule?.parse !== "function") return null;

    try {
      const parsedResults = chronoModule.parse(input, nowRef.setZone(zoneName).toJSDate());
      const start = parsedResults?.[0]?.start;
      if (!start) return null;

      const values = { ...start.impliedValues, ...start.knownValues };
      if (!Object.keys(values).length) return null;

      const reference = nowRef.setZone(zoneName);
      const dt = DateTime.fromObject({
        year: values.year ?? reference.year,
        month: values.month ?? reference.month,
        day: values.day ?? reference.day,
        hour: values.hour ?? 0,
        minute: values.minute ?? 0,
        second: values.second ?? 0,
        millisecond: values.millisecond ?? 0,
      }, { zone: zoneName });

      return dt.isValid ? dt : null;
    } catch {
      return null;
    }
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
    const trailingTzMatch = str.match(/^(.*?)(?:\s+|,\s*)([A-Za-z]{1,5})$/);
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

    if (isDirectTimeInput(str)) {
      const timeOnly = parseTimeOnlyInput(str, actualZone, nowRef);
      if (timeOnly) return { millis: timeOnly.toMillis() };
    }

    // 3 — ISO 8601 (with or without timezone info)
    const isoAttempt = DateTime.fromISO(str);
    if (isoAttempt.isValid) {
      if (str.match(/[Zz]|[+-]\d{2}:?\d{2}/)) {
        return { millis: isoAttempt.toMillis() };
      }
      const reanchored = DateTime.fromISO(str, { zone: actualZone });
      if (reanchored.isValid) return { millis: reanchored.toMillis() };
    }

    const nowInSource = nowRef.setZone(actualZone);
    const natural = parseNaturalTimestamp(str, nowInSource, actualZone);
    if (natural) return { millis: natural.toMillis() };

    const apacheParsed = parseApacheLogTimestamp(str);
    if (apacheParsed) return { millis: apacheParsed.toMillis() };

    const anyDateParsed = parseWithAnyDateParser(str, actualZone, nowRef);
    if (anyDateParsed) return { millis: anyDateParsed.toMillis() };

    const chronoParsed = parseWithChrono(str, actualZone, nowRef);
    if (chronoParsed) return { millis: chronoParsed.toMillis() };

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
    const time = parsedTime || { hour: 0, minute: 0, second: 0, millisecond: 0 };
    const withTime = DateTime.fromObject(
      {
        year: baseDate.year,
        month: baseDate.month,
        day: baseDate.day,
        hour: time.hour,
        minute: time.minute,
        second: time.second,
        millisecond: time.millisecond || 0,
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

    const match = raw.trim().toLowerCase().match(/^(\d{1,2})(?::(\d{2}))?(?::(\d{2})(?:\.(\d{1,9}))?)?\s*([ap]m)?$/i);
    if (!match) return null;

    let [, hours, minutes = "0", seconds = "0", fractional = "0", meridiem] = match;
    let hour = parseInt(hours, 10);
    const minute = parseInt(minutes, 10);
    const second = parseInt(seconds, 10);
    const millisecond = parseInt((fractional || "0").slice(0, 3).padEnd(3, "0"), 10);

    if (minute > 59 || second > 59) return null;

    if (meridiem) {
      if (hour < 1 || hour > 12) return null;
      if (meridiem === "pm" && hour !== 12) hour += 12;
      if (meridiem === "am" && hour === 12) hour = 0;
    } else if (hour > 23) {
      return null;
    }

    return { hour, minute, second, millisecond };
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
