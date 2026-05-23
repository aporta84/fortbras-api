const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const db       = require('../config/database');
const { parseWorkbook } = require('../services/xlsx.service');
const { authenticate, adminOnly, canUpload } = require('../middleware/auth');

// Usa memória em vez de disco (evita problema de storage efêmero no Render)
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req,file,cb) => {
    if (!file.originalname.match(/\.(xlsx|xls)$/i)) return cb(new Error('Apenas .xlsx'));
    cb(null,true);
  },
  limits: { fileSize: (Number(process.env.MAX_FILE_SIZE_MB)||10)*1024*1024 }
});

router.post('/', authenticate, canUpload, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error:'Nenhum arquivo enviado' });
  try {
    const data = parseWorkbook(req.file.buffer);
    await db.history.insert({ filename:req.file.originalname, uploaded_by:req.user.username,
      realizado:data.realizado, planejado:data.planejado, desvio:data.desvio, semana:data.semana });
    await db.dashboard.replace({ filename:req.file.originalname, kpis:data.kpis, curva_s:data.curva_s,
      areas:data.areas, avancos:data.avancos, riscos:data.riscos,
      uploaded_by:req.user.username, realizado:data.realizado, planejado:data.planejado,
      desvio:data.desvio, semana:data.semana });
    res.json({ success:true, message:'Planilha processada com sucesso', filename:req.file.originalname,
      semana:data.semana, realizado:data.realizado, planejado:data.planejado, desvio:data.desvio });
  } catch(err) {
    res.status(500).json({ error:'Erro ao processar planilha: '+err.message });
  }
});

router.get('/history', authenticate, async (req, res) => {
  try {
    res.json(await db.history.findAll(Math.min(parseInt(req.query.limit)||20, 50)));
  } catch(e) { res.status(500).json({ error:'Erro interno' }); }
});

// Limpa histórico antigo — mantém apenas entradas do dia atual (admin only)
router.delete('/history/old', authenticate, adminOnly, async (req, res) => {
  try {
    const { rowCount } = await db.pool.query(
      `DELETE FROM upload_history WHERE created_at::date < CURRENT_DATE`
    );
    res.json({ success: true, deleted: rowCount, message: `${rowCount} entradas antigas removidas` });
  } catch(e) { res.status(500).json({ error: 'Erro ao limpar histórico: ' + e.message }); }
});

module.exports = router;
