const { query } = require('./db');
const { normalizeBusinessHoursPolicy } = require('./business-hours');
const { DEFAULT_SLA_POLICY } = require('./sla');

const defaultSchedule = () => ({
  mon: [{ start: '09:00', end: '18:00' }],
  tue: [{ start: '09:00', end: '18:00' }],
  wed: [{ start: '09:00', end: '18:00' }],
  thu: [{ start: '09:00', end: '18:00' }],
  fri: [{ start: '09:00', end: '18:00' }],
  sat: [], sun: [],
});

const defaultBusinessHoursPolicy = (timezone = 'UTC') => normalizeBusinessHoursPolicy({
  enabled: true,
  timezone,
  schedule: defaultSchedule(),
  holidays: [],
  targets: DEFAULT_SLA_POLICY,
});

const mapPolicy = (row) => row ? normalizeBusinessHoursPolicy({
  enabled: row.enabled,
  timezone: row.timezone,
  schedule: row.schedule || {},
  holidays: row.holidays || [],
  targets: row.targets || DEFAULT_SLA_POLICY,
}) : null;

const getSlaPolicy = async (organizationId) => {
  try {
    const result = await query('SELECT * FROM support_sla_policies WHERE organization_id=$1 LIMIT 1', [organizationId]);
    return mapPolicy(result.rows[0]);
  } catch (error) {
    if (error?.code === '42P01') return null;
    throw error;
  }
};

const saveSlaPolicy = async ({ organizationId, policy }) => {
  const normalized = normalizeBusinessHoursPolicy(policy);
  const result = await query(`INSERT INTO support_sla_policies (organization_id,enabled,timezone,schedule,holidays,targets)
    VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,$6::jsonb)
    ON CONFLICT (organization_id) DO UPDATE SET enabled=EXCLUDED.enabled,timezone=EXCLUDED.timezone,schedule=EXCLUDED.schedule,
      holidays=EXCLUDED.holidays,targets=EXCLUDED.targets,updated_at=NOW()
    RETURNING *`, [organizationId, normalized.enabled, normalized.timezone, JSON.stringify(normalized.schedule), JSON.stringify(normalized.holidays), JSON.stringify(normalized.targets)]);
  return mapPolicy(result.rows[0]);
};

module.exports = { defaultBusinessHoursPolicy, defaultSchedule, getSlaPolicy, saveSlaPolicy };
