#!/usr/bin/env node

'use strict';

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

  const tree = new Tree({
    hash: BLAKE2b,
    bits: 256,
    prefix
  });

  await tree.open();

  const root = tree.root;

  const stack = [
    new IterItem(root, 0, null)
  ];

  while (stack.length > 0) {
    const {node, ptr, depth} = stack.pop();

    const prefix = '  '.repeat(depth);
    const log = (value) => {
      console.log(prefix + value + formatPtr(ptr));
    }

    switch (node.type()) {
      case NULL: {
        log('NULL');
        break;
      }

      case INTERNAL: {
        log('Internal: :' + node.prefix);
        const left = node.left;
        stack.push(new IterItem(left, depth + node.prefix.size + 1, null));
        const right = node.right;
        stack.push(new IterItem(right, depth + node.prefix.size + 1, null));
        break;
      }

      case LEAF: {
        const key = node.key;
        log(`Leaf: ${key.toString('hex')} -> value${formatPtr(node.vptr)}}`);
        break;
      }

      case HASH: {
        const resolved = await tree.resolve(node);
        stack.push(new IterItem(resolved, depth, node.ptr));
        break;
      }
    }
  }

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
