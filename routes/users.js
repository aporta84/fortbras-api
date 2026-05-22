const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const db      = require('../config/database');
const { authenticate, adminOnly } = require('../middleware/auth');

router.get('/', authenticate, adminOnly, async (req, res) => {
  try {
    const all   = req.query.all === '1';
    const users = (await db.users.findAll(u => all || u.active)).map(({password,...u}) => u);
    res.json(users);
  } catch(e) { res.status(500).json({ error:'Erro interno' }); }
});

router.get('/admin/logs', authenticate, adminOnly, async (req, res) => {
  try {
    res.json(await db.logs.findAll(Math.min(parseInt(req.query.limit)||50, 200)));
  } catch(e) { res.status(500).json({ error:'Erro interno' }); }
});

router.post('/', authenticate, adminOnly, async (req, res) => {
  try {
    const { username, password, role='viewer', can_upload=0, can_logs=1, can_perm=0 } = req.body||{};
    if (!username?.trim()||!password?.trim()) return res.status(400).json({ error:'Usuario e senha obrigatorios' });
    if (password.length < 6) return res.status(400).json({ error:'Senha deve ter pelo menos 6 caracteres' });
    if (!['admin','viewer'].includes(role)) return res.status(400).json({ error:'Role invalido' });
    if (await db.users.findOne(u => u.username === username.toLowerCase().trim()))
      return res.status(409).json({ error:'Usuario ja existe' });
    const user = await db.users.insert({ username:username.toLowerCase().trim(),
      password:bcrypt.hashSync(password,10), role, can_upload:can_upload?1:0,
      can_logs:can_logs?1:0, can_perm:can_perm?1:0, active:1 });
    const { password:_, ...safe } = user;
    res.status(201).json({ ...safe, message:'Usuario criado' });
  } catch(e) { res.status(500).json({ error:'Erro interno' }); }
});

router.put('/:id', authenticate, adminOnly, async (req, res) => {
  try {
    const id   = parseInt(req.params.id);
    const user = await db.users.findOne(u => u.id === id);
    if (!user) return res.status(404).json({ error:'Usuario nao encontrado' });
    const { password, role, can_upload, can_logs, can_perm, active } = req.body||{};
    if (password && password.length < 6) return res.status(400).json({ error:'Senha deve ter pelo menos 6 caracteres' });
    const patch = {};
    if (password)                            patch.password   = bcrypt.hashSync(password,10);
    if (role && ['admin','viewer'].includes(role)) patch.role = role;
    if (can_upload !== undefined)            patch.can_upload = can_upload?1:0;
    if (can_logs   !== undefined)            patch.can_logs   = can_logs?1:0;
    if (can_perm   !== undefined)            patch.can_perm   = can_perm?1:0;
    if (active     !== undefined)            patch.active     = active?1:0;
    await db.users.update(id, patch);
    if (password) await db.tokens.deleteBy(t => t.user_id === id);
    res.json({ message:'Usuario atualizado' });
  } catch(e) { res.status(500).json({ error:'Erro interno' }); }
});

router.delete('/:id', authenticate, adminOnly, async (req, res) => {
  try {
    const id   = parseInt(req.params.id);
    const user = await db.users.findOne(u => u.id === id);
    if (!user) return res.status(404).json({ error:'Usuario nao encontrado' });
    if (id === req.user.id) return res.status(400).json({ error:'Nao pode desativar o proprio usuario' });
    await db.users.update(id, { active:0 });
    await db.tokens.deleteBy(t => t.user_id === id);
    res.json({ message:'Usuario desativado' });
  } catch(e) { res.status(500).json({ error:'Erro interno' }); }
});

module.exports = router;
