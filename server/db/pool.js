const fs   = require('fs');
const path = require('path');
require('dotenv').config();

const IS_VERCEL = process.env.VERCEL === '1';

// ── Common Schema Management ──────────────────────────────────────────────────
async function ensureSchema(pool) {
  const schemaFile = process.env.DATABASE_URL ? 'schema-turso.sql' : 'schema-sqlite.sql';
  const schemaPath = path.join(__dirname, schemaFile);
  if (!fs.existsSync(schemaPath)) return;

  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  const lines = schemaSql.split('\n');
  let currentStatement = '';

  for (let line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('--')) {
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

  // Mandatory Alterations for existing databases
  const alterQueries = [
    "ALTER TABLE applicants ADD COLUMN is_medical_cleared INTEGER DEFAULT 0",
    "ALTER TABLE applicants ADD COLUMN is_admitted INTEGER DEFAULT 0",
    "ALTER TABLE applicants ADD COLUMN is_payment_verified INTEGER DEFAULT 0",
    "CREATE TABLE IF NOT EXISTS email_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, applicant_id INTEGER, type TEXT, sent_at TEXT, status TEXT, error TEXT)"
  ];
  for (const q of alterQueries) {
    try {
      await pool.query(q);
    } catch (e) {
      // Ignore "duplicate column" or "already exists" errors
    }
  }
}

// ── Turso / libSQL (production) ───────────────────────────────────────────────
if (process.env.DATABASE_URL) {
  const { createClient } = require('@libsql/client');
  let dbUrl = String(process.env.DATABASE_URL).trim();
  if (dbUrl.startsWith('https://')) dbUrl = dbUrl.replace(/^https:\/\//, 'libsql://');

  const client = createClient({
    url:       dbUrl,
    authToken: process.env.LIBSQL_TOKEN ? String(process.env.LIBSQL_TOKEN).trim() : undefined,
  });

  const libsqlPool = {
    async query(sql, params = []) {
      try {
        const res = await client.execute({ sql, args: params });
        const sqlText = sql.replace(/\/\*[\s\S]*?\*\/|--.*$/gm, '').trim();
        const upper = sqlText.toUpperCase();
        
        // If query returns rows (SELECT, PRAGMA check, etc.)
        if (Array.isArray(res.rows)) {
          // Normalize column names to lowercase to prevent issues with LibSQL/Turso case-sensitivity
          const normalizedRows = res.rows.map(row => {
            if (typeof row !== 'object' || row === null) return row;
            // Handle both object-style (if rowMode: 'object' used) and array-style rows
            const normalized = {};
            if (Array.isArray(row)) {
              // If rows are arrays (default), they usually don't have column names easily accessible
              // but ResultSet.columns has them!
              res.columns.forEach((col, idx) => {
                normalized[col.toLowerCase()] = row[idx];
              });
            } else {
              // If rows are objects
              for (const key of Object.keys(row)) {
                normalized[key.toLowerCase()] = row[key];
              }
            }
            return normalized;
          });

          // Some queries like SELECT might be false-positives if we check res.rowsAffected
          // But for SELECT, PRAGMA, WITH, we always want the rows array.
          if (upper.startsWith('SELECT') || upper.startsWith('PRAGMA') || upper.startsWith('WITH') || res.columns.length > 0) {
            return [normalizedRows];
          }
        }
        
        // DML (INSERT/UPDATE/DELETE) result
        return [{ 
          insertId: Number(res.lastInsertRowid ?? 0), 
          affectedRows: res.rowsAffected ?? 0 
        }];
      } catch (err) {
        console.error('LibSQL Query Error:', err.message, '| SQL:', sql.substring(0, 100));
        throw err;
      }
    },
    async execute(sql, params = []) { return this.query(sql, params); },
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

  const dbReady = (async () => {
    try {
      await ensureSchema(libsqlPool);
      console.log('✅ Turso connected and schema ready');
    } catch (err) {
      console.error('❌ Turso initialization failed:', err.message);
    }
  })();

  module.exports = {
    async query(sql, params = [])   { await dbReady; return libsqlPool.query(sql, params); },
    async execute(sql, params = []) { await dbReady; return libsqlPool.query(sql, params); },
    async getConnection()           { await dbReady; return libsqlPool.getConnection(); }
  };

} else if (IS_VERCEL) {
  console.error('❌ DATABASE_URL is not set. Cannot start on Vercel without a remote database.');
  const missingDbPool = {
    async query()         { throw new Error('DATABASE_URL env var is not configured.'); },
    async execute()       { throw new Error('DATABASE_URL env var is not configured.'); },
    async getConnection() { throw new Error('DATABASE_URL env var is not configured.'); },
  };
  module.exports = missingDbPool;

} else {
  // ── Local SQLite (development / self-hosted) ─────────────────────────────────
  const sqlite3 = require('sqlite3').verbose();
  const dbPath  = process.env.DB_PATH || path.join(__dirname, 'uisa_camp.db');

  class SQLitePool {
    constructor(filePath) {
      this.db = new sqlite3.Database(filePath, (err) => {
        if (!err) {
          console.log('Connected to SQLite database:', filePath);
          this.db.run('PRAGMA foreign_keys = ON');
        }
      });
    }
    query(sql, params = []) {
      return new Promise((resolve, reject) => {
        const sqlText = sql.replace(/\/\*[\s\S]*?\*\/|--.*$/gm, '').trim();
        const upper = sqlText.toUpperCase();
        if (upper.startsWith('SELECT') || upper.startsWith('PRAGMA') || upper.startsWith('WITH')) {
          this.db.all(sql, params, (err, rows) => {
            if (err) {
              reject(err);
            } else {
              // Normalize column names to lowercase
              const normalizedRows = (rows || []).map(row => {
                if (typeof row !== 'object' || row === null) return row;
                const normalized = {};
                for (const key of Object.keys(row)) {
                  normalized[key.toLowerCase()] = row[key];
                }
                return normalized;
              });
              resolve([normalizedRows]);
            }
          });
        } else {
          this.db.run(sql, params, function (err) {
            if (err) reject(err); else resolve([{ insertId: this.lastID, affectedRows: this.changes }]);
          });
        }
      });
    }
    end() { return new Promise(resolve => this.db.close(() => resolve())); }
  }

  const pool = new SQLitePool(dbPath);
  const dbLocalReady = (async () => {
    try {
      await ensureSchema(pool);
      console.log('✅ SQLite connected and schema ready');
    } catch (err) {
      console.error('❌ SQLite initialization failed:', err.message);
    }
  })();

  module.exports = {
    async query(sql, params = [])   { await dbLocalReady; return pool.query(sql, params); },
    async execute(sql, params = []) { await dbLocalReady; return pool.query(sql, params); },
    async getConnection() {
      await dbLocalReady;
      return {
        query:            (sql, params = []) => pool.query(sql, params),
        execute:          (sql, params = []) => pool.query(sql, params),
        beginTransaction: async () => pool.query('BEGIN'),
        commit:           async () => pool.query('COMMIT'),
        rollback:         async () => pool.query('ROLLBACK'),
        release:          () => {},
      };
    },
  };
}
