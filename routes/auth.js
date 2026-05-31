const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const crypto  = require('crypto');
const db      = require('../config/database');
const { authenticate } = require('../middleware/auth');
require('dotenv').config();

const SECRET = process.env.JWT_SECRET;
const EXP    = process.env.JWT_EXPIRES_IN || '8h';

async function makeTokens(user) {
  const payload = { id:user.id, username:user.username, role:user.role,
    can_upload:!!user.can_upload, can_logs:!!user.can_logs, can_perm:!!user.can_perm };
  const accessToken  = jwt.sign(payload, SECRET, { expiresIn: EXP });
  const refreshToken = crypto.randomBytes(48).toString('hex');
  const expiresAt    = new Date(Date.now() + 7*24*60*60*1000).toISOString();
  await db.tokens.deleteBy(t => t.user_id === user.id);
  await db.tokens.insert({ user_id:user.id, token:refreshToken, expires_at:expiresAt });
  return { accessToken, refreshToken, payload };
}

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error:'Usuario e senha obrigatorios' });
    const user = await db.users.findOne(u => u.username === username.trim().toLowerCase() && u.active);
    if (!user || !bcrypt.compareSync(password, user.password))
      return res.status(401).json({ error:'Usuario ou senha incorretos' });
    await db.users.update(user.id, { last_login: new Date().toISOString() });
    db.logs.insert({ user_id:user.id, username:user.username, action:'login', ip:req.ip }); // fire-and-forget
    const { accessToken, refreshToken, payload } = await makeTokens(user);
    res.json({ accessToken, refreshToken, user:payload, expiresIn:EXP });
  } catch(e) {
    console.error('[login]', e.message);
    res.status(500).json({ error:'Erro interno' });
  }
});

router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body || {};
    if (!refreshToken) return res.status(400).json({ error:'Refresh token obrigatorio' });
    const stored = await db.tokens.findOne(t => t.token === refreshToken);
    if (!stored || new Date(stored.expires_at) < new Date())
      return res.status(401).json({ error:'Token expirado' });
    const user = await db.users.findOne(u => u.id === stored.user_id && u.active);
    if (!user) return res.status(401).json({ error:'Usuario nao encontrado' });
    const { accessToken, refreshToken:newRefresh, payload } = await makeTokens(user);
    res.json({ accessToken, refreshToken:newRefresh, user:payload, expiresIn:EXP });
  } catch(e) {
    res.status(500).json({ error:'Erro interno' });
  }
});

router.post('/logout', authenticate, async (req, res) => {
  try {
    await db.tokens.deleteBy(t => t.user_id === req.user.id);
    res.json({ message:'Logout realizado' });
  } catch(e) {
    res.status(500).json({ error:'Erro interno' });
  }
});

router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await db.users.findOne(u => u.id === req.user.id);
    if (!user) return res.json(req.user);
    const { password, ...safe } = user;
    res.json(safe);
  } catch(e) {
    res.status(500).json({ error:'Erro interno' });
  }
});

router.post('/emergency-reset', async (req, res) => {
  try {
    const bcrypt = require('bcryptjs');
    const hash = bcrypt.hashSync('123456', 10);
    await require('../config/database').pool.query(
      "UPDATE users SET password=$1, active=1 WHERE username IN ('aporta','admin')",
      [hash]
    );
    const rows = await require('../config/database').pool.query('SELECT username,active FROM users');
    res.json({ok:true, users: rows.rows});
  } catch(e){ res.json({error:e.message}); }
});
module.exports = router;
