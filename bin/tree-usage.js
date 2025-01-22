#!/usr/bin/env node

'use strict';

const fs = require('node:fs');
const {BLAKE2b} = require('bcrypto');
const {Tree, nodes} = require('urkel');

const types = nodes.types;

const {
  NULL,
  INTERNAL,
  LEAF,
  HASH
} = types;

(async () => {
  const prefix = process.argv[2] || './tree';

  if (!fs.existsSync(prefix))
    throw new Error(`Tree does not exist: ${prefix}`);

  const tree = new Tree({
    hash: BLAKE2b,
    bits: 256,
    prefix
  });

  await tree.open();

  const root = tree.root;

  const treeStats = new TreeStats();

  const stack = [
    new IterItem(root, 0, null)
  ];

  while (stack.length > 0) {
    const {node, ptr, depth} = stack.pop();

    treeStats.node(node, ptr, depth);

    switch (node.type()) {
      case LEAF:
      case NULL: {
        break;
      }

      case INTERNAL: {
        const left = node.left;
        stack.push(new IterItem(left, depth + node.prefix.size + 1, null));
        const right = node.right;
        stack.push(new IterItem(right, depth + node.prefix.size + 1, null));
        break;
      }

      case HASH: {
        const resolved = await tree.resolve(node);
        stack.push(new IterItem(resolved, depth, node.ptr));
        break;
      }
    }
  }

  treeStats.log();

  await tree.close();
})().catch((e) => {
    console.error(e);
    process.exit(1);
});

class IterItem {
  constructor(node, depth, ptr) {
    this.node = node;
    this.ptr = ptr;
    this.depth = depth;
  }
}

class TotalStats {
  constructor() {
    this.totalNodes = 0;
    this.totalSize = 0;

    this.counts = {
      internals: 0,
      leaves: 0,
      nulls: 0,
      data: 0
    };

    this.sizes = {
      internals: 0,
      leaves: 0,
      nulls: 0,
      data: 0
    };
  }

  addNull(node, ptr) {
    this.counts.nulls += 1;
    this.sizes.nulls += ptr.size;

    this.totalNodes++;
    this.totalSize += ptr.size;
  }

  addInternal(node, ptr) {
    this.counts.internals += 1;
    this.sizes.internals += ptr.size;

    this.totalNodes++;
    this.totalSize += ptr.size;
  }

  addLeaf(node, ptr) {
    this.counts.leaves += 1;
    this.sizes.leaves += ptr.size;

    this.totalNodes++;
    this.totalSize += ptr.size;
  }

  addData(vptr) {
    this.counts.data += 1;
    this.sizes.data += vptr.size;

    this.totalSize += vptr.size;
  }
}

class TreeStats {
  constructor() {
    this.resolves = 0;

    this.total = new TotalStats();
    this.perFile = new Map();
    this.perDepth = new Map();

    this.maxDepth = 0;
    this.maxFile = 0;
  }

  node(node, ptr, depth) {
    const perDepth = this.perDepth.get(depth) || new TotalStats();

    const totals = [this.total, perDepth ];

    let perFile;

    if (ptr) {
      perFile = this.perFile.get(ptr.index) || new TotalStats();
      totals.push(perFile);
    }

    switch (node.type()) {
      case NULL: {
        for (const total of totals)
          total.addNull(node, ptr);
        break;
      }

      case INTERNAL: {
        for (const total of totals)
          total.addInternal(node, ptr);
        break;
      }

      case LEAF: {
        for (const total of totals) {
          total.addLeaf(node, ptr);
          total.addData(node.vptr);
        }
        break;
      }

      case HASH: {
        this.resolves++;
        break;
      }
    }

    if (ptr) {
      this.perFile.set(ptr.index, perFile);

      if (this.maxFile < ptr.index)
        this.maxFile = ptr.index;
    }

    this.perDepth.set(depth, perDepth);

    if (depth > this.maxDepth)
      this.maxDepth = depth;
  }

  log() {
    console.log(`PerDepth (${this.maxDepth}):`);
    for (let i = 0; i <= this.maxDepth; i++) {
      const stat = this.perDepth.get(i) || new TotalStats();
      console.log(`Depth: ${i}`);
      console.log(stat);
    }

    console.log('PerFile:');
    for (let i = 1; i <= this.maxFile; i++) {
      const stat = this.perFile.get(i) || new TotalStats();
      console.log(`File: ${i}`);
      console.log(stat);
    }

    console.log('Total');
    console.log(this.total);

    console.log(`Resolves: ${this.resolves}, maxDepth: ${this.maxDepth}`);
  }
}
