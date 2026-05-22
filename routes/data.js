const express = require('express');
const router  = express.Router();
const db      = require('../config/database');
const { authenticate } = require('../middleware/auth');

router.get('/current', authenticate, async (req, res) => {
  try {
    const row = await db.dashboard.getCurrent();
    if (!row) return res.json({ empty:true, message:'Faca upload da planilha.', kpis:{}, curva_s:[], areas:[], avancos:[], riscos:[] });
    res.json({ empty:false, ...row,
      kpis:    typeof row.kpis    === 'string' ? JSON.parse(row.kpis)    : row.kpis,
      curva_s: typeof row.curva_s === 'string' ? JSON.parse(row.curva_s) : row.curva_s,
      areas:   typeof row.areas   === 'string' ? JSON.parse(row.areas)   : row.areas,
      avancos: typeof row.avancos === 'string' ? JSON.parse(row.avancos) : row.avancos,
      riscos:  typeof row.riscos  === 'string' ? JSON.parse(row.riscos)  : row.riscos,
    });
  } catch(e) { res.status(500).json({ error:'Erro interno' }); }
});

router.get('/summary', authenticate, async (req, res) => {
  try {
    const row = await db.dashboard.getCurrent();
    if (!row) return res.json({ empty:true });
    const kpis = typeof row.kpis === 'string' ? JSON.parse(row.kpis) : row.kpis;
    res.json({ empty:false, realizado:row.realizado, planejado:row.planejado,
      desvio:row.desvio, semana:row.semana, filename:row.filename,
      uploaded_by:row.uploaded_by, uploaded_at:row.created_at,
      riscos:kpis['Riscos Ativos']||0, a_concluir:kpis['A Concluir']||(100-row.realizado) });
  } catch(e) { res.status(500).json({ error:'Erro interno' }); }
});

module.exports = router;
