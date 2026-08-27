const SUPPORTED_DAYS = new Set([7, 30, 90]);

const normalizeAnalyticsDays = (value) => {
  const days = Number(value);
  return SUPPORTED_DAYS.has(days) ? days : 30;
};

const safePercent = (numerator, denominator) => {
  const n = Number(numerator) || 0;
  const d = Number(denominator) || 0;
  if (d <= 0) return 0;
  return Math.round((n / d) * 1000) / 10;
};

const median = (values = []) => {
  const sorted = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

const fillDailySeries = (startDate, endDate, rows = []) => {
  const byDate = new Map(rows.map((row) => [String(row.date).slice(0, 10), {
    created: Number(row.created || 0), resolved: Number(row.resolved || 0),
  }]));
  const result = [];
  let cursor = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  while (cursor <= end) {
    const date = cursor.toISOString().slice(0, 10);
    const value = byDate.get(date) || { created: 0, resolved: 0 };
    result.push({ date, ...value });
    cursor = new Date(cursor.getTime() + 86_400_000);
  }
  return result;
};

module.exports = { fillDailySeries, median, normalizeAnalyticsDays, safePercent };
