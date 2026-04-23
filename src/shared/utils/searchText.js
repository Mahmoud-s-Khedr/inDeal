const ARABIC_DIACRITICS_REGEX = /[\u064B-\u065F\u0670\u06D6-\u06ED]/g;
const WHITESPACE_REGEX = /\s+/g;
const ALEF_VARIANTS_REGEX = /[أإآٱ]/g;

const normalizeSearchText = (value) => {
  if (value === null || value === undefined) return '';

  return String(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(ARABIC_DIACRITICS_REGEX, '')
    .replace(/ـ/g, '')
    .replace(ALEF_VARIANTS_REGEX, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(WHITESPACE_REGEX, ' ')
    .trim();
};

module.exports = {
  normalizeSearchText,
};
