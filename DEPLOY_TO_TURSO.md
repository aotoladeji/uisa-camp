# Host the SQLite DB on Turso

This guide shows how to upload your local SQLite database to Turso and point the backend at the hosted DB.

Prerequisites
- A Turso account (https://turso.tech) and access to the Dashboard or CLI
- Node.js environment for your backend
- The local SQLite file: `server/db/uisa_camp.db`

Quick summary
- Make a safe copy of `server/db/uisa_camp.db` and optionally compress it.
- Import the `.db` file into Turso (Dashboard or CLI).
- Copy the Turso connection string and set it in your backend host environment (`DATABASE_URL`).
- Update `server` to use the remote database (detect `DATABASE_URL` and use a Turso/libSQL client).

1) Make a safe copy and compress (Windows PowerShell)

```powershell
# from repo root
Copy-Item -Path server\db\uisa_camp.db -Destination uisa_camp.db.copy
Compress-Archive -Path server\db\uisa_camp.db -DestinationPath uisa_camp.db.zip
```

Why: copying prevents accidental changes; compressing reduces upload time.

2) Import via Turso Dashboard (recommended for beginners)

- Sign in to the Turso Dashboard.
- Create a new database and open it.
- Look for an **Import / Restore / Upload** action in the DB UI.
- Upload `uisa_camp.db` or `uisa_camp.db.zip` and run the import.
- Wait until the Dashboard shows the import finished.

3) Import via Turso CLI (alternative)

- Install and login with the Turso CLI (see Turso docs for your OS).
- Example commands (CLI flags may change; run `turso --help` if needed):

```bash
turso login
turso db create my-uisa-db
turso db import my-uisa-db --file uisa_camp.db
```

4) Get the connection string

- After import, the Dashboard or CLI will provide a connection string (the format depends on Turso).
- Copy it and store it in your backend host environment as `DATABASE_URL` or `TURSO_DATABASE_URL`.

Example env variables to set on your backend host

```
DATABASE_URL=<the-connection-string-from-turso>
CLIENT_URL=https://your-vercel-app.vercel.app
JWT_SECRET=<your-jwt-secret>
```

5) Update the backend to use Turso (high level)

This repo currently opens a local SQLite file in `server/db/pool.js` (via `DB_PATH`). To use the hosted Turso DB, you need to detect `DATABASE_URL` and use a Turso/libSQL client when present.

Minimal example (conceptual) to add to `server/db/pool.js`:

```js
if (process.env.DATABASE_URL) {
  // Use the Turso / libSQL client
  // npm: @libsql/client
  const { createClient } = require('@libsql/client');
  const client = createClient({ url: process.env.DATABASE_URL, auth: { token: process.env.LIBSQL_TOKEN } });

  module.exports = {
    query: async (sql, params=[]) => {
      const res = await client.execute(sql, params);
      return [res.rows];
    },
    getConnection: async () => ({ execute: (sql, params=[]) => client.execute(sql, params) })
  };
} else {
  // existing SQLite file-based code (DB_PATH)
}
```

Notes:
- Install `@libsql/client` in the `server` folder if you use this option:

```bash
npm install --prefix server @libsql/client
```

- Turso may require a token or specific auth method; the Dashboard will show how to generate and use it (often set as `LIBSQL_TOKEN` or similar).

6) Test

- Restart your backend server with the `DATABASE_URL` (and any token env var) set.
- Call a few API endpoints (e.g., list applicants) to confirm data is present.

Troubleshooting / tips
- Stop the server before copying the `.db` file to avoid lock/read issues.
- If import fails due to size, try compressing the DB or exporting a subset.
- Keep your original `server/db/uisa_camp.db` as a backup.

If you want, I can:
- Patch `server/db/pool.js` to add detection and a libSQL client implementation and test it locally.
- Walk you through the Turso Dashboard import interactively.

References
- Turso: https://turso.tech
- libSQL client: https://www.npmjs.com/package/@libsql/client

---
