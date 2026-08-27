const crypto = require('node:crypto');

const createCsatToken = () => crypto.randomBytes(32).toString('base64url');
const hashCsatToken = (token) => crypto.createHash('sha256').update(String(token || '')).digest('hex');
const normalizeCsatSubmission = (input = {}) => {
  const rating = Number(input.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new Error('CSAT rating must be an integer from 1 to 5');
  const comment = String(input.comment || '').trim().slice(0, 2000);
  return { rating, comment };
};
const isCsatEligibleStatus = (status) => ['resolved','closed'].includes(String(status || '').trim().toLowerCase());

module.exports = { createCsatToken, hashCsatToken, normalizeCsatSubmission, isCsatEligibleStatus };
