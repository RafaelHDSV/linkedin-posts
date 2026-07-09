# linkedin-posts-api

Servico que coleta os posts publicos de perfis do LinkedIn via scraping autenticado e expoe uma API REST de cache, reutilizavel por qualquer cliente — a comecar pela secao "posts recentes" de um portfolio.

> Aviso: scraping do LinkedIn viola os Termos de Uso da plataforma e pode levar a restricao/bloqueio da conta usada no login. Use uma conta secundaria dedicada, nunca a principal. O servico e somente leitura de conteudo ja publico.

## Stack

- Node.js >= 22 + TypeScript
- Playwright (Chromium headless) para o scraping
- Supabase (PostgreSQL + Storage) para cache e sessao na nuvem
- Fastify para a API REST
- node-cron (local) ou Vercel Cron Jobs (producao)
- pino para logs estruturados

## Pre-requisitos

- Node.js >= 22 e Yarn
- Projeto [Supabase](https://supabase.com) com schema e bucket de sessao (ver [`docs/hospedagem-vercel.md`](docs/hospedagem-vercel.md))

## Configuracao local

```bash
yarn install
yarn playwright install chromium
cp .env.example .env
```

Aplique a migracao SQL em `supabase/migrations/` no SQL Editor do Supabase.

Variaveis principais (ver `.env.example`):

| Variavel | Descricao |
|---|---|
| `SUPABASE_URL` | URL do projeto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave service_role (somente backend) |
| `API_KEY` | Header `x-api-key` dos clientes |
| `CRON_SECRET` | Protege `/api/cron/scrape` (obrigatorio na Vercel) |
| `SESSION_STORAGE_PROVIDER` | `local` (dev) ou `supabase` (Vercel) |
| `SESSION_LOCAL_PATH` | Arquivo local da sessao (`storage/session.json`) |
| `SESSION_STORAGE_BUCKET` | Bucket privado no Supabase Storage |
| `SESSION_REMOTE_PATH` | Objeto no bucket (`session/session.json`) |

## Uso local

> **Login:** `yarn auth:login` abre o navegador para você autenticar (incluindo 2FA). Não há relogin automático quando a sessão expira — isso é limitação do LinkedIn, não do deploy. Detalhes em [`docs/hospedagem-vercel.md` §4.4](docs/hospedagem-vercel.md#44-renovação-da-sessão-sem-login-automático).

```bash
# 1. Login manual no LinkedIn (gera storage/session.json)
yarn auth:login

# 2. API + cron interno (node-cron)
yarn dev

# 3. (Opcional) Coleta manual imediata
yarn scrape rafael-vieira1720
```

## Deploy na Vercel

A coleta roda sozinha via cron (**1x/dia no Hobby**); o **login LinkedIn continua manual** quando a sessão expirar. Sem login automático na falha — ver [§4.4](docs/hospedagem-vercel.md#44-renovação-da-sessão-sem-login-automático) e limites do Hobby em [§6](docs/hospedagem-vercel.md#6-verceljson-exemplo).

```bash
# Apos auth:login, envie a sessao para o Supabase Storage
yarn session:upload

# Conecte o repo na Vercel (vercel.json ja incluso) e configure as env vars
# Guia completo: docs/hospedagem-vercel.md
```

## Scripts

| Script | Acao |
|---|---|
| `yarn dev` | API + cron local (`node-cron`) |
| `yarn build` | Compila `src/` → `dist/` |
| `yarn start` | Processo always-on local |
| `yarn auth:login` | Login manual LinkedIn (somente local) |
| `yarn session:upload` | Envia `session.json` para Supabase Storage |
| `yarn scrape <username>` | Coleta manual imediata |
| `yarn test` | Testes (vitest) |
| `yarn typecheck` | Checagem de tipos |

## API

Todas as rotas de dados exigem `x-api-key`. `GET /health` e publica.

```bash
curl http://localhost:3333/health

curl -X POST http://localhost:3333/profiles \
  -H "x-api-key: $API_KEY" -H "content-type: application/json" \
  -d '{"username":"rafael-vieira1720"}'

curl "http://localhost:3333/profiles/rafael-vieira1720/posts?limit=3" \
  -H "x-api-key: $API_KEY"
```

## Observabilidade

- Logs estruturados (pino) em conexao, coleta e API.
- Alerta com >= 3 falhas consecutivas por perfil.
- Campo `coletadoEm` em cada post.

## Documentacao

- **Hospedagem Vercel:** [`docs/hospedagem-vercel.md`](docs/hospedagem-vercel.md)
- Contexto: [`docs/context.md`](docs/context.md)
- Epic e fases: [`.issues/`](.issues/)
