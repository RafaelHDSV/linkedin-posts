# Arquitetura

> **Para que serve:** estrutura do repositório, ciclo de request e fronteiras de empacotamento/deploy
> **Fonte da verdade:** layout de pastas, entrypoints, `vercel.json` / scripts de build
> **Relacionados:** [context](context.md) · [api](api.md) · [ambiente-e-operacao](ambiente-e-operacao.md)

## Visão

| Camada | Papel |
|--------|--------|
| `src/scraper/` | Playwright: sessão, navegação, parser |
| `src/cli/` | `auth:login`, `scrape`, `scrape:on-logon` |
| `src/scheduler/` | Collector (upsert) e cron interno opcional |
| `src/db/` | Cliente Supabase e repositórios |
| `src/api/` | Fastify local (opcional) |
| `scripts/` | PowerShell para Agendador de Tarefas (Windows) |
| `supabase/migrations/` | Schema PostgreSQL (`linkedin_posts_*`) |

Contexto do projeto: [`docs/context.md`](docs/context.md).

---

## Fronteiras

| Fronteira | Nota |
|---|---|
| App vs docs | `docs/` é contrato de living docs (board#7), não runtime |
| Segredos | Só `.env` / painel do provedor — nunca no Git |

Dependências declaradas em `package.json` (amostra): @sparticuz/chromium, @supabase/supabase-js, dotenv, fastify, linkedom, node-cron, pino, playwright, playwright-core, @types/node, @types/node-cron, @vercel/node, pino-pretty, tsx, typescript, vitest.
