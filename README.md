# linkedin-posts

[!Image](./assets/fluxo-linkedin-posts.png)

Coleta os **posts públicos** de um perfil do LinkedIn no seu PC, guarda o cache no **Supabase** e deixa qualquer site (portfólio, blog, landing) ler esses dados — sem hospedar o scraper na nuvem.

```
Seu PC (login manual + scrape)
        ↓
   Supabase (PostgreSQL)
        ↓
Seu site (Function/server lê o cache)
```

**Não precisa** deployar este repositório. O fluxo recomendado é: scrap local + banco + consumo no seu front.

> **Aviso legal:** scraping do LinkedIn viola os [Termos de Uso](https://www.linkedin.com/legal/user-agreement) da plataforma e pode levar a restrição ou bloqueio da conta usada no login. Use uma **conta secundária dedicada**, nunca a principal. Este projeto só lê conteúdo já público e é oferecido **sem garantia** — use por sua conta e risco.

Licença: [MIT](LICENSE).

---

## Para quem é

- Desenvolvedores que querem uma seção **“posts recentes”** no portfólio ou site, sem copiar texto manualmente.
- Quem publica com baixa frequência (ex.: ~1 post/semana) e aceita rodar a coleta no **próprio PC**.
- Quem prefere **cache na nuvem** com [Supabase](https://supabase.com) (PostgreSQL gerenciado; o plano gratuito atende este projeto) em vez de manter banco próprio.

**Não é para:** scraping em massa, login automático ou quem não aceita o risco dos Termos do LinkedIn (veja aviso acima).

## O que este projeto não faz

- Não faz login automático no LinkedIn (2FA, CAPTCHA e anti-bot impedem isso).
- Não precisa de Vercel/cron para o scrape (opcional e **não recomendado** no caminho feliz).
- Não exibe posts no browser sozinho — você integra a leitura no **seu** site.

---

## Pré-requisitos

| Requisito | Notas |
|-----------|--------|
| Node.js **≥ 22** | [nvm](https://github.com/nvm-sh/nvm) / [nvm-windows](https://github.com/coreybutler/nvm-windows) |
| Yarn | `npm i -g yarn` |
| Conta Supabase | Plano free basta |
| Windows (automação no logon) | Agendador de Tarefas; em outros SO use `yarn scrape` / cron manual |
| Conta LinkedIn secundária | Para o login do Playwright |

---

## Início rápido (5 passos)

### 1. Clonar e instalar

```bash
git clone https://github.com/RafaelHDSV/linkedin-posts.git
cd linkedin-posts
yarn install
yarn playwright install chromium
cp .env.example .env
```

### 2. Configurar o `.env`

Edite `.env` (nunca commite este arquivo):

```env
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key
API_KEY=uma-chave-forte-para-a-api-local
SESSION_STORAGE_PROVIDER=local
SESSION_LOCAL_PATH=storage/session.json
SCRAPE_USERNAME=seu-username-linkedin
```

O `SCRAPE_USERNAME` é o slug do perfil (`linkedin.com/in/seu-username-linkedin`).

Guia completo das variáveis: [`.env.example`](.env.example).  
Passo a passo do Supabase: [`docs/setup-supabase.md`](docs/setup-supabase.md).

### 3. Aplicar o schema no Supabase

No **SQL Editor** do Supabase, execute o conteúdo de:

[`supabase/migrations/20260709180000_initial_schema.sql`](supabase/migrations/20260709180000_initial_schema.sql)

Depois cadastre o perfil (SQL ou API local — ver setup).

### 4. Primeiro login + primeira coleta

```bash
yarn auth:login
# Abre o Chromium: faça login no LinkedIn (2FA incluso) até chegar ao feed.

yarn scrape seu-username-linkedin
# Grava os posts no Supabase.
```

### 5. (Windows) Automação no logon

```powershell
.\scripts\register-scrape-on-logon-task.ps1
```

No próximo logon do Windows:

- **Sessão válida** → a tarefa encerra em silêncio (sem janela).
- **Sessão expirada** → abre o LinkedIn para login manual e, após o feed, coleta o perfil do `SCRAPE_USERNAME`.

Detalhes: [`docs/coleta-local-logon.md`](docs/coleta-local-logon.md).

Entre expirações, atualize o cache após publicar um post:

```bash
yarn scrape seu-username-linkedin
```

---

## Integrar no seu site

O visitante **nunca** deve receber a `SUPABASE_SERVICE_ROLE_KEY`. Padrão seguro:

1. Function/server no seu host (ex.: Vercel) consulta `linkedin_posts_posts` com a service role.
2. O front chama só essa API (`GET /api/linkedin-posts`).

Guia com contrato JSON e exemplo: [`docs/integracao-site.md`](docs/integracao-site.md).

---

## Scripts

| Script | O que faz |
|--------|-----------|
| `yarn auth:login` | Login manual no LinkedIn → `storage/session.json` |
| `yarn scrape <username>` | Coleta imediata e upsert no Supabase |
| `yarn scrape:on-logon` | Fluxo do logon: valida sessão; login + scrape só se inválida |
| `yarn scrape:on-logon --dry-run` | Só verifica a sessão |
| `yarn scrape:on-logon --force` | Força login + scrape (debug) |
| `yarn dev` | API REST local + cron (opcional, desenvolvimento) |
| `yarn build` / `yarn typecheck` / `yarn test` | Build e qualidade |

Flags do on-logon e Task Scheduler: [`docs/coleta-local-logon.md`](docs/coleta-local-logon.md).

---

## API REST local (opcional)

Útil para cadastrar perfis e inspecionar o cache sem abrir o SQL Editor. **Não** é necessária em produção.

```bash
yarn dev
curl http://localhost:3333/health
curl -X POST http://localhost:3333/profiles \
  -H "x-api-key: $API_KEY" -H "content-type: application/json" \
  -d '{"username":"seu-username-linkedin"}'
curl "http://localhost:3333/profiles/seu-username-linkedin/posts?limit=3" \
  -H "x-api-key: $API_KEY"
```

Mais detalhes: [`docs/api-local.md`](docs/api-local.md).

---

## Arquitetura (resumo)

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

## Segurança

- Não commite `.env`, `storage/session.json` nem service role.
- No site público, use a service role **somente** no servidor.
- Reportar vulnerabilidades: [`SECURITY.md`](SECURITY.md).

---

## Contribuir

Issues e PRs são bem-vindos. Veja [`CONTRIBUTING.md`](CONTRIBUTING.md) e o [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md).

---

## Documentação

Índice completo: [`docs/README.md`](docs/README.md).

| Guia | Para quê |
|------|----------|
| [`docs/setup-supabase.md`](docs/setup-supabase.md) | Criar projeto, rodar migração SQL e cadastrar o perfil |
| [`docs/coleta-local-logon.md`](docs/coleta-local-logon.md) | Login LinkedIn, `yarn scrape` e Task Scheduler (Windows) |
| [`docs/integracao-site.md`](docs/integracao-site.md) | Function no seu site lendo o Supabase (sem expor secrets) |
| [`docs/api-local.md`](docs/api-local.md) | API Fastify em `localhost` — **opcional**, só para debug |
| [`docs/context.md`](docs/context.md) | Stack, decisões e escopo (referência rápida) |
| [`docs/alternativa-vercel.md`](docs/alternativa-vercel.md) | Deploy na Vercel — **legado, não recomendado** |

---

## Aviso final

Este software é fornecido “como está”, sob a licença MIT. O LinkedIn pode alterar o HTML a qualquer momento e quebrar o parser. Mantenha a frequência de coleta baixa e monitore falhas nos logs (`falhas_consecutivas` no perfil).
