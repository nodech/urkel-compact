'use strict';

const assert = require('node:assert');
const BLAKE2b = require('bcrypto/lib/blake2b');

exports.randomStuff = function *randomStuff(seed) {
  let next = seed;
  let result;

  for (;;) {
    next = exports.mul32(next, 1103515245);
    next = (next + 12345) | 0;
    result = ((next / 65536) % 2048) | 0;

    next = exports.mul32(next, 1103515245);
    next = (next + 12345) | 0;
    result <<= 10;
    result ^= ((next / 65536) % 1024);

    next = exports.mul32(next, 1103515245);
    next = (next + 12345) | 0;
    result <<= 10;
    result ^= ((next / 65536) % 1024);

    yield result;
  }
}

exports.randomStuffByte = function *randomStuffByte(seed) {
  const rand = exports.randomStuff(seed);

  for (;;) {
    yield rand.next().value & 0xff;
  }
}

exports.getNextRandByteFn = function randGen(randGen) {
  return function getNextRandByteFn() {
    const {value, done} = randGen.next();
    assert(!done);
    return value;
  };
};

exports.mul32 = function mul32(a, b) {
  const loa = a & 0xffff;
  const hia = a >>> 16;
  const lob = b & 0xffff;
  const hib = b >>> 16;

  let lor = 0;
  let hir = 0;

  lor += loa * lob;
  hir += lor >>> 16;
  lor &= 0xffff;
  hir += loa * hib;
  hir &= 0xffff;
  hir += hia * lob;
  hir &= 0xffff;

  return (hir << 16) | lor;
}

exports.mul32rp = function mul32rp(a, b) {
  let res = 0;
  while (b) {
    if (b & 0x01)
      res = (res + a) | 0;

    b >>= 1;
    a <<= 1;
  }

  return res;
}

exports.randBytes = function randBytes(nextRandByte, n) {
  const buf = Buffer.alloc(n, 0x00);

  for (let i = 0; i < n; i++)
    buf[i] = nextRandByte();

  return buf;
}

exports.randKey = function randKey(nextRandByte) {
  const keySize = nextRandByte();
  const key = exports.randBytes(nextRandByte, keySize);
  const hash = BLAKE2b.digest(key);

  return hash;
}

exports.randValue = function randValue(nextRandByte) {
  const size = nextRandByte();
  return exports.randBytes(nextRandByte, size);
}
