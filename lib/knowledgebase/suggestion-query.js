const clean = (value, max) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);

const buildSuggestionQuery = ({ subject, description } = {}) => {
  const parts = [clean(subject, 180), clean(description, 400)].filter((value) => value.length >= 3);
  const query = parts.join('\n').slice(0, 600);
  return query.replace(/\s+/g, ' ').trim().length >= 8 ? query : '';
};

module.exports = { buildSuggestionQuery };
