/**
 * Banco de dados baseado em arquivos JSON
 * Zero compilação — funciona em qualquer Windows
 */
const fs     = require('fs');
const path   = require('path');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const DATA_DIR = path.dirname(process.env.DB_PATH || './data/fortbras.db');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const FILES = {
  users:          path.join(DATA_DIR, 'users.json'),
  tokens:         path.join(DATA_DIR, 'tokens.json'),
  dashboard_data: path.join(DATA_DIR, 'dashboard_data.json'),
  upload_history: path.join(DATA_DIR, 'upload_history.json'),
  access_logs:    path.join(DATA_DIR, 'access_logs.json'),
};

// Lê um arquivo JSON (retorna array vazio se não existir)
function read(file) {
  try {
    if (!fs.existsSync(file)) return [];
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch(e) { return []; }
}

// Escreve um array JSON no disco
function write(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

// Auto-incremento
function nextId(arr) {
  return arr.length ? Math.max(...arr.map(r => r.id || 0)) + 1 : 1;
}

// Timestamp ISO
const now = () => new Date().toISOString().replace('T',' ').slice(0,19);

// ── API do banco ──────────────────────────────────────────────────────────────
const db = {

  // USERS
  users: {
    findOne: (fn)    => read(FILES.users).find(fn),
    findAll: (fn)    => fn ? read(FILES.users).filter(fn) : read(FILES.users),
    insert:  (data)  => {
      const rows = read(FILES.users);
      const row  = { id: nextId(rows), created_at: now(), ...data };
      rows.push(row);
      write(FILES.users, rows);
      return row;
    },
    update: (id, patch) => {
      const rows = read(FILES.users);
      const idx  = rows.findIndex(r => r.id == id);
      if (idx < 0) return false;
      rows[idx] = { ...rows[idx], ...patch };
      write(FILES.users, rows);
      return true;
    }
  },

  // REFRESH TOKENS
  tokens: {
    findOne: (fn)    => read(FILES.tokens).find(fn),
    insert:  (data)  => { const rows = read(FILES.tokens); rows.push({ id: nextId(rows), created_at: now(), ...data }); write(FILES.tokens, rows); },
    deleteBy: (fn)   => write(FILES.tokens, read(FILES.tokens).filter(r => !fn(r))),
  },

  // DASHBOARD DATA
  dashboard: {
    getCurrent: () => { const rows = read(FILES.dashboard_data); return rows[rows.length-1] || null; },
    replace: (data)  => { write(FILES.dashboard_data, [{ id: 1, created_at: now(), ...data }]); },
  },

  // UPLOAD HISTORY
  history: {
    findAll: (limit=20) => read(FILES.upload_history).reverse().slice(0, limit),
    insert:  (data) => {
      const rows = read(FILES.upload_history);
      // Desativa ativo anterior
      rows.forEach(r => r.is_active = 0);
      rows.push({ id: nextId(rows), created_at: now(), is_active: 1, ...data });
      write(FILES.upload_history, rows);
    }
  },

  // ACCESS LOGS
  logs: {
    insert: (data) => {
      try {
        const rows = read(FILES.access_logs);
        rows.push({ id: nextId(rows), created_at: now(), ...data });
        // Mantém só os últimos 500 logs
        if (rows.length > 500) rows.splice(0, rows.length - 500);
        write(FILES.access_logs, rows);
      } catch(e) {}
    },
    findAll: (limit=50) => read(FILES.access_logs).reverse().slice(0, limit)
  }
};

// ── Seed usuários iniciais ────────────────────────────────────────────────────
function seed() {
  if (read(FILES.users).length > 0) return;
  const users = [
    { username:'admin',              password:'admin',          role:'admin',  can_upload:1, can_logs:1, can_perm:1, active:1 },
    { username:'aporta',             password:'123456',         role:'admin',  can_upload:1, can_logs:1, can_perm:1, active:1 },
    { username:'fortbras',           password:'fortbras',       role:'viewer', can_upload:0, can_logs:1, can_perm:0, active:1 },
    { username:'lucimario.campos',   password:'lucimario123',   role:'viewer', can_upload:1, can_logs:1, can_perm:0, active:1 },
    { username:'rogerio.tambellini', password:'tambellini123',  role:'viewer', can_upload:0, can_logs:1, can_perm:0, active:1 },
    { username:'jorge.cavalcanti',   password:'jorge123',       role:'viewer', can_upload:0, can_logs:1, can_perm:0, active:1 },
  ];
  for (const u of users) {
    db.users.insert({ ...u, password: bcrypt.hashSync(u.password, 10) });
  }
  console.log('✅ Usuários iniciais criados em', DATA_DIR);
}

seed();
console.log('✅ Banco de dados (JSON) pronto em', DATA_DIR);

module.exports = db;
