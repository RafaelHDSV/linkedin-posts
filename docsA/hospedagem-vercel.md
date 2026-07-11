# Hospedagem na Vercel — opção futura

> **Decisão atual:** não hospedar o scraper na Vercel. O fluxo principal é a [coleta local no logon do Windows](coleta-local-logon.md), que abre login manual apenas quando a sessão expira. O portfólio consulta o Supabase por sua própria Function Vercel.

Este guia permanece como referência para uma eventual API pública, coleta agendada na nuvem e cache no Supabase.

> **Leitura obrigatória:** o projeto atual foi pensado como processo **always-on** (Fastify + `node-cron` + Playwright). Na Vercel isso vira **funções serverless + Cron Jobs**. Funciona, mas exige **adaptações de código** listadas na seção 2 antes do primeiro deploy.

> **Sessão LinkedIn — expectativa correta:** a coleta na nuvem é automática (cron), mas **o login no LinkedIn não é**. Quando a sessão expira, é preciso renovar manualmente no PC (`yarn auth:login` + `yarn session:upload`). **Não há login automático confiável** na falha — veja a seção [4.4](#44-renovação-da-sessão-sem-login-automático).

---

## 1. Visão geral

| Componente | Local (hoje) | Vercel (alvo) |
|---|---|---|
| API REST | Fastify em `yarn dev` | Serverless Function (Fastify adaptado ou rotas `/api/*`) |
| Coleta agendada | `node-cron` (a cada hora) | Vercel Cron → `/api/cron/scrape` — **1x/dia no Hobby**; horária no Pro |
| Cache | Supabase PostgreSQL | Igual (já na nuvem) |
| Sessão LinkedIn | `storage/session.json` no disco | **Supabase Storage** (objeto `session/session.json`) |
| Login no LinkedIn | `yarn auth:login` no PC (manual) | **Sempre manual no PC** — não roda na Vercel; ver [§4.4](#44-renovação-da-sessão-sem-login-automático) |

Fluxo alvo:

```
Vercel Cron (1x por dia no Hobby — ver §6)
  → /api/cron/scrape (protegido por CRON_SECRET)
    → baixa session.json da nuvem
    → Playwright headless coleta perfis vencidos
    → upsert no Supabase

Portfólio / clientes
  → GET https://seu-projeto.vercel.app/profiles/:user/posts
    → lê só o Supabase (sem scraping síncrono)
```

---

## 2. Adaptações no código (implementadas)

O repositório está preparado para deploy na Vercel com:

- **`api/[...path].ts`** — API Fastify via serverless (rewrites para `/health`, `/profiles`)
- **`api/cron/scrape.ts`** — coleta agendada, protegida por `CRON_SECRET`
- **`src/storage/sessionStorage.ts`** — sessão em disco (local) ou Supabase Storage (produção)
- **`playwright-core` + `@sparticuz/chromium`** — Chromium em serverless
- **`yarn session:upload`** — envia `storage/session.json` para o bucket após `auth:login`
- **`vercel.json`** — cron **diário** (Hobby), rewrites; scrape com **2048 MB / 60 s**

### Fluxo de deploy resumido

```bash
yarn auth:login          # local — uma vez ou quando a sessao expirar
yarn session:upload      # sobe session.json para o Supabase Storage
# Configure env vars na Vercel e faça deploy do branch main
```

### Detalhes técnicos (referência)

---

## 3. Pré-requisitos

- [ ] Conta [Vercel](https://vercel.com) (time conectado ao GitHub)
- [ ] Repositório `RafaelHDSV/linkedin-posts` (ou fork) com as adaptações da seção 2
- [ ] Projeto **Supabase** com migração `supabase/migrations/20260709180000_initial_schema.sql` aplicada
- [ ] Perfil cadastrado (`POST /profiles`) — pode ser feito após o deploy
- [ ] Conta LinkedIn **secundária** para a sessão de coleta
- [ ] Sessão gerada localmente: `yarn auth:login` → `storage/session.json`

---

## 4. Supabase Storage (sessão na nuvem)

### 4.1 Criar bucket

No Supabase Dashboard → **Storage** → New bucket:

| Campo | Valor |
|---|---|
| Name | `linkedin-posts-private` |
| Public | **não** (privado) |

### 4.2 Política de acesso

Somente o backend (service role) lê/escreve. **Não** exponha esse bucket no frontend.

A `SUPABASE_SERVICE_ROLE_KEY` já bypassa RLS — use apenas nas funções Vercel (Environment Variables, tipo **Secret**).

### 4.3 Upload inicial da sessão

Após `yarn auth:login` no PC, envie o arquivo (via script do projeto ou painel Supabase):

```bash
# Enviar sessao para o bucket (script do projeto)
yarn session:upload
```

Ou manualmente: Storage → bucket → Upload `session.json` em `session/session.json`.

### 4.4 Renovação da sessão (sem login automático)

#### O que é automático vs manual

| Automático (sem sua intervenção) | Manual (quando a sessão expira) |
|---|---|
| Cron dispara coleta a cada hora | `yarn auth:login` no seu PC |
| Scraper usa `session.json` do Supabase Storage | `yarn session:upload` para substituir o arquivo na nuvem |
| API serve posts cacheados do Supabase | Concluir 2FA/CAPTCHA no navegador, se o LinkedIn pedir |

A coleta **não exige** `yarn dev` local. O login **exige** interação humana — por design e por limitação do LinkedIn.

#### Por que não há login automático na falha (`sessao_invalida`)

Quando a coleta retorna `sessao_invalida`, o LinkedIn está pedindo **reautenticação real**, não só “renovar um token” em background. Por isso **não implementamos** (e não recomendamos) fluxo do tipo “detectou falha → preenche e-mail/senha no Playwright”:

| Barreira | Efeito |
|---|---|
| **2FA** | Código no app ou SMS — impossível resolver headless na Vercel |
| **CAPTCHA / checkpoint** | Página `/checkpoint` bloqueia automação |
| **Anti-bot** | Login automatizado aumenta risco de bloqueio da conta |
| **Serverless** | Sem navegador visível; filesystem efêmero; cold start |

Guardar `LINKEDIN_EMAIL` / `LINKEDIN_PASSWORD` no `.env` e tentar relogar no cron **não é confiável**: quebra com 2FA, muda layout com frequência e expõe credenciais. O serviço **não** oferece esse caminho.

#### O que fazer quando a sessão expirar

1. Rode `yarn auth:login` no PC (conta **secundária** recomendada)
2. Rode `yarn session:upload` (ou upload manual no bucket)
3. Opcional: `yarn scrape <username>` para validar antes do próximo cron

Isso costuma ser necessário a cada **semanas ou meses**, não a cada deploy — desde que a sessão no Storage permaneça válida.

#### Como se preocupar menos

- Use **conta secundária** só para coleta (menos impacto se bloquear)
- Mantenha `SCRAPE_CONCURRENCY=1` e intervalo ≥ 6 h (menos pressão na sessão)
- Monitore logs Vercel ou `falhasConsecutivas` no perfil (alerta ≥ 3 no código)
- A API **continua servindo** o cache antigo enquanto a sessão estiver inválida — só deixa de atualizar até você renovar

---

## 5. Variáveis de ambiente na Vercel

Project → **Settings** → **Environment Variables** (Production + Preview se quiser):

| Variável | Obrigatória | Descrição |
|---|---|---|
| `SUPABASE_URL` | sim | URL do projeto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | sim | Secret; só backend |
| `API_KEY` | sim | Header `x-api-key` dos clientes |
| `CRON_SECRET` | sim | Token longo; valida `/api/cron/scrape` |
| `SCRAPE_INTERVAL_HOURS` | não | Padrão `6` |
| `SCRAPE_CONCURRENCY` | não | Padrão `1` |
| `SESSION_STORAGE_PROVIDER` | sim* | `supabase` na Vercel (padrao automatico) |
| `SESSION_STORAGE_BUCKET` | sim* | Ex.: `linkedin-posts-private` |
| `SESSION_REMOTE_PATH` | não | Ex.: `session/session.json` |
| `SESSION_LOCAL_PATH` | não | Somente dev; padrao `storage/session.json` |
| `SCRAPE_HEADLESS` | não | `true` em produção |
| `LOG_LEVEL` | não | `info` |

\* Quando a adaptação de storage estiver implementada.

**Nunca** commite `.env` nem `storage/session.json`.

---

## 6. `vercel.json` (exemplo)

Crie na raiz do repositório:

```json
{
  "version": 2,
  "buildCommand": "yarn build",
  "installCommand": "yarn install",
  "framework": null,
  "rewrites": [
    { "source": "/health", "destination": "/api/health" },
    { "source": "/profiles", "destination": "/api/profiles" },
    { "source": "/profiles/:path*", "destination": "/api/profiles/:path*" }
  ],
  "crons": [
    {
      "path": "/api/cron/scrape",
      "schedule": "0 11 * * *"
    }
  ],
  "functions": {
    "api/[...path].ts": {
      "maxDuration": 30,
      "memory": 1024
    },
    "api/cron/scrape.ts": {
      "maxDuration": 60,
      "memory": 2048
    }
  }
}
```

- **Cron `0 11 * * *`** = **uma vez por dia**, às 11:00 UTC (~08:00 em Brasília, UTC−3). Obrigatório no **Hobby** — contas pessoais só permitem **cron diário**; expressões horárias (`0 * * * *`) **falham no deploy**.
- **Plano Pro:** pode trocar para `0 * * * *` (a cada hora), como o `node-cron` local.
- **Plano Hobby:** memória máxima **2048 MB** e duração máxima **60 s** por função.
- **Plano Pro:** pode subir para `memory: 3008` e `maxDuration: 300` na rota de scrape.
- **Coleta extra no Hobby:** dispare manualmente `GET /api/cron/scrape` com `Authorization: Bearer CRON_SECRET` (ou GitHub Action externa) entre um cron e outro.
- Com cron diário, a frequência **efetiva** de atualização é no máximo **1x/dia**, mesmo que `SCRAPE_INTERVAL_HOURS=6` — o intervalo só é avaliado quando o cron roda.

---

## 7. Deploy passo a passo

### 7.1 Conectar o repositório

1. [vercel.com/new](https://vercel.com/new) → Import Git Repository
2. Selecione `linkedin-posts`
3. Framework Preset: **Other**
4. Root Directory: `.` (raiz)

### 7.2 Configurar build

| Campo | Valor |
|---|---|
| Build Command | `yarn build` |
| Output Directory | deixe vazio ou `.` (funções em `api/`) |
| Install Command | `yarn install` |

### 7.3 Variáveis

Cole todas da seção 5. Marque secrets como **Sensitive**.

### 7.4 Deploy

Clique **Deploy**. Acompanhe os logs:

- Erro de Playwright/Chromium → revisar seção 2.3
- Timeout na primeira coleta → aumentar `maxDuration` ou reduzir perfis por ciclo

### 7.5 Cadastrar perfil (produção)

```bash
curl -X POST https://SEU-PROJETO.vercel.app/profiles \
  -H "x-api-key: SUA_API_KEY" \
  -H "content-type: application/json" \
  -d '{"username":"rafael-vieira1720"}'
```

### 7.6 Testar API

```bash
curl https://SEU-PROJETO.vercel.app/health

curl "https://SEU-PROJETO.vercel.app/profiles/rafael-vieira1720/posts?limit=3" \
  -H "x-api-key: SUA_API_KEY"
```

### 7.7 Testar cron manualmente

Antes de esperar 1 h, dispare o endpoint (com o mesmo secret configurado na Vercel):

```bash
curl "https://SEU-PROJETO.vercel.app/api/cron/scrape" \
  -H "Authorization: Bearer SEU_CRON_SECRET"
```

Confira logs: Vercel → Project → **Logs** (filtrar pela rota `/api/cron/scrape`).

---

## 8. Integração com o portfólio (Vercel)

No projeto do portfólio (também na Vercel), configure **Environment Variables** do **servidor** (não `NEXT_PUBLIC_` para a API key):

| Variável | Exemplo |
|---|---|
| `LINKEDIN_POSTS_API_URL` | `https://linkedin-posts-xxx.vercel.app` |
| `LINKEDIN_POSTS_API_KEY` | mesma `API_KEY` do serviço |

A página de posts chama a API no **server** (RSC, `getServerSideProps`, Route Handler) — nunca exponha a chave no bundle do browser.

---

## 9. Operação no dia a dia

| Tarefa | Onde |
|---|---|
| Ver se a coleta rodou | Logs Vercel + campo `coletadoEm` nos posts |
| Forçar coleta | `curl` no `/api/cron/scrape` ou `yarn scrape` local apontando ao Supabase de produção |
| Renovar sessão LinkedIn | **Manual:** `yarn auth:login` → `yarn session:upload` (não há relogin automático) |
| Novo perfil | `POST /profiles` na URL de produção |
| Pausar coletas | Desativar perfil na API ou remover cron no `vercel.json` |

Alerta já existente no código: **≥ 3 falhas consecutivas** por perfil → investigar sessão ou bloqueio do LinkedIn.

---

## 10. Limitações e riscos

| Tópico | Detalhe |
|---|---|
| **ToS LinkedIn** | Scraping pode violar termos; use conta secundária |
| **Timeout** | Coleta de vários perfis pode estourar o limite da função — mantenha `SCRAPE_CONCURRENCY=1` |
| **Cold start** | Primeira execução após idle pode ser mais lenta (Chromium + Playwright) |
| **Sessão** | Expira periodicamente; **login automático na falha não é suportado** — renovação manual no PC + upload (§4.4) |
| **Login automático** | Não implementado: 2FA, CAPTCHA e anti-bot do LinkedIn impedem relogin confiável em serverless |
| **Plano Hobby** | Cron **só 1x/dia**; memória máx. **2048 MB**; duração máx. **60 s** — repo usa `0 11 * * *` + 2048 MB; coleta horária e limites maiores → **Pro** (§11) |
| **Documentos PDF** | Preview pode não vir em `midiaUrls`; `tipoMidia: documento` + `url` do post |

---

## 11. Alternativa se a Vercel apertar

Se Playwright + timeout continuar problemático, hospede **só o scraper** em serviço always-on e mantenha a API na Vercel:

| Serviço | Papel |
|---|---|
| **Vercel** | API REST (leitura Supabase) |
| **Railway / Render / VPS** | Worker com `yarn start` (cron interno + Playwright) |

O README já cita Railway/Render para always-on — é o caminho de menor fricção **sem** refatorar para serverless.

---

## 12. Checklist rápido

- [ ] `vercel.json` e handlers `api/` no repositorio
- [ ] Migração Supabase aplicada
- [ ] Bucket de sessão criado e `session.json` enviado
- [ ] Variáveis na Vercel (incl. `CRON_SECRET`)
- [ ] `vercel.json` com cron e `maxDuration`
- [ ] Deploy verde
- [ ] `POST /profiles` em produção
- [ ] `GET /posts` retorna dados com `publicadoEm`
- [ ] Cron executado (logs ou `coletadoEm` atualizado)
- [ ] Portfólio apontando para URL + API key de produção

---

## Referências

- [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs)
- [Vercel Functions — maxDuration](https://vercel.com/docs/functions/configuring-functions/duration)
- [Supabase Storage](https://supabase.com/docs/guides/storage)
- Contexto do projeto: [`context.md`](context.md)
- Configuração local: [`README.md`](../README.md)
