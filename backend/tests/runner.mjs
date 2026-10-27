import assert from 'node:assert';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure in-memory DB is used during tests
process.env.USE_IN_MEMORY_DB = 'true';
process.env.NODE_ENV = 'test';

let currentSuite = null;
const suites = [];

export function describe(name, fn) {
  const parent = currentSuite;
  const suite = {
    name: parent ? `${parent.name} > ${name}` : name,
    fn,
    tests: [],
    beforeEachHooks: parent ? [...parent.beforeEachHooks] : [],
    afterEachHooks: parent ? [...parent.afterEachHooks] : [],
  };
  suites.push(suite);
  currentSuite = suite;
  try {
    fn();
  } finally {
    currentSuite = parent;
  }
}

export function it(name, fn) {
  if (!currentSuite) {
    throw new Error(`Test "${name}" must be inside a describe block`);
  }
  currentSuite.tests.push({ name, fn });
}
export const test = it;

export function beforeEach(fn) {
  if (!currentSuite) throw new Error('beforeEach must be inside describe block');
  currentSuite.beforeEachHooks.push(fn);
}

export function afterEach(fn) {
  if (!currentSuite) throw new Error('afterEach must be inside describe block');
  currentSuite.afterEachHooks.push(fn);
}

export function beforeAll(fn) {}
export function afterAll(fn) {}

function createMatcher(actual, isNot = false) {
  const check = (condition, message) => {
    if (isNot ? condition : !condition) {
      throw new assert.AssertionError({
        message: message || `Assertion failed: expected ${actual} ${isNot ? 'not to' : 'to'} match condition`,
        actual,
      });
    }
  };

  const matcher = {
    get not() {
      return createMatcher(actual, !isNot);
    },
    get rejects() {
      return {
        async toThrow(expected) {
          let threw = false;
          let thrownError = null;
          try {
            await actual;
          } catch (err) {
            threw = true;
            thrownError = err;
          }
          if (expected instanceof RegExp) {
            check(threw && expected.test(thrownError?.message || ''), `Expected promise to reject with error matching ${expected}, got: ${thrownError?.message}`);
          } else if (typeof expected === 'string') {
            check(threw && (thrownError?.message || '').includes(expected), `Expected promise to reject with message "${expected}", got: ${thrownError?.message}`);
          } else {
            check(threw, `Expected promise to reject`);
          }
        },
      };
    },
    get resolves() {
      return {
        toBe(expected) {
          return actual.then((res) => check(Object.is(res, expected)));
        },
      };
    },
    toBe(expected) {
      check(Object.is(actual, expected), `Expected ${JSON.stringify(actual)} to be ${JSON.stringify(expected)}`);
    },
    toEqual(expected) {
      try {
        assert.deepStrictEqual(actual, expected);
        check(true);
      } catch (e) {
        check(false, `Expected ${JSON.stringify(actual)} to deeply equal ${JSON.stringify(expected)}`);
      }
    },
    toBeDefined() {
      check(actual !== undefined, `Expected value to be defined`);
    },
    toBeUndefined() {
      check(actual === undefined, `Expected value to be undefined`);
    },
    toBeNull() {
      check(actual === null, `Expected value to be null`);
    },
    toBeTruthy() {
      check(Boolean(actual), `Expected ${actual} to be truthy`);
    },
    toBeFalsy() {
      check(!actual, `Expected ${actual} to be falsy`);
    },
    toHaveProperty(prop) {
      const hasProp = actual !== null && actual !== undefined && Object.prototype.hasOwnProperty.call(actual, prop);
      check(hasProp, `Expected object to have property "${prop}"`);
    },
    toContain(item) {
      if (typeof actual === 'string' || Array.isArray(actual)) {
        check(actual.includes(item), `Expected ${JSON.stringify(actual)} to contain ${JSON.stringify(item)}`);
      } else {
        check(false, `toContain only works on strings and arrays`);
      }
    },
    toBeGreaterThan(n) {
      check(actual > n, `Expected ${actual} to be greater than ${n}`);
    },
    toBeGreaterThanOrEqual(n) {
      check(actual >= n, `Expected ${actual} to be greater than or equal to ${n}`);
    },
    toBeLessThan(n) {
      check(actual < n, `Expected ${actual} to be less than ${n}`);
    },
    toBeLessThanOrEqual(n) {
      check(actual <= n, `Expected ${actual} to be less than or equal to ${n}`);
    },
    toMatch(regex) {
      check(regex.test(String(actual)), `Expected "${actual}" to match ${regex}`);
    },
    toThrow(expected) {
      let threw = false;
      let thrownError = null;
      try {
        if (typeof actual === 'function') {
          actual();
        }
      } catch (err) {
        threw = true;
        thrownError = err;
      }
      if (expected instanceof RegExp) {
        check(threw && expected.test(thrownError?.message || ''), `Expected function to throw error matching ${expected}, got: ${thrownError?.message}`);
      } else if (typeof expected === 'string') {
        check(threw && (thrownError?.message || '').includes(expected), `Expected function to throw error with message "${expected}", got: ${thrownError?.message}`);
      } else {
        check(threw, `Expected function to throw an error`);
      }
    },
  };

  return matcher;
}

