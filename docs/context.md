# Contexto do projeto — linkedin-posts-api

## O que e

Servico que coleta os posts publicos de perfis do LinkedIn via scraping autenticado (Playwright) e expoe uma API REST de cache (Fastify + Supabase/PostgreSQL), reutilizavel por N clientes. O primeiro consumidor real e a secao "posts recentes" do portfolio pessoal.

## Principios

- A API nunca dispara scraping em tempo real — sempre serve dados ja coletados e cacheados.
- Um unico servico, N consumidores.
- Prioridade em reduzir o risco de bloqueio da conta do LinkedIn usada para coleta (throttling, intervalos, sessao persistida).
- Dados sempre normalizados no contrato `PostDTO`, desacoplado do HTML/DOM do LinkedIn.

## Arquitetura (resumo)

- `src/scraper/` — Playwright: sessao autenticada, navegacao e extracao de posts.
- `src/scheduler/` — cron interno que coleta periodicamente e persiste (upsert por `post_id`).
- `src/db/` — cliente Supabase e repositorios (`linkedin_posts_profiles`, `linkedin_posts_posts`).
- `src/api/` — API REST Fastify, autenticada por header `x-api-key`, somente leitura do cache.
- `src/shared/` — tipos, logger e utilitario de retry/backoff.
- `supabase/migrations/` — schema PostgreSQL com prefixo `linkedin_posts_` nas tabelas.

## Referencias

- Epic e fases: pasta `.issues/` deste repositorio.
- Configuracao pendente: [`docs/configuracao-pendente.md`](configuracao-pendente.md).
- Perfil de referencia: https://www.linkedin.com/in/rafael-vieira1720/

## Aviso legal

Scraping do LinkedIn viola os Termos de Uso da plataforma e pode levar a restricao/bloqueio da conta usada para login. Recomenda-se usar uma conta secundaria dedicada, nunca a conta pessoal principal. O servico e somente leitura de conteudo ja publico.
