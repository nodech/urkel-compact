#!/usr/bin/env node

'use strict';

const {BLAKE2b, random} = require('bcrypto');
// patch urkel to use 2MB.
const {Tree} = require('urkel');
const rand = require('../lib/rand');

(async () => {
  const prefix = process.argv[2] || './tree';
  const parsed = parseArgs(process.argv.slice(2));

  const SEED = parsed.seed || random.randomInt();
  const ITEMS = parsed.items || 100;
  const ITERS = parsed.iters || 1000;
  const WRITES = parsed.writes || 100;

  const genRand = rand.randomStuffByte(SEED);
  const nextRandByte = rand.getNextRandByteFn(genRand);

  console.log(`Seed: ${SEED}`);
  console.log(`Total: ${ITEMS}`);
  console.log(`Iterations: ${ITERS}`);
  console.log(`Writes Per Iteration: ${WRITES}`);

  console.log(`Generating items ${ITEMS}...`);
  const keys = Array.from({length: ITEMS}, () => rand.randKey(nextRandByte));
  const getRandKey = () => keys[nextRandByte() % keys.length];

  const tree = new Tree({
    hash: BLAKE2b,
    bits: 256,
    prefix
  });

  await tree.open();

  for (let i = 0; i < ITERS; i++) {
    console.log(`Iteration ${i}...`);

    const txn = tree.transaction();

    for (let j = 0; j < WRITES; j++) {
      const key = getRandKey();
      const value = rand.randValue(nextRandByte);

      await txn.insert(key, value);
    }

    await txn.commit();
  }

  await tree.close();

})().catch((e) => {
  console.error(e);
  process.exit(1);
});

function parseArgs(args) {
  const parsed = {};
  
  for (const arg of args) {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      parsed[key] = value || true;
    }

    else if (arg.startsWith('-')) {
      const key = arg.slice(1);
      parsed[key] = true;
    }
  }
  
  return parsed;
}
