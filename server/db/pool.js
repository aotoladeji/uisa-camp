const fs   = require('fs');
const path = require('path');
require('dotenv').config();

const IS_VERCEL = process.env.VERCEL === '1';

// ── Turso / libSQL (production) ───────────────────────────────────────────────
if (process.env.DATABASE_URL) {
  const { createClient } = require('@libsql/client');

  // Normalise the URL: Vercel dashboard sometimes has trailing spaces or
  // people paste the https:// dashboard URL instead of libsql://
  let dbUrl = String(process.env.DATABASE_URL).trim();
  if (dbUrl.startsWith('https://')) {
    dbUrl = dbUrl.replace(/^https:\/\//, 'libsql://');
  }

  const client = createClient({
    url:       dbUrl,
    authToken: process.env.LIBSQL_TOKEN ? String(process.env.LIBSQL_TOKEN).trim() : undefined,
  });

  const libsqlPool = {
    async query(sql, params = []) {
      const res = await client.execute({ sql, args: params });
      const upper = sql.trim().toUpperCase();
      if (upper.startsWith('SELECT') || upper.startsWith('PRAGMA') || upper.startsWith('WITH')) {
        return [res.rows];
      }
      return [{ insertId: Number(res.lastInsertRowid ?? 0), affectedRows: res.rowsAffected ?? 0 }];
    },
    async execute(sql, params = []) {
      return this.query(sql, params);
    },
    async getConnection() {
      return {
        query:            (sql, params = []) => libsqlPool.query(sql, params),
        execute:          (sql, params = []) => libsqlPool.query(sql, params),
        beginTransaction: async () => client.execute({ sql: 'BEGIN',    args: [] }),
        commit:           async () => client.execute({ sql: 'COMMIT',   args: [] }),
        rollback:         async () => client.execute({ sql: 'ROLLBACK', args: [] }),
        release:          () => {},
      };
    },
  };

  console.log('✅ Using Turso/libSQL:', dbUrl.replace(/\/\/.*@/, '//[redacted]@'));
  module.exports = libsqlPool;

} else if (IS_VERCEL) {

  // Running on Vercel without DATABASE_URL — fail fast with a clear message
  // rather than a cryptic 500 from a missing sqlite3 binary.
  console.error('❌ DATABASE_URL is not set. Cannot start on Vercel without a remote database.');
  const missingDbPool = {
    async query()         { throw new Error('DATABASE_URL env var is not configured. Set it in your Vercel project settings.'); },
    async execute()       { throw new Error('DATABASE_URL env var is not configured. Set it in your Vercel project settings.'); },
    async getConnection() { throw new Error('DATABASE_URL env var is not configured. Set it in your Vercel project settings.'); },
  };
  module.exports = missingDbPool;

} else {

  // ── Local SQLite (development / self-hosted) ─────────────────────────────────
  const sqlite3 = require('sqlite3').verbose();
  const dbPath  = process.env.DB_PATH || path.join(__dirname, 'uisa_camp.db');

  class SQLitePool {
    constructor(filePath) {
      this.db = new sqlite3.Database(filePath, (err) => {
        if (err) {
          console.error('Error opening database:', err);
        } else {
          console.log('Connected to SQLite database:', filePath);
          this.db.run('PRAGMA foreign_keys = ON', (e) => {
            if (e) console.error('Error enabling foreign keys:', e);
          });
        }
      });
    }

    query(sql, params = []) {
      return new Promise((resolve, reject) => {
        if (sql.trim().toUpperCase().startsWith('SELECT')) {
          this.db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve([rows || []]);
          });
        } else {
          this.db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve([{ insertId: this.lastID, affectedRows: this.changes }]);
          });
        }
      });
    }

    end() {
      return new Promise((resolve, reject) => {
        this.db.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
  }

  const pool = new SQLitePool(dbPath);

  async function ensureSchema() {
    const schemaPath = path.join(__dirname, 'schema-sqlite.sql');
    const schema     = fs.readFileSync(schemaPath, 'utf8');
    const lines      = schema.split('\n');
    let currentStatement = '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('--')) continue;
      currentStatement += ' ' + line;
      if (trimmed.endsWith(';')) {
        const statement = currentStatement.trim();
        if (statement && !statement.startsWith('--')) {
          try {
            await pool.query(statement);
          } catch (err) {
            if (!err.message.includes('already exists')) {
              console.warn('Schema execution warning:', err.message);
            }
          }
        }
        currentStatement = '';
      }
    }
  }

  const dbReady = (async () => {
    try {
      await pool.query('SELECT 1');
      await ensureSchema();
      console.log('✅ SQLite connected and schema ready');
    } catch (err) {
      console.error('❌ SQLite initialization failed:', err.message);
      process.exit(1);
    }
  })();

  async function runQuery(executor, sql, params = []) {
    await dbReady;
    return executor.query(sql, params);
  }

  const poolWrapper = {
    async query(sql, params = [])   { return runQuery(pool, sql, params); },
    async execute(sql, params = []) { return this.query(sql, params); },
    async getConnection() {
      await dbReady;
      return {
        query:            (sql, params = []) => runQuery(pool, sql, params),
        execute:          (sql, params = []) => runQuery(pool, sql, params),
        beginTransaction: async () => pool.query('BEGIN'),
        commit:           async () => pool.query('COMMIT'),
        rollback:         async () => pool.query('ROLLBACK'),
        release:          () => {},
      };
    },
  };

  process.on('SIGINT',  async () => { await pool.end(); process.exit(0); });
  process.on('SIGTERM', async () => { await pool.end(); process.exit(0); });

  module.exports = poolWrapper;
}
