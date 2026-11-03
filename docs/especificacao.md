# Especificação

> **Para que serve:** o que linkedin-posts faz hoje para um humano
> **Fonte da verdade:** código e fluxos implementados neste repositório
> **Relacionados:** [context](context.md) · [regras-de-negocio](regras-de-negocio.md) · [frontend](frontend.md)

## Objetivo

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

## O que existe hoje

- Não faz login automático no LinkedIn (2FA, CAPTCHA e anti-bot impedem isso).
- Não precisa de Vercel/cron para o scrape (opcional e **não recomendado** no caminho feliz).
- Não exibe posts no browser sozinho — você integra a leitura no **seu** site.

---

## O que não faz

- Escopo fora do README / decisões fixas em `context.md`.
