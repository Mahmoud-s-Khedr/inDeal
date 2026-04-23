require('../helpers/infraTeardown');
const test = require('node:test');
const assert = require('node:assert/strict');

const { normalizeSearchText } = require('../../src/shared/utils/searchText');

test('normalizeSearchText removes Arabic diacritics and tatweel', () => {
  assert.equal(normalizeSearchText('تَجْرِبَــة'), 'تجربه');
});

test('normalizeSearchText normalizes Alef variants', () => {
  assert.equal(normalizeSearchText('إدارة أعمال آمنة'), 'اداره اعمال امنه');
});

test('normalizeSearchText normalizes ya/maqsura and teh marbuta', () => {
  assert.equal(normalizeSearchText('قضى على صناعة'), 'قضي علي صناعه');
});

test('normalizeSearchText handles mixed Arabic and English content', () => {
  assert.equal(normalizeSearchText('  Steel  قَهْوة  '), 'steel قهوه');
});
