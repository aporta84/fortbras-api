# Fortbras Dashboard API v2.0

Backend robusto para o Dashboard Executivo Fortbras — Plano de Conversão Menil.

## Stack
- **Node.js** + **Express 4**
- **SQLite** (better-sqlite3) — zero configuração, arquivo único
- **JWT** + **Refresh Token** — sessão renovável de 7 dias
- **bcryptjs** — senhas criptografadas
- **Helmet** — segurança HTTP
- **Rate Limiting** — proteção contra brute force

## Instalação rápida

```bash
cd fortbras-api
npm install
node server.js
```

Acesse: http://localhost:3001/api/health

## Endpoints

### Autenticação
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | /api/auth/login | Login → retorna accessToken + refreshToken |
| POST | /api/auth/refresh | Renova accessToken com refreshToken |
| POST | /api/auth/logout | Invalida tokens |
| GET  | /api/auth/me | Retorna usuário logado |

### Dados do Dashboard
| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| GET | /api/data/current | ✅ | Todos os dados (KPIs, áreas, curva S, tabelas) |
| GET | /api/data/summary | ✅ | Resumo rápido de KPIs |

### Upload
| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| POST | /api/upload | ✅ + canUpload | Processa planilha xlsx |
| GET  | /api/upload/history | ✅ | Histórico de uploads |

### Usuários (admin)
| Método | Rota | Descrição |
|--------|------|-----------|
| GET    | /api/users | Lista usuários ativos |
| GET    | /api/users?all=1 | Lista todos (incluindo inativos) |
| POST   | /api/users | Cria usuário |
| PUT    | /api/users/:id | Edita usuário |
| DELETE | /api/users/:id | Desativa usuário |
| GET    | /api/users/admin/logs | Log de acessos |

## Usuários iniciais

| Usuário | Senha | Perfil |
|---------|-------|--------|
| admin | admin | Administrador |
| aporta | 123456 | Administrador |
| fortbras | fortbras | Visualizador |
| lucimario.campos | lucimario123 | Visualizador + Upload |
| rogerio.tambellini | tambellini123 | Visualizador |
| jorge.cavalcanti | jorge123 | Visualizador |

## Variáveis de ambiente (.env)

```env
PORT=3001
NODE_ENV=production
JWT_SECRET=sua_chave_secreta_longa
JWT_EXPIRES_IN=8h
JWT_REFRESH_EXPIRES_IN=7d
DB_PATH=./data/fortbras.db
UPLOADS_DIR=./data/uploads
MAX_FILE_SIZE_MB=10
ALLOWED_ORIGINS=https://fortbras-menil.netlify.app
```

## Deploy no Render.com

1. Suba este projeto no GitHub
2. render.com → New Web Service → conecte o repositório
3. Build: `npm install` · Start: `node server.js`
4. Adicione as variáveis de ambiente
5. Copie a URL gerada (ex: https://fortbras-api.onrender.com)
6. Cole no `index.html`: `const API_URL = 'https://fortbras-api.onrender.com/api'`

## Segurança implementada

- Senhas com bcrypt (salt 10)
- JWT access token (8h) + refresh token (7 dias)
- Rate limiting: 100 req/min geral, 10 req/min no login
- Helmet (headers HTTP seguros)
- CORS com lista de origens permitidas
- Soft delete (usuários desativados, não deletados)
- Log completo de acessos e ações
- Validação de tipo de arquivo no upload
- Transações SQLite para consistência dos dados
