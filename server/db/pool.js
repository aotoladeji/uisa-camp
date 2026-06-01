const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const dbSchema = String(process.env.DB_SCHEMA || 'uisa_app').trim();
if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(dbSchema)) {
  throw new Error('Invalid DB_SCHEMA. Use only letters, numbers, and underscores.');
}

const pgPool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'postgres',
  password: `${process.env.DB_PASSWORD ?? ''}`,
  database: process.env.DB_NAME || 'uisa_camp',
  options: `-c search_path=${dbSchema},public`,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

function toPgPlaceholders(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

function normalizeDbError(err) {
  if (err && err.code === '23505') {
    err.code = 'ER_DUP_ENTRY';
  }
  return err;
}

async function ensureSchema() {
  const schemaPath = path.join(__dirname, 'schema-postgres.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  const bootstrap = `CREATE SCHEMA IF NOT EXISTS ${dbSchema};\nSET search_path TO ${dbSchema}, public;\n`;
  await pgPool.query(bootstrap + schema);
}

const dbReady = (async () => {
  try {
    await pgPool.query('SELECT 1');
    await ensureSchema();
    console.log('✅ PostgreSQL connected and schema ready');
  } catch (err) {
    console.error('❌ PostgreSQL initialization failed:', err.message);
    process.exit(1);
  }
})();

async function runQuery(executor, sql, params = []) {
  await dbReady;
  const text = toPgPlaceholders(sql);
  const trimmed = sql.trim().toUpperCase();
  const isSelect = trimmed.startsWith('SELECT');

  try {
    const result = await executor.query(text, params);
    if (isSelect) return [result.rows];

    let insertId = 0;
    if (trimmed.startsWith('INSERT')) {
      try {
        const idResult = await executor.query('SELECT LASTVAL() AS id');
        insertId = idResult.rows?.[0]?.id || 0;
      } catch {
        insertId = 0;
      }
    }

    return [{ affectedRows: result.rowCount || 0, insertId }];
  } catch (err) {
    throw normalizeDbError(err);
  }
}

const pool = {
  async query(sql, params = []) {
    return runQuery(pgPool, sql, params);
  },

  async execute(sql, params = []) {
    return this.query(sql, params);
  },

  async getConnection() {
    await dbReady;
    const client = await pgPool.connect();

    return {
      query: (sql, params = []) => runQuery(client, sql, params),
      execute: (sql, params = []) => runQuery(client, sql, params),
      beginTransaction: async () => client.query('BEGIN'),
      commit: async () => client.query('COMMIT'),
      rollback: async () => client.query('ROLLBACK'),
      release: () => client.release(),
    };
  },
};

process.on('SIGINT', async () => {
  await pgPool.end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await pgPool.end();
  process.exit(0);
});

module.exports = pool;
