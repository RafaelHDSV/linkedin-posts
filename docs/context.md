# Contexto do projeto — linkedin-posts

Referência rápida para humanos e assistentes de IA. Onboarding passo a passo: [README.md](../README.md) e [docs/README.md](README.md).

**Pacote:** `linkedin-posts` · **Licença:** MIT · **Ano:** 2026

---

## Objetivo

Coletar posts **públicos** de um perfil LinkedIn via Playwright **no PC do usuário**, persistir cache no Supabase e permitir que sites leiam esse cache por Function/server — **sem** hospedar o scraper.

## Stack

| Camada | Tecnologia |
|--------|------------|
| Runtime | Node.js ≥ 22, TypeScript, Yarn |
| Scrape | Playwright (Chromium) |
| Cache | Supabase PostgreSQL (`linkedin_posts_*`) |
| API local | Fastify + `x-api-key` (opcional) |
| Logs | pino |
| Automação | Task Scheduler + PowerShell (Windows) |

## Fluxo principal

1. [Setup Supabase](setup-supabase.md) — schema + perfil
2. [Coleta local](coleta-local-logon.md) — `auth:login`, `scrape`, logon opcional
3. [Integração no site](integracao-site.md) — Function lê Supabase

## Decisões fixas

1. Login LinkedIn **manual** (sem relogin automático para 2FA/CAPTCHA).
2. **Sem deploy** deste repo no caminho feliz.
3. Um perfil por automação de logon (`SCRAPE_USERNAME`).
4. Service role **nunca** no browser.
5. Conta LinkedIn secundária; scraping viola ToS — risco assumido pelo usuário.

## Portas (dev)

| Serviço | URL |
|---------|-----|
| API local | http://localhost:3333 |

## Documentação

Ver índice em [docs/README.md](README.md).

## Fora de escopo

- Scrape na Vercel como padrão ([alternativa-vercel.md](alternativa-vercel.md))
- Login automático / bypass de CAPTCHA
- Scraping em massa ou UI admin web

## Aviso legal

Software “como está” (MIT). LinkedIn pode alterar o HTML e quebrar o parser a qualquer momento.
