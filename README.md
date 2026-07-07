# linkedin-posts-api

Servico que coleta os posts publicos de perfis do LinkedIn via scraping autenticado e expoe uma API REST de cache, reutilizavel por qualquer cliente — a comecar pela secao "posts recentes" de um portfolio.

> Aviso: scraping do LinkedIn viola os Termos de Uso da plataforma e pode levar a restricao/bloqueio da conta usada no login. Use uma conta secundaria dedicada, nunca a principal. O servico e somente leitura de conteudo ja publico.

## Stack

- Node.js >= 22 + TypeScript
- Playwright (Chromium headless) para o scraping
- MongoDB + Mongoose para o cache
- Fastify para a API REST
- node-cron para a coleta agendada
- pino para logs estruturados

## Pre-requisitos

- Node.js >= 22 e Yarn
- MongoDB (local via `docker-compose` ou Atlas)

## Configuracao

```bash
yarn install
yarn playwright install chromium
cp .env.example .env   # edite os valores (API_KEY, MONGODB_URI, etc.)
docker compose up -d mongo
```

Variaveis de ambiente (ver `.env.example`):

| Variavel | Descricao |
|---|---|
| `MONGODB_URI` | Conexao com o MongoDB |
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
# Healthcheck
curl http://localhost:3333/health

# Cadastrar um perfil (aceita username ou URL do LinkedIn)
curl -X POST http://localhost:3333/profiles \
  -H "x-api-key: $API_KEY" -H "content-type: application/json" \
  -d '{"username":"rafael-vieira1720"}'

# Listar perfis monitorados
curl http://localhost:3333/profiles -H "x-api-key: $API_KEY"

# Buscar posts recentes (paginado, sempre lido do cache)
curl "http://localhost:3333/profiles/rafael-vieira1720/posts?limit=3&page=1" \
  -H "x-api-key: $API_KEY"

# Remover um perfil (e opcionalmente seus posts)
curl -X DELETE "http://localhost:3333/profiles/rafael-vieira1720?comPosts=true" \
  -H "x-api-key: $API_KEY"
```

Exemplo de resposta de `GET /profiles/:username/posts`:

```json
{
  "profile": "rafael-vieira1720",
  "posts": [
    {
      "postId": "urn:li:activity:1234567890",
      "profileUsername": "rafael-vieira1720",
      "texto": "Conclui o curso X na Udemy...",
      "url": "https://www.linkedin.com/feed/update/urn:li:activity:1234567890",
      "publicadoEm": "",
      "tipoMidia": "imagem",
      "midiaUrls": ["https://media.licdn.com/..."],
      "reacoesCount": 42,
      "coletadoEm": "2026-07-07T03:00:00.000Z"
    }
  ],
  "pagination": { "page": 1, "limit": 3, "total": 18 }
}
```

Codigos de erro: `401` (API key ausente/invalida), `404` (perfil nao cadastrado), `400` (requisicao invalida).

## Observabilidade

- Logs estruturados (pino) em todo o ciclo: conexao, coleta, API.
- Alerta (`error`) quando um perfil acumula falhas consecutivas (>= 3) — indica sessao expirada, bloqueio ou mudanca de layout.
- Alerta quando a extracao retorna 0 posts para um perfil.
- A API expoe `coletadoEm` em cada post para transparencia de atualidade do cache.

## Deploy

Use um ambiente always-on com suporte a Chromium headless (VPS, Railway, Render) — evite serverless por causa do navegador e da sessao persistida em `storage/`.

## Validacao ao vivo

O scraping depende de login manual em conta real e do DOM ao vivo do LinkedIn. Para validar de ponta a ponta:

1. `yarn auth:login` com uma conta secundaria dedicada.
2. Suba um MongoDB e configure `MONGODB_URI`.
3. `yarn dev`, cadastre um perfil e aguarde o proximo ciclo de coleta.

Os seletores de DOM ficam isolados em `src/scraper/postParser.ts` e podem exigir ajuste quando o LinkedIn muda de layout.

## Documentacao

- Contexto do produto: [`docs/context.md`](docs/context.md)
- Especificacao (epic e fases): pasta [`.issues/`](.issues/)
