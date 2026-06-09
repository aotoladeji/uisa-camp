const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

const dbName = String(process.env.DB_NAME || process.env.DB_SCHEMA || 'uisa_camp').trim();
if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(dbName)) {
  throw new Error('Invalid DB_NAME or DB_SCHEMA. Use only letters, numbers, and underscores.');
}

const poolConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: `${process.env.DB_PASSWORD ?? ''}`,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  multipleStatements: true,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
};

const poolConnection = mysql.createPool({ ...poolConfig, database: dbName });
const bootstrapConnection = mysql.createPool({ ...poolConfig });

function normalizeDbError(err) {
  return err;
}

async function ensureDatabaseExists() {
  try {
    await poolConnection.query('SELECT 1');
  } catch (err) {
    if (err && err.code === 'ER_BAD_DB_ERROR') {
      await bootstrapConnection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
      return;
    }
    throw err;
  }
}

async function ensureSchema() {
  const schemaPath = path.join(__dirname, 'schema-mysql.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  await poolConnection.query(schema);
}

const dbReady = (async () => {
  try {
    await ensureDatabaseExists();
    await poolConnection.query('SELECT 1');
    await ensureSchema();
    console.log('✅ MySQL connected and schema ready');
  } catch (err) {
    console.error('❌ MySQL initialization failed:', err.message);
    process.exit(1);
  }
})();

async function runQuery(executor, sql, params = []) {
  await dbReady;
  const trimmed = sql.trim().toUpperCase();
  const isSelect = trimmed.startsWith('SELECT');

  try {
    const [rows] = await executor.query(sql, params);
    if (isSelect) return [rows];

    return [{ affectedRows: rows.affectedRows || 0, insertId: rows.insertId || 0 }];
  } catch (err) {
    throw normalizeDbError(err);
  }
}

const pool = {
  async query(sql, params = []) {
    return runQuery(poolConnection, sql, params);
  },

  async execute(sql, params = []) {
    return this.query(sql, params);
  },

  async getConnection() {
    await dbReady;
    const client = await poolConnection.getConnection();

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
  await poolConnection.end();
  await bootstrapConnection.end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await poolConnection.end();
  await bootstrapConnection.end();
  process.exit(0);
});

module.exports = pool;
