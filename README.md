# linkedin-posts-api

Servico que coleta os posts publicos de perfis do LinkedIn via scraping autenticado e expoe uma API REST de cache, reutilizavel por qualquer cliente — a comecar pela secao "posts recentes" de um portfolio.

> Aviso: scraping do LinkedIn viola os Termos de Uso da plataforma e pode levar a restricao/bloqueio da conta usada no login. Use uma conta secundaria dedicada, nunca a principal. O servico e somente leitura de conteudo ja publico.

## Stack

- Node.js >= 22 + TypeScript
- Playwright (Chromium) para o scraping local
- Supabase (PostgreSQL) para cache de posts
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

## Uso local (fluxo principal)

> **Automação no logon:** configure uma vez o Agendador de Tarefas do Windows. No primeiro logon depois que a sessão LinkedIn expirar, o navegador abre para login manual e o scrape é executado. Com sessão válida, a tarefa encerra silenciosamente. Veja [`docs/coleta-local-logon.md`](docs/coleta-local-logon.md).

```bash
# 1. Registre a coleta local no logon do Windows
powershell -ExecutionPolicy Bypass -File scripts/register-scrape-on-logon-task.ps1

# 2. (Opcional) Coleta manual imediata após publicar um post
yarn scrape rafael-vieira1720
```

## Deploy na Vercel

Não use a Vercel como caminho principal para o scraping deste projeto. Para a frequência baixa de posts, a coleta local no logon reduz custo, complexidade e dependência de sessão remota. A configuração Vercel permanece documentada para uso futuro em [`docs/hospedagem-vercel.md`](docs/hospedagem-vercel.md).

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
| `yarn scrape:on-logon` | Valida sessão; faz login e coleta somente se ela estiver inválida |
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
