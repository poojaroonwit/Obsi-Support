const resend = require('./email/resend');
const { ensureCsatSurvey, markCsatInvitationSent } = require('./csat-repository');

const inviteCsat = async ({ organizationId, ticket, appBaseUrl, env = process.env }) => {
  const ensured = await ensureCsatSurvey({ organizationId, ticketId: ticket.id });
  if (!ensured) return { skipped: true, reason: 'not-eligible' };
  if (!ensured.token) return { skipped: true, reason: ensured.survey?.submittedAt ? 'already-submitted' : 'already-invited', survey: ensured.survey };
  if (!env.RESEND_API_KEY || !env.SUPPORT_EMAIL_FROM) return { skipped: true, reason: 'email-not-configured', survey: ensured.survey };
  const base = String(appBaseUrl || env.APP_PUBLIC_URL || '').replace(/\/$/, '');
  if (!base) return { skipped: true, reason: 'app-url-not-configured', survey: ensured.survey };
  const url = `${base}/satisfaction/${encodeURIComponent(ensured.token)}`;
  const result = await resend.sendEmail({
    apiKey: env.RESEND_API_KEY,
    from: env.SUPPORT_EMAIL_FROM,
    to: ticket.requesterEmail,
    replyTo: env.SUPPORT_EMAIL_REPLY_TO || undefined,
    subject: `How was your support experience? [${ticket.key}]`,
    text: `Your support request ${ticket.key} has been resolved. Please rate your experience from 1 to 5:\n\n${url}\n\nThank you for helping us improve.`,
    idempotencyKey: `csat/${ensured.survey.id}`,
  });
  const survey = await markCsatInvitationSent({ organizationId, surveyId: ensured.survey.id, providerEmailId: result.id || '' });
  return { sent: true, survey, url };
};

module.exports = { inviteCsat };
