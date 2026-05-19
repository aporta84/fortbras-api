const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();
require('./config/database'); // inicializa JSON db e seed

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(helmet({ contentSecurityPolicy:false, crossOriginResourcePolicy:{policy:'cross-origin'} }));

const origins = (process.env.ALLOWED_ORIGINS||'').split(',').map(o=>o.trim()).filter(Boolean);
origins.push('http://localhost:3000','http://127.0.0.1:5500','null');

app.use(cors({ origin:(o,cb)=>{
  if (!o || origins.includes(o)) return cb(null,true);
  cb(new Error('Origem nao permitida: '+o));
}, credentials:true, methods:['GET','POST','PUT','DELETE','OPTIONS'], allowedHeaders:['Content-Type','Authorization'] }));

app.use(rateLimit({ windowMs:60000, max:100, message:{error:'Muitas requisicoes.'} }));
app.use(express.json({limit:'5mb'}));
app.use(express.urlencoded({extended:true}));
app.set('trust proxy',1);

app.use('/api/auth',   require('./routes/auth'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/data',   require('./routes/data'));
app.use('/api/users',  require('./routes/users'));

app.get('/api/health', (req,res) => res.json({
  status:'ok', project:'Fortbras Dashboard API', version:'2.0.0',
  timestamp: new Date().toISOString()
}));

app.use((req,res) => res.status(404).json({error:'Rota nao encontrada: '+req.method+' '+req.path}));
app.use((err,req,res,next) => {
  if (err.code==='LIMIT_FILE_SIZE') return res.status(413).json({error:'Arquivo muito grande'});
  console.error('[ERROR]', err.message);
  res.status(500).json({error: err.message||'Erro interno'});
});

app.listen(PORT, () => {
  console.log('\n Fortbras Dashboard API v2.0');
  console.log('   Porta:    '+PORT);
  console.log('   Banco:    Arquivos JSON em ./data/');
  console.log('\n   Health: http://localhost:'+PORT+'/api/health\n');
});
