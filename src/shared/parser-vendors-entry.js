import * as chrono from 'chrono-node';
import * as anyDateParserModule from 'any-date-parser';
import timezoneAbbreviationsModule from 'timezone-abbreviations';

const anyDateParser = anyDateParserModule.default && typeof anyDateParserModule.fromString !== 'function'
  ? anyDateParserModule.default
  : anyDateParserModule;

const timezoneAbbreviations = Array.isArray(timezoneAbbreviationsModule?.default)
  ? timezoneAbbreviationsModule.default
  : timezoneAbbreviationsModule;

globalThis.chrono = chrono;
globalThis.anyDateParser = anyDateParser;
globalThis.timezoneAbbreviations = timezoneAbbreviations;
