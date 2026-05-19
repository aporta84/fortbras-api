const jwt = require('jsonwebtoken');
const db = require('../config/database');
require('dotenv').config();

const SECRET = process.env.JWT_SECRET;

// Verifica access token
function authenticate(req, res, next) {
  const header = req.headers['authorization'];
  if (!header?.startsWith('Bearer '))
    return res.status(401).json({ error: 'Token não informado' });

  const token = header.split(' ')[1];
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch (e) {
    if (e.name === 'TokenExpiredError')
      return res.status(401).json({ error: 'Token expirado', code: 'TOKEN_EXPIRED' });
    return res.status(401).json({ error: 'Token inválido' });
  }
}

// Apenas admin
function adminOnly(req, res, next) {
  if (req.user.role !== 'admin')
    return res.status(403).json({ error: 'Acesso restrito a administradores' });
  next();
}

// Pode fazer upload
function canUpload(req, res, next) {
  if (req.user.role !== 'admin' && !req.user.can_upload)
    return res.status(403).json({ error: 'Sem permissão para upload' });
  next();
}

// Log de acesso
function logAction(action) {
  return (req, res, next) => {
    try {
      db.prepare(`
        INSERT INTO access_logs (user_id, username, action, ip, user_agent)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        req.user?.id || null,
        req.user?.username || 'anon',
        action,
        req.ip,
        req.headers['user-agent']?.slice(0, 200) || ''
      );
    } catch (e) { /* não bloqueia a requisição */ }
    next();
  };
}

module.exports = { authenticate, adminOnly, canUpload, logAction };
