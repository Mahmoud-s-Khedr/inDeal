const { PrismaClient } = require('@prisma/client');
const config = require('./env');

const ensureDatabaseUrl = () => {
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.trim()) {
    return;
  }

  const user = encodeURIComponent(config.db.user);
  const password = encodeURIComponent(config.db.password);
  const host = config.db.host;
  const port = config.db.port;
  const dbName = config.db.name;
  const sslSuffix = process.env.DB_SSL === 'true' ? '?sslmode=require' : '';

  process.env.DATABASE_URL = `postgresql://${user}:${password}@${host}:${port}/${dbName}${sslSuffix}`;
};

ensureDatabaseUrl();

// Reuse the Prisma client in development to avoid exhausting DB connections.
const globalForPrisma = global;

const prisma =
  globalForPrisma.__prisma__ ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__prisma__ = prisma;
}

module.exports = prisma;
