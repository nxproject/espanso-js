/*
 * This file is part of espanso-js, a JavaScript port of espanso.
 *
 * Copyright (C) 2019-2021 Federico Terzi (original Rust implementation)
 * Licensed under the GNU General Public License v3.0 or later.
 *
 * Port of espanso-render/src/extension/date.rs
 *
 * The Rust version uses chrono's `format_localized`. This file re-implements the
 * chrono strftime syntax on top of `Date` + `Intl` (for localized names and
 * IANA time zones), so `format: "%A, %d %B %Y"` behaves the same in the browser.
 */

export class DateFormatError extends Error {
  constructor(format) {
    super(`invalid date format: \`${format}\``);
    this.name = 'DateFormatError';
  }
}

const DEFAULT_LOCALE = 'en-US';

/** Returns the browser/OS locale, falling back to en-US. */
export function getSystemLocale() {
  if (typeof navigator !== 'undefined' && navigator.language) return navigator.language;
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale || DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

/** Accept "it-IT", "it_IT" or "it"; return a canonical tag, or null if unsupported. */
export function normalizeLocale(locale) {
  if (typeof locale !== 'string' || locale.trim() === '') return null;
  const tag = locale.trim().replace(/_/g, '-').replace(/\..*$/, '');
  try {
    const supported = Intl.DateTimeFormat.supportedLocalesOf([tag]);
    return supported.length > 0 ? supported[0] : null;
  } catch {
    return null;
  }
}

export function isValidTimeZone(tz) {
  if (typeof tz !== 'string' || tz === '') return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Break a Date down into wall-clock components, either in the local time zone
 * (timeZone == null) or in the given IANA time zone.
 */
export function getDateParts(date, timeZone = null) {
  if (!timeZone) {
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
      hour: date.getHours(),
      minute: date.getMinutes(),
      second: date.getSeconds(),
      millisecond: date.getMilliseconds(),
      weekday: date.getDay(),
      offsetMinutes: -date.getTimezoneOffset(),
      timeZone: null,
    };
  }

  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    weekday: 'short',
    era: 'short',
  });
  const parts = {};
  for (const p of fmt.formatToParts(date)) parts[p.type] = p.value;
  let year = Number(parts.year);
  if (parts.era === 'BC' || parts.era === 'B') year = 1 - year;
  const result = {
    year,
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    second: Number(parts.second),
    millisecond: date.getUTCMilliseconds(),
    weekday: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday),
    timeZone,
  };
  const asUtc = Date.UTC(result.year, result.month - 1, result.day, result.hour, result.minute, result.second, result.millisecond);
  result.offsetMinutes = Math.round((asUtc - date.getTime()) / 60000);
  return result;
}

// --- Localized names ---------------------------------------------------------

const nameCache = new Map();

function localizedNames(locale) {
  if (nameCache.has(locale)) return nameCache.get(locale);

  const utc = (y, m, d, h = 12) => new Date(Date.UTC(y, m, d, h));
  const part = (options, date, type) => {
    const parts = new Intl.DateTimeFormat(locale, { timeZone: 'UTC', ...options }).formatToParts(date);
    return parts.find((p) => p.type === type)?.value ?? '';
  };

  // Month names are taken in "format" context (e.g. Russian genitive "января"),
  // which is what glibc/chrono use for %B in a date.
  const monthsLong = [];
  const monthsShort = [];
  for (let m = 0; m < 12; m += 1) {
    const date = utc(2021, m, 15);
    monthsLong.push(part({ day: 'numeric', month: 'long' }, date, 'month'));
    monthsShort.push(part({ day: 'numeric', month: 'short' }, date, 'month'));
  }

  const weekdaysLong = [];
  const weekdaysShort = [];
  for (let d = 0; d < 7; d += 1) {
    const date = utc(2021, 0, 3 + d); // 2021-01-03 is a Sunday
    weekdaysLong.push(part({ weekday: 'long' }, date, 'weekday'));
    weekdaysShort.push(part({ weekday: 'short' }, date, 'weekday'));
  }

  let am = part({ hour: 'numeric', hour12: true }, utc(2021, 0, 1, 9), 'dayPeriod');
  let pm = part({ hour: 'numeric', hour12: true }, utc(2021, 0, 1, 21), 'dayPeriod');
  if (locale.startsWith('en')) {
    am = 'AM';
    pm = 'PM';
  }

  const names = { monthsLong, monthsShort, weekdaysLong, weekdaysShort, am, pm };
  nameCache.set(locale, names);
  return names;
}

