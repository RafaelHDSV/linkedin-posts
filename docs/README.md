# Documentação

Guias do **linkedin-posts**, na ordem em que você provavelmente vai precisar deles.

| Ordem | Guia | Quando ler |
|-------|------|------------|
| 1 | [setup-supabase.md](setup-supabase.md) | Primeiro clone: criar projeto Supabase, aplicar SQL e cadastrar o perfil |
| 2 | [coleta-local-logon.md](coleta-local-logon.md) | Login LinkedIn, coleta manual e automação no logon (Windows) |
| 3 | [integracao-site.md](integracao-site.md) | Exibir posts no portfólio/site via Function server-side |
| 4 | [api-local.md](api-local.md) | **Opcional** — inspecionar cache ou cadastrar perfil sem SQL |
| — | [context.md](context.md) | Referência rápida (stack, decisões, escopo) |
| — | [alternativa-vercel.md](alternativa-vercel.md) | **Não recomendado** — scrape/API na Vercel (legado) |

O [README](../README.md) na raiz traz o **início rápido** em cinco passos. Use esta pasta para aprofundar cada etapa.

## Fluxo completo

```
1. setup-supabase     → tabelas + perfil no banco
2. coleta-local-logon → auth:login, yarn scrape, Task Scheduler (Windows)
3. integracao-site    → GET /api/linkedin-posts no seu site
```

Este repositório **não precisa de deploy**. Só o **seu site** (ex.: Vercel) recebe env vars do Supabase para **ler** o cache — nunca para fazer scrape.

## O que não está aqui

- **`.issues/`** — planejamento interno (não versionado no clone público).
- **Código Vercel legado** (`api/`, `vercel.json`) — mantido no repo, documentado só em [alternativa-vercel.md](alternativa-vercel.md).
