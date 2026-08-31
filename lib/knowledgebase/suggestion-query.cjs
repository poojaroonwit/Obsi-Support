'use strict';

function clean(value, max) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function buildSuggestionQuery({ subject, description } = {}) {
  return [clean(subject, 180), clean(description, 600)].filter(Boolean).join('\n');
}

function shouldSuggest(query) {
  return String(query || '').trim().length >= 8;
}

module.exports = { buildSuggestionQuery, shouldSuggest };
