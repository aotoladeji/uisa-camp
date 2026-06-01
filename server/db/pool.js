const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

let db = null;
const DB_PATH = path.join(__dirname, 'uisa_camp.db');
const DB_LOCK_PATH = path.join(__dirname, 'uisa_camp.db.lock');
const IS_TEST_RUN = process.env.NODE_ENV === 'test' || process.argv.includes('--test');

function acquireDbLock() {
  if (IS_TEST_RUN) return;
  const pid = process.pid;
  if (fs.existsSync(DB_LOCK_PATH)) {
    try {
      const raw = fs.readFileSync(DB_LOCK_PATH, 'utf8').trim();
      const existingPid = parseInt(raw, 10);
      if (Number.isInteger(existingPid) && existingPid > 0) {
        try {
          process.kill(existingPid, 0);
          throw new Error(`Database lock is already held by PID ${existingPid}. Stop duplicate server instances and try again.`);
        } catch (err) {
          if (err.code !== 'ESRCH') throw err;
        }
      }
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
  }
  fs.writeFileSync(DB_LOCK_PATH, String(pid), 'utf8');
}

function releaseDbLock() {
  if (IS_TEST_RUN) return;
  try {
    if (fs.existsSync(DB_LOCK_PATH)) {
      const raw = fs.readFileSync(DB_LOCK_PATH, 'utf8').trim();
      if (String(process.pid) === raw) {
        fs.unlinkSync(DB_LOCK_PATH);
      }
    }
  } catch (err) {
    console.warn('Could not release DB lock:', err.message);
  }
}

function ensureRuntimeTables() {
  if (!db) return;
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_settings (
      setting_key TEXT PRIMARY KEY,
      setting_value TEXT NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
  [
    ['auto_accept_mode', 'balanced'],
    ['camp_fee_amount', String(parseFloat(process.env.CAMP_FEE) || 230000)],
    ['early_bird_enabled', '1'],
    ['early_bird_discount_pct', '10'],
    ['early_bird_fee_amount', ''],
    ['early_bird_deadline', process.env.EARLY_BIRD_DEADLINE || '2026-07-03'],
  ].forEach(([key, value]) => {
    db.run(
      `INSERT OR IGNORE INTO app_settings (setting_key, setting_value, updated_at)
       VALUES (?, ?, CURRENT_TIMESTAMP)`,
      [key, value]
    );
  });
  saveDatabase();
}

// Initialize SQLite database
(async () => {
  try {
    acquireDbLock();
    const SQL = await initSqlJs();
    
    // Load existing database or create new one
    if (fs.existsSync(DB_PATH)) {
      const buffer = fs.readFileSync(DB_PATH);
      db = new SQL.Database(buffer);
      ensureRuntimeTables();
      console.log('✅ SQLite database loaded:', DB_PATH);
    } else {
      db = new SQL.Database();
      console.log('✅ SQLite database created');
      
      // Initialize schema only for new database
      const schemaPath = path.join(__dirname, 'schema-sqlite.sql');
      if (fs.existsSync(schemaPath)) {
        const schema = fs.readFileSync(schemaPath, 'utf8');
        db.exec(schema);
        ensureRuntimeTables();
        saveDatabase();
        console.log('✅ Database schema initialized with tables');
      } else {
        console.error('❌ Schema file not found:', schemaPath);
      }
    }
  } catch (err) {
    console.error('❌ SQLite initialization failed:', err.message);
    process.exit(1);
  }
})();

// Save database to file
function saveDatabase() {
  if (db) {
    const data = db.export();
    fs.writeFileSync(DB_PATH, data);
  }
}

// MySQL-compatible wrapper for query execution
const pool = {
  async query(sql, params = []) {
    if (!db) throw new Error('Database not initialized');
    
    try {
      // Handle SELECT queries
      if (sql.trim().toUpperCase().startsWith('SELECT')) {
        const stmt = db.prepare(sql);
        stmt.bind(params);
        const rows = [];
        while (stmt.step()) {
          rows.push(stmt.getAsObject());
        }
        stmt.free();
        return [rows];
      }
      
      // Handle INSERT/UPDATE/DELETE
      db.run(sql, params);
      
      // Get last insert ID properly
      let insertId = 0;
      if (sql.trim().toUpperCase().startsWith('INSERT')) {
        try {
          const result = db.exec("SELECT last_insert_rowid() as id");
          console.log('Last insert ID query result:', JSON.stringify(result));
          if (result && result.length > 0 && result[0].values && result[0].values.length > 0) {
            insertId = result[0].values[0][0];
          }
        } catch (e) {
          console.error('Error getting insertId:', e);
        }
      }
      
      saveDatabase();
      
      return [{
        affectedRows: db.getRowsModified(),
        insertId: insertId
      }];
    } catch (err) {
      console.error('Query error:', err.message, '\nSQL:', sql);
      throw err;
    }
  },
  
  async execute(sql, params = []) {
    return this.query(sql, params);
  },
  
  async getConnection() {
    return {
      query: this.query.bind(this),
      execute: this.execute.bind(this),
      release: () => {},
      beginTransaction: async () => db.run('BEGIN TRANSACTION'),
      commit: async () => { db.run('COMMIT'); saveDatabase(); },
      rollback: async () => db.run('ROLLBACK')
    };
  }
};

// Save on exit
process.on('exit', () => { saveDatabase(); releaseDbLock(); });
process.on('SIGINT', () => { saveDatabase(); releaseDbLock(); process.exit(); });
process.on('SIGTERM', () => { saveDatabase(); releaseDbLock(); process.exit(); });

module.exports = pool;
