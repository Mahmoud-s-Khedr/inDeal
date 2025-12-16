#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { pool } = require('../src/config/db');

const schemaPath = path.resolve(__dirname, '../AI_DOCS/schema.sql');

async function run() {
    console.log('🛠️  Applying schema:', schemaPath);

    const schemaSQL = fs.readFileSync(schemaPath, 'utf-8');

    try {
        await pool.query(schemaSQL);
        console.log('✅ Schema applied successfully');
    } catch (error) {
        console.error('❌ Failed to apply schema');
        console.error(error);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
}

run();
