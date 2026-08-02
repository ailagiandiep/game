const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const appSource = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

const encodedPairs = [
  { civilian: 'q', spy: 'w', whitehat: null },
  { civilian: 'qwe', spy: 'rty', whitehat: 'e' }
];
const encodeConfig = {
  a: 'q',
  b: 'w',
  c: 'e',
  d: 'r',
  e: 't',
  f: 'y',
  g: 'u',
  h: 'i',
  i: 'o',
  j: 'p',
  k: 'a',
  l: 's',
  m: 'd',
  n: 'f',
  o: 'g',
  p: 'h',
  q: 'j',
  r: 'k',
  s: 'l',
  t: 'z',
  u: 'x',
  v: 'c',
  w: 'v',
  x: 'b',
  y: 'n',
  z: 'm',
  A: 'Q',
  B: 'W',
  C: 'E',
  D: 'R',
  E: 'T',
  F: 'Y',
  G: 'U',
  H: 'I',
  I: 'O',
  J: 'P',
  K: 'A',
  L: 'S',
  M: 'D',
  N: 'F',
  O: 'G',
  P: 'H',
  Q: 'J',
  R: 'K',
  S: 'L',
  T: 'Z',
  U: 'X',
  V: 'C',
  W: 'V',
  X: 'B',
  Y: 'N',
  Z: 'M',
  '0': '7',
  '1': '4',
  '2': '9',
  '3': '1',
  '4': '8',
  '5': '0',
  '6': '3',
  '7': '6',
  '8': '2',
  '9': '5'
};

(async () => {
  const context = {
    console,
    setTimeout,
    clearTimeout,
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    document: {
      getElementById: () => null,
      querySelectorAll: () => [],
      addEventListener: () => {}
    },
    fetch: async (url) => {
      if (url === 'data.json') {
        return { ok: true, json: async () => encodedPairs };
      }
      if (url === 'encode.json') {
        return { ok: true, json: async () => encodeConfig };
      }
      return { ok: false, json: async () => ({}) };
    }
  };

  vm.createContext(context);
  vm.runInContext(appSource, context);

  const pairs = await vm.runInContext('DataManager.loadPairs()', context);
  assert.strictEqual(pairs[0].civilian, 'a');
  assert.strictEqual(pairs[0].spy, 'b');
  assert.strictEqual(pairs[1].whitehat, 'c');
  console.log('data decoder test passed');
})();
