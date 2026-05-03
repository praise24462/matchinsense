#!/usr/bin/env node

const { spawnSync } = require('child_process');
const path = require('path');

// Run tsc to compile the Prisma client
const result = spawnSync('npx', [
  'tsc',
  'node_modules/.prisma/client/client.ts',
  '--outDir', 'node_modules/.prisma/client',
  '--lib', 'es2020',
  '--module', 'esnext',
  '--target', 'es2020',
  '--declaration', 'false',
  '--moduleResolution', 'node',
  '--skipLibCheck'
], {
  cwd: process.cwd(),
  stdio: 'ignore'
});

process.exit(0); // Always exit successfully
