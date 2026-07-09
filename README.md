# linkedin-posts-api

Servico que coleta os posts publicos de perfis do LinkedIn via scraping autenticado e expoe uma API REST de cache, reutilizavel por qualquer cliente — a comecar pela secao "posts recentes" de um portfolio.

> Aviso: scraping do LinkedIn viola os Termos de Uso da plataforma e pode levar a restricao/bloqueio da conta usada no login. Use uma conta secundaria dedicada, nunca a principal. O servico e somente leitura de conteudo ja publico.

## Stack

- Node.js >= 22 + TypeScript
- Playwright (Chromium headless) para o scraping
- Supabase (PostgreSQL) para o cache
- Fastify para a API REST
- node-cron para a coleta agendada
- pino para logs estruturados

## Pre-requisitos

- Node.js >= 22 e Yarn
- Projeto [Supabase](https://supabase.com) com o schema aplicado (ver [`docs/configuracao-pendente.md`](docs/configuracao-pendente.md))

## Configuracao

```bash
yarn install
yarn playwright install chromium
cp .env.example .env   # SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, API_KEY
```

Aplique a migracao SQL em `supabase/migrations/` no SQL Editor do Supabase (passo a passo em [`docs/configuracao-pendente.md`](docs/configuracao-pendente.md)).

Variaveis de ambiente (ver `.env.example`):

| Variavel | Descricao |
|---|---|
| `SUPABASE_URL` | URL do projeto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave service_role (somente backend) |
| `API_KEY` | Chave exigida no header `x-api-key` dos clientes |
| `PORT` | Porta do servidor HTTP (padrao 3333) |
| `SCRAPE_INTERVAL_HOURS` | Intervalo padrao de coleta por perfil |
| `SCRAPE_CONCURRENCY` | Perfis coletados em paralelo (mantenha baixo) |
| `SESSION_STORAGE_PATH` | Caminho do arquivo de sessao do LinkedIn |
| `LOG_LEVEL` | Nivel de log |

## Uso

```bash
# 1. Gerar a sessao autenticada do LinkedIn (login manual, uma vez)
yarn auth:login

# 2. Subir o servico (API + coleta agendada)
yarn dev
```

## Scripts

| Script | Acao |
|---|---|
| `yarn dev` | Sobe o servico em modo watch |
| `yarn build` | Compila para `dist/` |
| `yarn start` | Executa o build |
| `yarn auth:login` | Fluxo de login manual e geracao da sessao |
| `yarn test` | Roda os testes (vitest) |
| `yarn typecheck` | Checagem de tipos sem emitir |

## API

Todas as rotas de dados exigem o header `x-api-key`. A `GET /health` e publica.

```bash
curl http://localhost:3333/health

curl -X POST http://localhost:3333/profiles \
  -H "x-api-key: $API_KEY" -H "content-type: application/json" \
  -d '{"username":"rafael-vieira1720"}'

curl "http://localhost:3333/profiles/rafael-vieira1720/posts?limit=3" \
  -H "x-api-key: $API_KEY"
```

Codigos de erro: `401` (API key ausente/invalida), `404` (perfil nao cadastrado), `400` (requisicao invalida).

## Observabilidade

- Logs estruturados (pino) em todo o ciclo: conexao, coleta, API.
- Alerta quando um perfil acumula falhas consecutivas (>= 3).
- A API expoe `coletadoEm` em cada post para transparencia de atualidade do cache.

## Deploy

Ambiente always-on com Chromium headless (VPS, Railway, Render). Persista `storage/session.json` em volume. Configure as mesmas variaveis de ambiente do `.env.example`.

## Documentacao

- **Configuracao pendente (checklist):** [`docs/configuracao-pendente.md`](docs/configuracao-pendente.md)
- Contexto do produto: [`docs/context.md`](docs/context.md)
- Especificacao (epic e fases): pasta [`.issues/`](.issues/)
