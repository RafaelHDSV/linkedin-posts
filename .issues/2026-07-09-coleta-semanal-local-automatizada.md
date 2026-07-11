# Coleta local automatizada (logon) + portfólio via Supabase direto

**Data:** 2026-07-09  
**Atualizado:** 2026-07-11 (decisões §14 registradas)  
**Status:** implementado — validação manual pendente

---

## 1. Resumo executivo

Implementar um fluxo **local no Windows** disparado no **logon do PC** que verifica a sessão LinkedIn: se **inválida**, abre login manual visível e executa scrape de `rafael-vieira1720`; se **válida**, **skip silencioso**. Dados persistem no Supabase. O portfólio (`DEV/portifolio`) consome posts via **Function Vercel server-side** com `service_role` (recomendação adotada), sem API `linkedin-posts` hospedada.

**Resultado esperado:** ligar o PC → (sessão expirada) janela de login → login → scrape → Supabase atualizado → portfólio lê via `/api/linkedin-posts` na Vercel.

---

## 2. Contexto e referências

| Referência | Descrição |
|------------|-----------|
| Decisão do usuário (chat 2026-07-09) | Scrap local; automação no boot; login manual quando necessário |
| Decisões do usuário (chat 2026-07-11) | Respostas §14 — ver seção abaixo |
| Repositório portfólio | `c:\Users\rafae\OneDrive\Documentos\DEV\portifolio` |
| `portifolio/docs/context.md` | React 18 · Vite 7 · Vercel · SPA; seção LinkedIn posts removida em jun/2026 — **reintroduzir** via Supabase |
| `.issues/2026-07-07-fase-6-integracao-portfolio.md` | Fase 6 previa API REST — **abordagem alterada** para Supabase via Function Vercel no portfólio |
| `docs/context.md` (linkedin-posts) | Princípios do projeto (cache, sessão manual, PostDTO) |
| `docs/hospedagem-vercel.md` | Guia Vercel linkedin-posts — **não** é o caminho feliz para scrape |
| `supabase/migrations/20260709180000_initial_schema.sql` | Schema com RLS (service_role ignora) |
| Perfil alvo | https://www.linkedin.com/in/rafael-vieira1720/ (`rafael-vieira1720`) |

---

## 3. Regras de negócio

1. **Coleta nunca em tempo real no portfólio** — o site só exibe dados já cacheados no Supabase.
2. **Login LinkedIn sempre manual** — só quando `ensureValidSession()` indicar sessão inválida (expirada, CAPTCHA, não autenticado).
3. **Gatilho: logon do Windows** — Task Scheduler dispara o script na sessão do usuário.
4. **Execução após expiração do token** — no **primeiro logon** depois que a sessão expirou: login (se necessário) + scrape. **Não** há intervalo fixo de 7 dias nem dia da semana.
5. **Sessão válida no logon** — **skip silencioso** (exit 0, só log); sem janela visível e sem scrape automático.
6. **Scrape manual ad hoc** — `yarn scrape rafael-vieira1720` permanece para atualizar cache após publicar post (sessão válida).
7. **Perfil único:** `rafael-vieira1720` (hardcoded ou env `SCRAPE_USERNAME`).
8. **Persistência:** upsert por `post_id` em `linkedin_posts_posts`.
9. **Portfólio:** leitura via Function Vercel com `SUPABASE_SERVICE_ROLE_KEY` (server-only); SPA **não** expõe service role no browser.
10. **Conta LinkedIn:** conta secundária recomendada (`docs/context.md`).

---

## 4. Critérios de aceitação

- [x] Comando `yarn scrape:on-logon` valida sessão → login visível **somente se inválida** → scrape de `rafael-vieira1720`.
- [x] Sessão válida → exit 0 sem janela visível (skip silencioso, log `pulado`).
- [x] Script PowerShell + instruções registram tarefa no Agendador (gatilho **At logon**).
- [x] `yarn scrape rafael-vieira1720` permanece inalterado.
- [x] `src/storage/sessionStorage.ts` presente no repositório; `yarn build` aprovado.
- [x] `docs/integracao-portfolio-supabase.md` com stack Vite + Function Vercel + env vars + query + fallback.
- [x] **Fase 6 (repo portfólio):** `api/linkedin-posts.ts` + hook/componente seção posts. Variáveis `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` ainda devem ser configuradas na Vercel.
- [x] `README.md` e `docs/context.md` atualizados: fluxo principal = local no logon; Vercel linkedin-posts = opcional.
- [x] Migration RLS anon read não criada: service role da Function atende o requisito sem expor a tabela ao browser.

---

## 5. Análise do código existente

### linkedin-posts