// --- Calendar helpers --------------------------------------------------------

function dayOfYear(p) {
  return Math.round((Date.UTC(p.year, p.month - 1, p.day) - Date.UTC(p.year, 0, 1)) / 86400000) + 1;
}

function isoWeek(p) {
  const date = new Date(Date.UTC(p.year, p.month - 1, p.day));
  const weekday = (p.weekday + 6) % 7; // Monday = 0
  date.setUTCDate(date.getUTCDate() - weekday + 3); // Thursday of this week
  const isoYear = date.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
  firstThursday.setUTCDate(firstThursday.getUTCDate() - ((firstThursday.getUTCDay() + 6) % 7) + 3);
  const week = 1 + Math.round((date - firstThursday) / (7 * 86400000));
  return { isoYear, week };
}

function weekOfYear(p, firstDay) {
  // firstDay: 0 = Sunday (%U), 1 = Monday (%W)
  const yday = dayOfYear(p) - 1;
  const wday = (p.weekday - firstDay + 7) % 7;
  return Math.floor((yday + 7 - wday) / 7);
}

function pad(value, width, padChar) {
  const negative = value < 0;
  let s = String(Math.abs(value));
  while (s.length < width) s = padChar + s;
  return negative ? `-${s}` : s;
}

function formatOffset(minutes, withColon, withSeconds = false, hoursOnly = false) {
  const sign = minutes < 0 ? '-' : '+';
  const abs = Math.abs(minutes);
  const hh = pad(Math.floor(abs / 60), 2, '0');
  const mm = pad(abs % 60, 2, '0');
  if (hoursOnly) return `${sign}${hh}`;
  if (withSeconds) return `${sign}${hh}:${mm}:00`;
  return withColon ? `${sign}${hh}:${mm}` : `${sign}${hh}${mm}`;
}

function timeZoneName(p, date) {
  if (!p.timeZone) return formatOffset(p.offsetMinutes, true);
  if (p.timeZone === 'UTC' || p.timeZone === 'Etc/UTC') return 'UTC';
  // en-US knows the American abbreviations (EST, PDT...), en-GB the European ones (CET, BST...)
  for (const locale of ['en-US', 'en-GB']) {
    const parts = new Intl.DateTimeFormat(locale, { timeZone: p.timeZone, timeZoneName: 'short' }).formatToParts(date);
    const name = parts.find((x) => x.type === 'timeZoneName')?.value;
    if (name && !/^(GMT|UTC)[+-]/.test(name)) return name;
  }
  return formatOffset(p.offsetMinutes, true);
}

// --- strftime ----------------------------------------------------------------

/**
 * Format `date` using chrono's strftime syntax.
 * @param {Date} date
 * @param {string} format
 * @param {{locale?: string, timeZone?: string|null}} [options]
 */
