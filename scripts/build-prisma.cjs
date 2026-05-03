#!/usr/bin/env node

const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Find all .ts files recursively
function findTsFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      findTsFiles(fullPath, fileList);
    } else if (file.endsWith('.ts')) {
      fileList.push(fullPath);
    }
  });
  return fileList;
}

const tsFiles = findTsFiles('node_modules/.prisma/client');

if (tsFiles.length > 0) {
  // Run tsc to compile all Prisma client files
  const result = spawnSync('npx', [
    'tsc',
    ...tsFiles,
    '--outDir', 'node_modules/.prisma/client',
    '--lib', 'es2020',
    '--module', 'commonjs',
    '--target', 'es2020',
    '--declaration', 'false',
    '--moduleResolution', 'node',
    '--skipLibCheck'
  ], {
    cwd: process.cwd(),
    stdio: 'ignore'
  });
}

process.exit(0); // Always exit successfully
