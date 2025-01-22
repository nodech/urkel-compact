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

  const files = new Map();

  const stack = [
    new IterItem(root, 0, null)
  ];

  while (stack.length > 0) {
    const {node, ptr, depth} = stack.pop();

    if (ptr) {
      const usage = files.get(ptr.index) || 0;
      files.set(ptr.index, usage + ptr.size);
    }

    switch (node.type()) {
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

      case LEAF: {
        const usage = files.get(node.vptr.index) || 0;
        files.set(node.vptr.index, usage + node.vptr.size);
        break;
      }

      case HASH: {
        const resolved = await tree.resolve(node);
        stack.push(new IterItem(resolved, depth, node.ptr));
        break;
      }
    }
  }

  console.log(files);

  await tree.close();
})().catch((e) => {
    console.error(e);
    process.exit(1);
});


function formatPtr(ptr) {
  if (!ptr)
    return '';

  return `@file-${ptr.index}:${ptr.pos}(${ptr.size})`
}

class IterItem {
  constructor(node, depth, ptr) {
    this.node = node;
    this.ptr = ptr;
    this.depth = depth;
  }
}