| Módulo | Caminho | Reutilização |
|--------|---------|--------------|
| Validação sessão | `src/scraper/session.ts` → `ensureValidSession()` | **Gate principal** do fluxo on-logon |
| Login interativo | `src/scraper/session.ts` → `loginInterativo()` | Só se sessão inválida |
| Scrape + persistência | `src/scheduler/collector.ts` → `executarColeta()` | Após login ou scrape manual |
| CLI scrape manual | `src/cli/scrapeProfile.ts` | Mantém |
| Session storage | `src/storage/sessionStorage.ts` | Verificar/criar se ausente |
| Cron interno / Vercel cron | `src/scheduler/cronJobs.ts`, `api/cron/` | Fora do caminho feliz |

### portifolio (`DEV/portifolio`)

| Aspecto | Estado atual |
|---------|--------------|
| Stack | React 18 · TypeScript · **Vite 7** · SASS · i18next |
| Deploy | **Vercel** — https://rafaelhdsv.vercel.app |
| Modelo | **SPA** (sem Next.js App Router / Server Components) |
| API existente | `api/og/` — usado no **build** (`scripts/generate-og.ts`); padrão para adicionar **runtime** Function |
| Supabase | **Ainda não integrado** |
| LinkedIn posts | Seção removida (issues #38, jun/2026); link de perfil em Contato/Footer/Recrutador |
| Env pattern | `VITE_*` no client; secrets server-side **sem** prefixo `VITE_` na Vercel |

**Integração portfólio:** nova Function `api/linkedin-posts.ts` (ou `.js`) consulta Supabase com service role; hook React consome `/api/linkedin-posts` no client.

---

## 6. Arquitetura proposta

```
[Windows Logon]
      │
      ▼
[Task Scheduler] ──► scripts/scrape-on-logon.ps1
      │                    │
      │                    ▼
      │              yarn scrape:on-logon
      │                    │
      ├─► ensureValidSession() (headless)
      │      │
      │      ├─ válida ──► log "pulado" ──► exit 0 (skip silencioso)
      │      │
      │      └─ inválida ──► loginInterativo() (browser visível)
      │              │ usuário loga → /feed → session.json
      │              ▼
      ├─► connectDatabase()
      ├─► executarColeta("rafael-vieira1720")
      ├─► disconnectDatabase()
      └─► exit 0/1

[Portfólio — Vercel]
      │
      ▼
GET /api/linkedin-posts  (Function serverless)
      │  env: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
      ▼
Supabase: SELECT FROM linkedin_posts_posts
      WHERE profile_username = 'rafael-vieira1720'
      ORDER BY publicado_em DESC NULLS LAST LIMIT N
      │
      ▼
React SPA (hook) → seção "Posts recentes" + fallback se vazio
```

---

## 7. Mudanças por arquivo

### Repositório `linkedin-posts`

| Arquivo | Tipo | Descrição | Tamanho |
|---------|------|-----------|---------|
| `src/cli/scrapeOnLogon.ts` | criar | Orquestra validação → login condicional → coleta | M |
| `src/scraper/session.ts` | alterar | Encadear login + coleta sem fechar browser prematuramente (se necessário) | S |
| `scripts/scrape-on-logon.ps1` | criar | Wrapper PowerShell (PATH, cd repo, `yarn scrape:on-logon`) | S |
| `scripts/register-scrape-on-logon-task.ps1` | criar | Registra tarefa At logon | S |
| `src/storage/sessionStorage.ts` | criar/verificar | Implementação local | S |
| `docs/integracao-portfolio-supabase.md` | criar | Guia Fase 6 para repo portifolio | M |
| `docs/coleta-local-logon.md` | criar | Fluxo operacional, troubleshooting | M |
| `README.md`, `docs/context.md`, `docs/hospedagem-vercel.md` | alterar | Fluxo local; Vercel opcional | S |
| `package.json` | alterar | Script `"scrape:on-logon"` | XS |
| `.env.example` | alterar | `SCRAPE_USERNAME=rafael-vieira1720` | XS |

### Repositório `portifolio` (Fase 6 — após aprovação)

| Arquivo | Tipo | Descrição |
|---------|------|-----------|
| `api/linkedin-posts.ts` | criar | Function Vercel: query Supabase service role |
| `src/hooks/useLinkedInPosts.ts` | criar | Fetch `/api/linkedin-posts` |
| `src/screens/LinkedInPosts/` | criar | Seção UI + skeleton + empty state |
| `src/App.tsx` | alterar | Lazy load da seção |
| `src/locales/pt.json`, `en.json` | alterar | Copy i18n |
| `.env.example` | alterar | Nota: vars **só na Vercel** (não VITE_) |
| `docs/context.md` | alterar | Documentar integração |

---

## 8. Contratos e tipos

### 8.1 CLI linkedin-posts

```bash
yarn scrape:on-logon           # valida sessão; login só se inválida; scrape se executou login
yarn scrape:on-logon --force   # força login + scrape (debug)
yarn scrape:on-logon --dry-run # só valida sessão, sem browser de login
yarn scrape rafael-vieira1720  # manual (inalterado)
```

### 8.2 Function portfólio `GET /api/linkedin-posts`

```typescript
// Response 200
interface LinkedInPostsResponse {
  posts: Array<{
    postId: string;
    texto: string;
    url: string;
    publicadoEm: string | null;
    tipoMidia: string;
    midiaUrls: string[];
    reacoesCount: number | null;
  }>;
  profileUsername: "rafael-vieira1720";
}
```

Query Supabase (server):

```sql
SELECT post_id, texto, url, publicado_em, tipo_midia, midia_urls, reacoes_count
FROM linkedin_posts_posts
WHERE profile_username = 'rafael-vieira1720'
ORDER BY publicado_em DESC NULLS LAST
LIMIT 5;
```

### 8.3 Env vars portfólio (Vercel — server only)

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

**Não** usar `VITE_` para a service role.

---

## 9. Impactos colaterais e dependências

| Área | Impacto |
|------|---------|
| Portfólio | Nova seção posts; 2 env vars na Vercel; dependência `@supabase/supabase-js` (devDep ou dep na Function) |
| Supabase | Mesmo projeto linkedin-posts; sem migration obrigatória |
| linkedin-posts Vercel | Sem deploy |
| Sessão longa | Entre expirações, cache só atualiza via `yarn scrape` manual |
| OneDrive | Path absoluto no Task Scheduler |

---

## 10. Plano de execução em etapas

1. **linkedin-posts — fix:** `sessionStorage.ts` + `yarn build`.
2. **linkedin-posts — core:** `scrapeOnLogon.ts`, scripts PowerShell, docs.
3. **linkedin-posts — doc portfólio:** `docs/integracao-portfolio-supabase.md`.
4. **portifolio — Fase 6:** Function + hook + UI + i18n + E2E básico.
5. **Manual:** registrar tarefa Windows, testar logon com sessão expirada e válida.

---

## 11. Riscos, trade-offs e alternativas

| Decisão | Trade-off |
|---------|-----------|
| Skip se sessão válida (sem scrape) | Novos posts só entram via `yarn scrape` manual até próxima expiração — aceito pelo usuário |
| Login só se inválida | Menos friction; alinhado ao pedido |
| service_role na Function | Seguro; RLS anon desnecessário |
| Vite SPA vs Next RSC | Function Vercel equivalente ao Route Handler recomendado |

---

## 12. Plano de testes

| Cenário | Esperado |
|---------|----------|
| Logon + sessão válida | exit 0, log pulado, sem janela |
| Logon + sessão inválida | login visível → scrape → posts no Supabase |
| `yarn scrape rafael-vieira1720` | regressão OK |
| `GET /api/linkedin-posts` (portfólio) | JSON com posts ou array vazio |
| UI portfólio cache vazio | fallback i18n + link perfil LinkedIn |

---

## 13. Observabilidade e rollback

- Logs Pino em `scrapeOnLogon.ts`.
- Rollback automação: desabilitar tarefa no Agendador.
- Rollback portfólio: remover seção + Function; env vars na Vercel.

---

## 14. Dúvidas em aberto — **RESOLVIDAS (2026-07-11)**

| # | Pergunta | Decisão |
|---|----------|---------|
| 1 | Repo/stack portfólio | **`DEV/portifolio`** — React 18 + Vite 7 SPA, deploy **Vercel** (`docs/context.md`). Sem Supabase hoje; padrão `api/` existente para OG no build — adicionar Function runtime para posts. |
| 2 | Chave Supabase | **Seguir recomendação:** `SUPABASE_SERVICE_ROLE_KEY` **somente server** na Function Vercel `/api/linkedin-posts`. Migration RLS anon **opcional** (não bloqueante). |
| 3 | Login toda semana? | **Não.** Login **somente** quando sessão inválida (`ensureValidSession`). |
| 4 | Skip quando não due | **Skip silencioso** (log only). |
| 5 | Intervalo | **Primeiro logon após expiração do token** — sem calendário fixo de 7 dias. |
| 6 | Perfis | **Apenas `rafael-vieira1720`** (usuário digitou `rafaelvieira1720`; username correto no LinkedIn inclui hífen). |

---

## 15. Aprovação

**Status:** implementado em 2026-07-11 — validação manual pendente.

Antes do primeiro uso, configure as variáveis server-only do Supabase na Vercel do portfólio, registre a tarefa com `.\scripts\register-scrape-on-logon-task.ps1` e valide os cenários de sessão válida e expirada.
