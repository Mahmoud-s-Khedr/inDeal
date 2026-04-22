#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const dotenv = require('dotenv');

const repoRoot = path.resolve(__dirname, '..');
const dockerEnvPath = path.resolve(repoRoot, '.env.docker');

if (fs.existsSync(dockerEnvPath)) {
  dotenv.config({ path: dockerEnvPath });
}

dotenv.config();

const ensureDatabaseUrl = () => {
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.trim()) {
    return;
  }

  const host = process.env.DB_HOST || 'localhost';
  const port = process.env.DB_PORT || '5432';
  const user = process.env.DB_USER || 'postgres';
  const password = process.env.DB_PASSWORD || 'postgres';
  const dbName = process.env.DB_NAME || 'indeal';
  const sslSuffix = process.env.DB_SSL === 'true' ? '?sslmode=require' : '';

  process.env.DATABASE_URL = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(
    password
  )}@${host}:${port}/${dbName}${sslSuffix}`;
};

ensureDatabaseUrl();

const args = process.argv.slice(2);
if (!args.length) {
  console.error('Usage: node scripts/prisma-cli.js <prisma args...>');
  process.exit(1);
}

const npxBin = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const result = spawnSync(npxBin, ['--no-install', 'prisma', ...args], {
  cwd: repoRoot,
  env: process.env,
  stdio: 'inherit',
});

if (typeof result.status === 'number') {
  process.exit(result.status);
}

process.exit(1);
