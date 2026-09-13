/**
 * Extremely small "test" stage placeholder.
 * Real projects would use mocha/jest/etc. Kept dependency-free on purpose so
 * the Jenkins "test" stage has something meaningful to run without needing
 * extra devDependencies installed in the training exercise.
 */
const assert = require('assert');

function sum(a, b) {
  return a + b;
}

assert.strictEqual(sum(2, 2), 4, 'sanity check failed');
console.log('All tests passed.');
