const { query } = require('./db');
const { fillDailySeries, median, normalizeAnalyticsDays, safePercent } = require('./analytics-domain');

const number = (value) => Number(value) || 0;
const distribution = (rows) => rows.map((row) => ({ label: row.label || 'Unassigned', count: number(row.count) }));
const rangeFor = (days) => {
  const end = new Date();
  end.setUTCHours(0, 0, 0, 0);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10), startAt: start.toISOString() };
};

const getCsatRows = async (organizationId, startAt) => {
  try {
    const result = await query('SELECT rating FROM support_csat_surveys WHERE organization_id=$1 AND submitted_at >= $2 AND rating IS NOT NULL', [organizationId, startAt]);
    return result.rows;
  } catch (error) {
    if (error?.code === '42P01') return [];
    throw error;
  }
};

const getSupportAnalytics = async ({ organizationId, days: requestedDays = 30 }) => {
  const days = normalizeAnalyticsDays(requestedDays);
  const period = rangeFor(days);
  const params = [organizationId, period.startAt];
  const [created, resolved, backlog, responseRows, resolutionRows, createdDaily, resolvedDaily, byStatus, byChannel, byPriority, byTeam, byAgent, csatRows] = await Promise.all([
    query('SELECT COUNT(*)::int AS count FROM support_tickets WHERE organization_id=$1 AND created_at >= $2', params),
    query('SELECT COUNT(*)::int AS count FROM support_tickets WHERE organization_id=$1 AND resolved_at >= $2', params),
    query("SELECT COUNT(*)::int AS count FROM support_tickets WHERE organization_id=$1 AND status IN ('new','open','pending')", [organizationId]),
    query(`SELECT EXTRACT(EPOCH FROM (first_responded_at-created_at))/60.0 AS minutes,
      CASE WHEN first_response_due_at IS NOT NULL AND first_responded_at <= first_response_due_at THEN 1 ELSE 0 END AS met
      FROM support_tickets WHERE organization_id=$1 AND created_at >= $2 AND first_responded_at IS NOT NULL`, params),
    query(`SELECT EXTRACT(EPOCH FROM (resolved_at-created_at))/60.0 AS minutes,
      CASE WHEN resolution_due_at IS NOT NULL AND resolved_at <= resolution_due_at THEN 1 ELSE 0 END AS met
      FROM support_tickets WHERE organization_id=$1 AND resolved_at >= $2 AND resolved_at IS NOT NULL`, params),
    query(`SELECT TO_CHAR((created_at AT TIME ZONE 'UTC')::date,'YYYY-MM-DD') AS date,COUNT(*)::int AS count
      FROM support_tickets WHERE organization_id=$1 AND created_at >= $2 GROUP BY 1 ORDER BY 1`, params),
    query(`SELECT TO_CHAR((resolved_at AT TIME ZONE 'UTC')::date,'YYYY-MM-DD') AS date,COUNT(*)::int AS count
      FROM support_tickets WHERE organization_id=$1 AND resolved_at >= $2 GROUP BY 1 ORDER BY 1`, params),
    query('SELECT status AS label,COUNT(*)::int AS count FROM support_tickets WHERE organization_id=$1 AND created_at >= $2 GROUP BY status ORDER BY count DESC,status', params),
    query('SELECT channel AS label,COUNT(*)::int AS count FROM support_tickets WHERE organization_id=$1 AND created_at >= $2 GROUP BY channel ORDER BY count DESC,channel', params),
    query('SELECT priority AS label,COUNT(*)::int AS count FROM support_tickets WHERE organization_id=$1 AND created_at >= $2 GROUP BY priority ORDER BY count DESC,priority', params),
    query("SELECT COALESCE(NULLIF(team_name,''),'Unassigned') AS label,COUNT(*)::int AS count FROM support_tickets WHERE organization_id=$1 AND status IN ('new','open','pending') GROUP BY 1 ORDER BY count DESC,1", [organizationId]),
    query("SELECT COALESCE(NULLIF(assignee_name,''),'Unassigned') AS label,COUNT(*)::int AS count FROM support_tickets WHERE organization_id=$1 AND status IN ('new','open','pending') GROUP BY 1 ORDER BY count DESC,1", [organizationId]),
    getCsatRows(organizationId, period.startAt),
  ]);

  const createdMap = new Map(createdDaily.rows.map((row) => [row.date, number(row.count)]));
  const resolvedMap = new Map(resolvedDaily.rows.map((row) => [row.date, number(row.count)]));
  const dates = new Set([...createdMap.keys(), ...resolvedMap.keys()]);
  const dailyRows = [...dates].map((date) => ({ date, created: createdMap.get(date) || 0, resolved: resolvedMap.get(date) || 0 }));
  const responseMinutes = responseRows.rows.map((row) => number(row.minutes));
  const resolutionMinutes = resolutionRows.rows.map((row) => number(row.minutes));
  const csatRatings = csatRows.map((row) => number(row.rating)).filter((rating) => rating >= 1 && rating <= 5);
  const csatAverage = csatRatings.length ? Math.round((csatRatings.reduce((sum, rating) => sum + rating, 0) / csatRatings.length) * 100) / 100 : 0;

  return {
    days,
    period: { startDate: period.startDate, endDate: period.endDate },
    kpis: {
      created: number(created.rows[0]?.count),
      resolved: number(resolved.rows[0]?.count),
      backlog: number(backlog.rows[0]?.count),
      firstResponseSlaPercent: safePercent(responseRows.rows.filter((row) => number(row.met) === 1).length, responseRows.rows.length),
      resolutionSlaPercent: safePercent(resolutionRows.rows.filter((row) => number(row.met) === 1).length, resolutionRows.rows.length),
      medianFirstResponseMinutes: Math.round(median(responseMinutes) * 10) / 10,
      medianResolutionMinutes: Math.round(median(resolutionMinutes) * 10) / 10,
      csatAverage,
      csatResponses: csatRatings.length,
      csatSatisfiedPercent: safePercent(csatRatings.filter((rating) => rating >= 4).length, csatRatings.length),
    },
    daily: fillDailySeries(period.startDate, period.endDate, dailyRows),
    byStatus: distribution(byStatus.rows),
    byChannel: distribution(byChannel.rows),
    byPriority: distribution(byPriority.rows),
    byTeam: distribution(byTeam.rows),
    byAgent: distribution(byAgent.rows),
  };
};

module.exports = { getSupportAnalytics };
