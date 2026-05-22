/**
 * Banco de dados PostgreSQL — persistente no Render
 */
const { Pool } = require('pg');
const bcrypt   = require('bcryptjs');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function q(sql, params = []) {
  const { rows } = await pool.query(sql, params);
  return rows;
}

// ── Criação das tabelas ────────────────────────────────────────────────────────
async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id          SERIAL PRIMARY KEY,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      username    VARCHAR(100) UNIQUE NOT NULL,
      password    VARCHAR(200) NOT NULL,
      role        VARCHAR(20)  DEFAULT 'viewer',
      can_upload  SMALLINT     DEFAULT 0,
      can_logs    SMALLINT     DEFAULT 1,
      can_perm    SMALLINT     DEFAULT 0,
      active      SMALLINT     DEFAULT 1,
      last_login  TIMESTAMPTZ
    );
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id          SERIAL PRIMARY KEY,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
      token       VARCHAR(200) NOT NULL,
      expires_at  TIMESTAMPTZ  NOT NULL
    );
    CREATE TABLE IF NOT EXISTS dashboard_data (
      id          INTEGER PRIMARY KEY DEFAULT 1,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      filename    VARCHAR(200),
      kpis        TEXT,
      curva_s     TEXT,
      areas       TEXT,
      avancos     TEXT,
      riscos      TEXT,
      uploaded_by VARCHAR(100),
      realizado   NUMERIC,
      planejado   NUMERIC,
      desvio      NUMERIC,
      semana      VARCHAR(20)
    );
    CREATE TABLE IF NOT EXISTS upload_history (
      id          SERIAL PRIMARY KEY,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      filename    VARCHAR(200),
      uploaded_by VARCHAR(100),
      realizado   NUMERIC,
      planejado   NUMERIC,
      desvio      NUMERIC,
      semana      VARCHAR(20),
      is_active   SMALLINT DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS access_logs (
      id          SERIAL PRIMARY KEY,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      user_id     INTEGER,
      username    VARCHAR(100),
      action      VARCHAR(100),
      ip          VARCHAR(50),
      user_agent  VARCHAR(200)
    );
  `);

  // Seed apenas se ainda não houver usuários
  const [{ count }] = await q('SELECT COUNT(*) AS count FROM users');
  if (parseInt(count) === 0) {
    const seed = [
      { username:'admin',              password:'admin',          role:'admin',  can_upload:1, can_logs:1, can_perm:1 },
      { username:'aporta',             password:'123456',         role:'admin',  can_upload:1, can_logs:1, can_perm:1 },
      { username:'fortbras',           password:'fortbras',       role:'viewer', can_upload:0, can_logs:1, can_perm:0 },
      { username:'lucimario.campos',   password:'lucimario123',   role:'viewer', can_upload:1, can_logs:1, can_perm:0 },
      { username:'rogerio.tambellini', password:'tambellini123',  role:'viewer', can_upload:0, can_logs:1, can_perm:0 },
      { username:'jorge.cavalcanti',   password:'jorge123',       role:'viewer', can_upload:0, can_logs:1, can_perm:0 },
    ];
    for (const u of seed) {
      await pool.query(
        `INSERT INTO users (username,password,role,can_upload,can_logs,can_perm,active)
         VALUES ($1,$2,$3,$4,$5,$6,1)`,
        [u.username, bcrypt.hashSync(u.password, 10), u.role, u.can_upload, u.can_logs, u.can_perm]
      );
    }
    console.log('✅ Usuários iniciais criados no PostgreSQL');
  }
  console.log('✅ PostgreSQL pronto');
}

// ── Interface do banco ────────────────────────────────────────────────────────
const db = {

  users: {
    findOne: async (fn) => {
      const rows = await q('SELECT * FROM users ORDER BY id');
      return rows.find(fn) || null;
    },
    findAll: async (fn) => {
      const rows = await q('SELECT * FROM users ORDER BY id');
      return fn ? rows.filter(fn) : rows;
    },
    insert: async (data) => {
      const { username, password, role='viewer', can_upload=0, can_logs=1, can_perm=0, active=1 } = data;
      const rows = await q(
        `INSERT INTO users (username,password,role,can_upload,can_logs,can_perm,active)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [username, password, role, can_upload?1:0, can_logs?1:0, can_perm?1:0, active?1:0]
      );
      return rows[0];
    },
    update: async (id, patch) => {
      const keys = Object.keys(patch);
      if (!keys.length) return false;
      const sets = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
      await pool.query(`UPDATE users SET ${sets} WHERE id = $1`, [id, ...keys.map(k => patch[k])]);
      return true;
    }
  },

  tokens: {
    findOne: async (fn) => {
      const rows = await q('SELECT * FROM refresh_tokens');
      return rows.find(fn) || null;
    },
    insert: async (data) => {
      const { user_id, token, expires_at } = data;
      await pool.query(
        `INSERT INTO refresh_tokens (user_id,token,expires_at) VALUES ($1,$2,$3)`,
        [user_id, token, expires_at]
      );
    },
    deleteBy: async (fn) => {
      const rows = await q('SELECT * FROM refresh_tokens');
      const ids  = rows.filter(fn).map(r => r.id);
      if (ids.length) await pool.query(`DELETE FROM refresh_tokens WHERE id = ANY($1)`, [ids]);
    }
  },

  dashboard: {
    getCurrent: async () => {
      const rows = await q('SELECT * FROM dashboard_data WHERE id = 1');
      return rows[0] || null;
    },
    replace: async (data) => {
      const { filename, kpis, curva_s, areas, avancos, riscos,
              uploaded_by, realizado, planejado, desvio, semana } = data;
      await pool.query(`
        INSERT INTO dashboard_data
          (id,filename,kpis,curva_s,areas,avancos,riscos,uploaded_by,realizado,planejado,desvio,semana,created_at)
        VALUES (1,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())
        ON CONFLICT (id) DO UPDATE SET
          filename=$1, kpis=$2, curva_s=$3, areas=$4, avancos=$5, riscos=$6,
          uploaded_by=$7, realizado=$8, planejado=$9, desvio=$10, semana=$11, created_at=NOW()
      `, [filename,
          JSON.stringify(kpis), JSON.stringify(curva_s), JSON.stringify(areas),
          JSON.stringify(avancos), JSON.stringify(riscos),
          uploaded_by, realizado, planejado, desvio, semana]);
    }
  },

  history: {
    findAll: async (limit = 20) => {
      return q('SELECT * FROM upload_history ORDER BY id DESC LIMIT $1', [limit]);
    },
    insert: async (data) => {
      await pool.query(`UPDATE upload_history SET is_active = 0`);
      const { filename, uploaded_by, realizado, planejado, desvio, semana } = data;
      await pool.query(
        `INSERT INTO upload_history (filename,uploaded_by,realizado,planejado,desvio,semana,is_active)
         VALUES ($1,$2,$3,$4,$5,$6,1)`,
        [filename, uploaded_by, realizado, planejado, desvio, semana]
      );
    }
  },

  logs: {
    insert: async (data) => {
      try {
        const { user_id, username, action, ip } = data;
        await pool.query(
          `INSERT INTO access_logs (user_id,username,action,ip) VALUES ($1,$2,$3,$4)`,
          [user_id || null, username, action, ip]
        );
        // Mantém só os últimos 500
        await pool.query(`
          DELETE FROM access_logs WHERE id NOT IN (
            SELECT id FROM access_logs ORDER BY id DESC LIMIT 500
          )
        `);
      } catch(e) {}
    },
    findAll: async (limit = 50) => {
      return q('SELECT * FROM access_logs ORDER BY id DESC LIMIT $1', [limit]);
    }
  },

  pool
};

init().catch(err => console.error('❌ Erro ao inicializar PostgreSQL:', err.message));

module.exports = db;
