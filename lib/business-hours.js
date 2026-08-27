const DAY_KEYS = ['sun','mon','tue','wed','thu','fri','sat'];
const DEFAULT_TARGETS = Object.freeze({
  urgent: { firstResponseMinutes: 15, resolutionMinutes: 240 },
  high: { firstResponseMinutes: 60, resolutionMinutes: 480 },
  normal: { firstResponseMinutes: 240, resolutionMinutes: 1440 },
  low: { firstResponseMinutes: 480, resolutionMinutes: 2880 },
});
const formatterCache = new Map();

const validateTimezone = (timezone) => {
  const value = String(timezone || '').trim();
  if (!value) throw new Error('SLA timezone is required');
  try { new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date()); }
  catch { throw new Error(`Invalid SLA timezone: ${value}`); }
  return value;
};
const parseTime = (value, allowEnd = false) => {
  const match = String(value || '').match(/^(\d{2}):(\d{2})$/);
  if (!match) throw new Error(`Invalid business-hours time: ${value}`);
  const hour = Number(match[1]); const minute = Number(match[2]);
  if (minute > 59 || hour > 23) {
    if (!(allowEnd && hour === 24 && minute === 0)) throw new Error(`Invalid business-hours time: ${value}`);
  }
  return hour * 60 + minute;
};
const normalizeWindows = (windows, day) => {
  if (windows == null) return [];
  if (!Array.isArray(windows)) throw new Error(`Business hours for ${day} must be an array`);
  const normalized = windows.map((window) => {
    const start = String(window?.start || '').trim(); const end = String(window?.end || '').trim();
    const startMinute = parseTime(start); const endMinute = parseTime(end, true);
    if (startMinute >= endMinute) throw new Error(`Business-hours window must end after it starts (${day})`);
    return { start, end, startMinute, endMinute };
  }).sort((a,b) => a.startMinute - b.startMinute);
  for (let index=1; index<normalized.length; index++) {
    if (normalized[index].startMinute < normalized[index-1].endMinute) throw new Error(`Business-hours windows overlap (${day})`);
  }
  return normalized;
};
const normalizeTargets = (targets = {}) => Object.fromEntries(Object.entries(DEFAULT_TARGETS).map(([priority, fallback]) => {
  const source = targets?.[priority] || fallback;
  const firstRaw = source.firstResponseMinutes;
  const resolutionRaw = source.resolutionMinutes;
  const firstResponseMinutes = firstRaw === undefined || firstRaw === null || firstRaw === '' ? fallback.firstResponseMinutes : Math.floor(Number(firstRaw));
  const resolutionMinutes = resolutionRaw === undefined || resolutionRaw === null || resolutionRaw === '' ? fallback.resolutionMinutes : Math.floor(Number(resolutionRaw));
  if (!Number.isFinite(firstResponseMinutes) || firstResponseMinutes < 1) throw new Error(`Invalid first response target for ${priority}`);
  if (!Number.isFinite(resolutionMinutes) || resolutionMinutes < 1) throw new Error(`Invalid resolution target for ${priority}`);
  if (resolutionMinutes < firstResponseMinutes) throw new Error(`Resolution target must be at least first response for ${priority}`);
  return [priority, { firstResponseMinutes, resolutionMinutes }];
}));
const normalizeHolidays = (values = []) => {
  if (!Array.isArray(values)) throw new Error('SLA holidays must be an array');
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean).map((value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`Invalid SLA holiday date: ${value}`);
    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0,10) !== value) throw new Error(`Invalid SLA holiday date: ${value}`);
    return value;
  }))].sort();
};
const normalizeBusinessHoursPolicy = (policy = {}) => {
  const enabled = policy.enabled !== false;
  const timezone = validateTimezone(policy.timezone || 'UTC');
  const schedule = {};
  for (const day of DAY_KEYS) schedule[day] = normalizeWindows(policy.schedule?.[day] || [], day);
  if (enabled && !DAY_KEYS.some((day) => schedule[day].length)) throw new Error('At least one business-hours window is required');
  return { enabled, timezone, schedule, holidays: normalizeHolidays(policy.holidays || []), targets: normalizeTargets(policy.targets || {}) };
};
const formatterFor = (timezone) => {
  if (!formatterCache.has(timezone)) formatterCache.set(timezone, new Intl.DateTimeFormat('en-US', {
    timeZone: timezone, weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }));
  return formatterCache.get(timezone);
};
const localParts = (date, timezone) => {
  const values = Object.fromEntries(formatterFor(timezone).formatToParts(new Date(date)).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  const dayKey = String(values.weekday || '').slice(0,3).toLowerCase();
  return { dayKey, date: `${values.year}-${values.month}-${values.day}`, minute: Number(values.hour) * 60 + Number(values.minute) };
};
const isBusinessMinute = (date, policy) => {
  if (!policy?.enabled) return true;
  const parts = localParts(date, policy.timezone);
  if (policy.holidays.includes(parts.date)) return false;
  return (policy.schedule[parts.dayKey] || []).some((window) => parts.minute >= window.startMinute && parts.minute < window.endMinute);
};
const addBusinessMinutes = (start, minutes, policy) => {
  const amount = Math.max(0, Math.floor(Number(minutes) || 0));
  const startDate = new Date(start);
  if (!policy?.enabled) return new Date(startDate.getTime() + amount * 60_000);
  let remaining = amount; let cursor = new Date(startDate);
  const maxSteps = 366 * 24 * 60 * 2; let steps = 0;
  while (remaining > 0) {
    if (isBusinessMinute(cursor, policy)) remaining -= 1;
    cursor = new Date(cursor.getTime() + 60_000);
    steps += 1;
    if (steps > maxSteps) throw new Error('SLA target exceeds supported business-hours horizon');
  }
  return cursor;
};
module.exports = { DAY_KEYS, DEFAULT_TARGETS, addBusinessMinutes, isBusinessMinute, localParts, normalizeBusinessHoursPolicy, normalizeHolidays, normalizeTargets };
