const assert = require('assert');
const { generatePlayerNames, findDuplicateNames, normalizePlayerNames } = require('../name-generator');

const sampleSets = [
  ['Tokyo', 'Hà Nội', 'Bangkok', 'Viêng Chăn', 'Singapore'],
  ['Hà Nội', 'Vinh', 'Huế', 'Nha Trang', 'Sài Gòn', 'Cao Bằng'],
  ['A', 'B', 'C', 'D', 'E'],
  ['1', '2', '3', '4', '5'],
];

const generated = generatePlayerNames(sampleSets, 5);
assert.ok(generated && generated.length === 5, 'Should generate exactly 5 unique names');
assert.equal(new Set(generated).size, 5, 'Generated names should be unique');

const singleSet = generatePlayerNames(sampleSets, 3);
assert.ok(singleSet.every(name => sampleSets.some(set => set.includes(name))), 'Generated names should come from one of the config sets');
assert.ok(singleSet.every(name => singleSet.filter(item => item === name).length === 1), 'Generated names should be unique within the result');
assert.deepStrictEqual(generatePlayerNames(sampleSets, 10), [], 'Should return an empty array when no single set is long enough');

const duplicateNames = findDuplicateNames(['A', 'B', 'A', 'C']);
assert.deepStrictEqual(duplicateNames, ['A']);

const normalized = normalizePlayerNames('  A\nB\n  C  \n');
assert.deepStrictEqual(normalized, ['A', 'B', 'C']);

const originalRandom = Math.random;
Math.random = () => 0;
try {
  const forcedShortSet = generatePlayerNames([['A', 'B'], ['C', 'D', 'E', 'F']], 3);
  assert.deepStrictEqual(forcedShortSet, [], 'Should stop when the randomly chosen set is too short');
} finally {
  Math.random = originalRandom;
}

console.log('name-generator tests passed');