export function expect(actual) {
  return createMatcher(actual, false);
}

// Intercept vitest in node_modules if needed
globalThis.describe = describe;
globalThis.it = it;
globalThis.test = test;
globalThis.expect = expect;
globalThis.beforeEach = beforeEach;
globalThis.afterEach = afterEach;
globalThis.beforeAll = beforeAll;
globalThis.afterAll = afterAll;

export async function runAllTests(targetFile = null) {
  const testsDir = __dirname;
  const files = targetFile
    ? [path.isAbsolute(targetFile) ? targetFile : path.resolve(process.cwd(), targetFile)]
    : fs.readdirSync(testsDir)
        .filter((f) => f.endsWith('.test.js'))
        .map((f) => path.join(testsDir, f));

  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;
  const startTime = Date.now();

  console.log(`\n======================================================`);
  console.log(`ElectionDesk High-Fidelity Automated Test Runner`);
  console.log(`======================================================\n`);

  for (const file of files) {
    suites.length = 0;
    const relFile = path.relative(path.join(testsDir, '..'), file);
    console.log(`\x1b[36mRUNS\x1b[0m ${relFile}`);

    try {
      await import(`file://${file}?t=${Date.now()}`);
    } catch (err) {
      console.error(`\x1b[31mFAIL (Module Load Error)\x1b[0m ${relFile}`);
      console.error(err);
      failedTests++;
      continue;
    }

    for (const suite of suites) {
      console.log(`  \x1b[1m${suite.name}\x1b[0m`);
      for (const t of suite.tests) {
        totalTests++;
        try {
          for (const hook of suite.beforeEachHooks) {
            await hook();
          }
          await t.fn();
          for (const hook of suite.afterEachHooks) {
            await hook();
          }
          passedTests++;
          console.log(`    \x1b[32m✓\x1b[0m ${t.name}`);
        } catch (err) {
          failedTests++;
          console.log(`    \x1b[31m✗\x1b[0m ${t.name}`);
          console.error(`      \x1b[31m${err.message}\x1b[0m`);
          if (err.stack) {
            console.error(
              err.stack
                .split('\n')
                .slice(1, 4)
                .map((line) => `      ${line}`)
                .join('\n')
            );
          }
        }
      }
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n------------------------------------------------------`);
  console.log(`Test Results: ${passedTests} passed, ${failedTests} failed, ${totalTests} total (${duration}s)`);
  console.log(`======================================================\n`);

  if (failedTests > 0) {
    process.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const target = process.argv[2] || null;
  runAllTests(target).catch((err) => {
    console.error('Test execution fatal error:', err);
    process.exit(1);
  });
}
