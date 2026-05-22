const jwt = require('jsonwebtoken');
require('dotenv').config();

const SECRET = process.env.JWT_SECRET;

function authenticate(req, res, next) {
  const header = req.headers['authorization'];
  if (!header?.startsWith('Bearer '))
    return res.status(401).json({ error:'Token não informado' });
  const token = header.split(' ')[1];
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch(e) {
    if (e.name === 'TokenExpiredError')
      return res.status(401).json({ error:'Token expirado', code:'TOKEN_EXPIRED' });
    return res.status(401).json({ error:'Token inválido' });
  }
}

function adminOnly(req, res, next) {
  if (req.user.role !== 'admin')
    return res.status(403).json({ error:'Acesso restrito a administradores' });
  next();
}

function canUpload(req, res, next) {
  if (req.user.role !== 'admin' && !req.user.can_upload)
    return res.status(403).json({ error:'Sem permissão para upload' });
  next();
}

module.exports = { authenticate, adminOnly, canUpload };
