# Configuracao pendente — linkedin-posts-api

Checklist do que ainda precisa ser configurado para rodar o servico de ponta a ponta. Atualizado apos a migracao de MongoDB/Docker para **Supabase (PostgreSQL)**.

---

## Estado atual do ambiente local

| Item | Status tipico | Bloqueia o start? |
|---|---|---|
| `.env` (copia de `.env.example`) | Pendente | **Sim** |
| Migracao SQL no Supabase (`linkedin_posts_profiles`, `linkedin_posts_posts`) | Pendente | **Sim** |
| `yarn install` + Playwright Chromium | Provavelmente OK | Nao |
| `storage/session.json` (login LinkedIn) | Pendente | Nao sobe API, mas coleta falha |
| Perfil cadastrado via API | Pendente | API sobe; posts vazios ate coleta |
| Docker | **Removido** — nao e mais necessario | — |

---

## 1. Projeto Supabase

### Criar o projeto

1. Acesse [supabase.com](https://supabase.com) e crie um projeto (free tier basta para comecar).
2. Anote a **regiao** escolhida (latencia para o servidor de deploy).

### Aplicar o schema (obrigatorio)

Execute o SQL em [`supabase/migrations/20260709180000_initial_schema.sql`](../supabase/migrations/20260709180000_initial_schema.sql):

**Opcao A — SQL Editor (mais simples)**

1. No dashboard: **SQL Editor** → **New query**.
2. Cole o conteudo inteiro do arquivo de migracao.
3. Clique em **Run**.

**Opcao B — Supabase CLI** (se tiver instalado)

```bash
supabase link --project-ref SEU_PROJECT_REF
supabase db push
```

### Verificar

No **Table Editor**, devem existir as tabelas:

- `linkedin_posts_profiles` — perfis monitorados
- `linkedin_posts_posts` — posts coletados (cache)

---

## 2. Arquivo `.env`

```bash
cp .env.example .env
```

Preencha no dashboard Supabase: **Settings → API**.

| Variavel | Onde obter | Obrigatoria? | Observacao |
|---|---|---|---|
| `SUPABASE_URL` | **Project URL** | **Sim** | Ex.: `https://xxxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | **service_role** (secret) | **Sim** | **Somente no backend.** Nunca commitar nem expor no frontend/portfolio. |
| `API_KEY` | Voce define | **Sim** | Chave forte (ex.: UUID). Usada no header `x-api-key` pelos clientes da API. |
| `PORT` | — | Nao | Padrao `3333`. |
| `SCRAPE_INTERVAL_HOURS` | — | Nao | Padrao `6`. |
| `SCRAPE_CONCURRENCY` | — | Nao | Mantenha `1`. |
| `SESSION_STORAGE_PATH` | — | Nao | Padrao `storage/session.json`. |
| `LOG_LEVEL` | — | Nao | Padrao `info`. |

### Seguranca das chaves Supabase

| Chave | Uso neste projeto |
|---|---|
| `service_role` | Backend Node (`SUPABASE_SERVICE_ROLE_KEY`) — ignora RLS, acesso total |
| `anon` / publishable | **Nao usar** neste servico — o backend fala direto com Postgres via service role |

As tabelas tem **RLS habilitado** sem politicas publicas: acesso via chave anon fica bloqueado; o backend usa `service_role`.

---

## 3. Dependencias locais

```bash
yarn install
yarn playwright install chromium   # se ainda nao instalou os binarios
```

---

## 4. Sessao do LinkedIn (scraping)

Nao vai no `.env` — arquivo gerado em runtime:

```bash
yarn auth:login
```

- Abre o navegador para login manual (incluindo 2FA).
- Salva `storage/session.json` (ja esta no `.gitignore`).
- Use uma **conta secundaria** dedicada, nao a principal.

Enquanto nao existir, o servico sobe mas as coletas falham com `sessao_invalida`.

---

## 5. Subir o servico

```bash
yarn dev
```

Ordem de inicializacao:

1. Conecta ao Supabase (valida tabelas).
2. Agenda o cron de coleta.
3. Sobe a API na porta configurada (`PORT`).

Teste rapido:

```bash
curl http://localhost:3333/health
```

---

## 6. Cadastrar perfil e validar cache

```bash
# Cadastrar (substitua SUA_API_KEY)
curl -X POST http://localhost:3333/profiles \
  -H "x-api-key: SUA_API_KEY" \
  -H "content-type: application/json" \
  -d "{\"username\":\"rafael-vieira1720\"}"

# Listar perfis
curl http://localhost:3333/profiles -H "x-api-key: SUA_API_KEY"

# Posts (vazio ate a primeira coleta bem-sucedida)
curl "http://localhost:3333/profiles/rafael-vieira1720/posts?limit=3" \
  -H "x-api-key: SUA_API_KEY"
```

A primeira coleta dispara no start do servico (se o perfil estiver vencido) e depois a cada hora. Para testar **antes** do intervalo (padrao 6 h), use coleta manual:

```bash
yarn scrape rafael-vieira1720
```

Requisitos: perfil ja cadastrado (`POST /profiles`), sessao valida (`yarn auth:login`). Rode em outro terminal enquanto `yarn dev` estiver ativo (ou pare o dev — o CLI conecta ao Supabase sozinho).

---

## 7. Pendencias de produto (fora do setup local)

| Item | Descricao |
|---|---|
| **Fase 6 — portfolio** | Issue `#7` aberta. Integrar secao "posts recentes" no repo do portfolio (proxy server-side recomendado para nao expor `API_KEY`). |
| **Deploy always-on** | VPS/Railway/Render com Chromium + sessao em volume persistente (`storage/`). |
| **Validacao ao vivo do scraper** | Depende de conta real e DOM atual do LinkedIn; testes automatizados cobrem apenas o parser com fixture HTML. |
| **Provedor de hospedagem** | Decisao pendente #1 da epic — nao bloqueia dev local. |

---

## 8. Troubleshooting

| Sintoma | Causa provavel | Acao |
|---|---|---|
| `Variavel de ambiente obrigatoria ausente` | `.env` ausente ou incompleto | Copie `.env.example` e preencha `SUPABASE_*` e `API_KEY` |
| `Supabase indisponivel ou schema nao aplicado` | Migracao nao rodou ou URL/key erradas | Reaplique o SQL; confira `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` |
| `401` na API | `x-api-key` ausente ou diferente de `API_KEY` | Alinhe o header com o valor do `.env` |
| Coleta com `sessao_invalida` (logo apos `auth:login`) | LinkedIn bloqueando headless ou nav ainda nao montada | Atualize o codigo (validacao melhorada); se persistir, `SCRAPE_HEADLESS=false` no `.env` e rode `yarn scrape` de novo |
| Coleta com `sessao_invalida` | Sem `storage/session.json`, cookie `li_at` ausente ou sessao expirada | `yarn auth:login` |
| 0 posts apos coleta | Layout do LinkedIn mudou ou perfil sem posts publicos | Ver logs; ajustar seletores em `src/scraper/postParser.ts` |
| `ALERTA: perfil com falhas consecutivas` | 3+ falhas seguidas | Renovar sessao; verificar bloqueio/CAPTCHA |

---

## 9. Checklist rapido

- [ ] Projeto Supabase criado
- [ ] Migracao SQL aplicada (`linkedin_posts_profiles` + `linkedin_posts_posts`)
- [ ] `.env` com `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e `API_KEY`
- [ ] `yarn install` e Playwright Chromium
- [ ] `yarn auth:login` (conta secundaria)
- [ ] `yarn dev` + `GET /health` OK
- [ ] `POST /profiles` com seu username
- [ ] Aguardar coleta e validar `GET /profiles/:username/posts`

---

*Documento vivo — atualizar quando novas variaveis ou passos de setup forem adicionados ao projeto.*