export function strftime(date, format, options = {}) {
  const locale = normalizeLocale(options.locale) ?? DEFAULT_LOCALE;
  const p = getDateParts(date, options.timeZone ?? null);
  const names = localizedNames(locale);
  const isEnUs = locale === 'en-US' || locale === 'en';

  const hour12 = p.hour % 12 === 0 ? 12 : p.hour % 12;
  const fraction = (digits) => pad(p.millisecond, 3, '0').padEnd(digits, '0').slice(0, digits);

  let out = '';
  let i = 0;
  const chars = Array.from(format);

  const numeric = (value, width, defaultPad, padMode) => {
    if (padMode === '-') return String(value);
    const padChar = padMode === '_' ? ' ' : padMode === '0' ? '0' : defaultPad;
    return pad(value, width, padChar);
  };

  const localizedDate = () =>
    isEnUs
      ? `${pad(p.month, 2, '0')}/${pad(p.day, 2, '0')}/${pad(((p.year % 100) + 100) % 100, 2, '0')}`
      : new Intl.DateTimeFormat(locale, { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' })
        .format(new Date(Date.UTC(p.year, p.month - 1, p.day, 12)));

  const localizedTime = () =>
    isEnUs
      ? `${pad(hour12, 2, '0')}:${pad(p.minute, 2, '0')}:${pad(p.second, 2, '0')} ${names.pm && p.hour >= 12 ? names.pm : names.am}`
      : new Intl.DateTimeFormat(locale, { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', second: '2-digit' })
        .format(new Date(Date.UTC(2000, 0, 1, p.hour, p.minute, p.second)));

  const ampm = () => (p.hour >= 12 ? names.pm : names.am);

  const spec = (c, padMode) => {
    switch (c) {
      // Date
      case 'Y': return p.year >= 0 && p.year <= 9999 ? numeric(p.year, 4, '0', padMode) : (p.year > 9999 ? `+${p.year}` : String(p.year));
      case 'C': return numeric(Math.floor(p.year / 100), 2, '0', padMode);
      case 'y': return numeric(((p.year % 100) + 100) % 100, 2, '0', padMode);
      case 'q': return String(Math.floor((p.month - 1) / 3) + 1);
      case 'm': return numeric(p.month, 2, '0', padMode);
      case 'b':
      case 'h': return names.monthsShort[p.month - 1];
      case 'B': return names.monthsLong[p.month - 1];
      case 'd': return numeric(p.day, 2, '0', padMode);
      case 'e': return numeric(p.day, 2, ' ', padMode);
      case 'a': return names.weekdaysShort[p.weekday];
      case 'A': return names.weekdaysLong[p.weekday];
      case 'w': return String(p.weekday);
      case 'u': return String(p.weekday === 0 ? 7 : p.weekday);
      case 'U': return numeric(weekOfYear(p, 0), 2, '0', padMode);
      case 'W': return numeric(weekOfYear(p, 1), 2, '0', padMode);
      case 'G': return numeric(isoWeek(p).isoYear, 4, '0', padMode);
      case 'g': return numeric(((isoWeek(p).isoYear % 100) + 100) % 100, 2, '0', padMode);
      case 'V': return numeric(isoWeek(p).week, 2, '0', padMode);
      case 'j': return numeric(dayOfYear(p), 3, '0', padMode);
      case 'D': return `${spec('m')}/${spec('d')}/${spec('y')}`;
      case 'x': return localizedDate();
      case 'F': return `${spec('Y')}-${spec('m')}-${spec('d')}`;
      case 'v': return `${spec('e')}-${spec('b')}-${spec('Y')}`;
      // Time
      case 'H': return numeric(p.hour, 2, '0', padMode);
      case 'k': return numeric(p.hour, 2, ' ', padMode);
      case 'I': return numeric(hour12, 2, '0', padMode);
      case 'l': return numeric(hour12, 2, ' ', padMode);
      case 'P': return ampm().toLowerCase();
      case 'p': return ampm();
      case 'M': return numeric(p.minute, 2, '0', padMode);
      case 'S': return numeric(p.second, 2, '0', padMode);
      case 'f': return fraction(9);
      case 'R': return `${spec('H')}:${spec('M')}`;
      case 'T': return `${spec('H')}:${spec('M')}:${spec('S')}`;
      case 'X': return localizedTime();
      case 'r': return `${spec('I')}:${spec('M')}:${spec('S')} ${spec('p')}`;
      // Time zone
      case 'Z': return timeZoneName(p, date);
      case 'z': return formatOffset(p.offsetMinutes, false);
      // Date & time
      case 'c':
        return isEnUs
          ? `${spec('a')} ${spec('d')} ${spec('b')} ${spec('Y')} ${spec('r')} ${spec('Z')}`
          : `${localizedDate()} ${localizedTime()}`;
      case '+': {
        const frac = p.millisecond ? `.${fraction(3)}` : '';
        return `${spec('F')}T${spec('T')}${frac}${formatOffset(p.offsetMinutes, true)}`;
      }
      case 's': return String(Math.floor(date.getTime() / 1000));
      // Special
      case 't': return '\t';
      case 'n': return '\n';
      case '%': return '%';
      default: return null;
    }
  };

  while (i < chars.length) {
    const c = chars[i];
    if (c !== '%') {
      out += c;
      i += 1;
      continue;
    }

    let j = i + 1;
    let padMode = null;
    if (['-', '_', '0'].includes(chars[j])) {
      padMode = chars[j];
      j += 1;
    }

    const rest = chars.slice(j, j + 5).join('');
    let m;
    if ((m = /^\.([369])f/.exec(rest))) {
      out += `.${fraction(Number(m[1]))}`;
      i = j + m[0].length;
      continue;
    }
    if (rest.startsWith('.f')) {
      out += p.millisecond ? `.${fraction(3)}` : '';
      i = j + 2;
      continue;
    }
    if ((m = /^([369])f/.exec(rest))) {
      out += fraction(Number(m[1]));
      i = j + 2;
      continue;
    }
    if (rest.startsWith(':::z')) {
      out += formatOffset(p.offsetMinutes, true, false, true);
      i = j + 4;
      continue;
    }
    if (rest.startsWith('::z')) {
      out += formatOffset(p.offsetMinutes, true, true);
      i = j + 3;
      continue;
    }
    if (rest.startsWith(':z')) {
      out += formatOffset(p.offsetMinutes, true);
      i = j + 2;
      continue;
    }

    const specifier = chars[j];
    const value = specifier === undefined ? null : spec(specifier, padMode);
    if (value === null) throw new DateFormatError(format);
    out += value;
    i = j + 1;
  }

  return out;
}

/** RFC 2822 date, e.g. "Tue, 8 Jul 2014 09:10:11 +0200" (chrono's to_rfc2822). */
export function toRfc2822(date, timeZone = null) {
  return strftime(date, '%a, %-d %b %Y %H:%M:%S %z', { locale: 'en-US', timeZone });
}

/**
 * `date` extension.
 * Params: `format` (chrono strftime), `offset` (seconds, number or numeric string),
 * `locale` (BCP 47, e.g. "it-IT"), `tz` (IANA time zone, e.g. "America/New_York").
 *
 * @param {{now?: () => Date, getLocale?: () => string}} [options]
 */
export function createDateExtension(options = {}) {
  const now = options.now ?? (() => new Date());
  const getLocale = options.getLocale ?? getSystemLocale;

  return {
    name: 'date',
    calculate(_context, _scope, params) {
      let date = new Date(now().getTime());

      const offset = params.offset;
      let offsetSeconds = null;
      if (typeof offset === 'number' && Number.isInteger(offset)) offsetSeconds = offset;
      else if (typeof offset === 'string' && /^[+-]?\d+$/.test(offset.trim())) offsetSeconds = Number(offset.trim());
      if (offsetSeconds !== null) date = new Date(date.getTime() + offsetSeconds * 1000);

      const tz = typeof params.tz === 'string' && isValidTimeZone(params.tz) ? params.tz : null;
      const locale = typeof params.locale === 'string' ? params.locale : getLocale();

      if (typeof params.format === 'string') {
        return strftime(date, params.format, { locale, timeZone: tz });
      }
      return toRfc2822(date, tz);
    },
  };
}
