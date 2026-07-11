# Contexto do projeto — linkedin-posts-api

## O que é

Serviço que coleta posts públicos de perfis do LinkedIn via scraping autenticado (Playwright) e persiste um cache no Supabase/PostgreSQL. O primeiro consumidor é a seção "posts recentes" do portfólio pessoal, acessada por uma Function Vercel server-side.

## Principios

- O portfólio nunca dispara scraping em tempo real — sempre lê dados já coletados e cacheados.
- Prioridade em reduzir o risco de bloqueio da conta do LinkedIn usada para coleta.
- **Sessão LinkedIn:** o login é manual. A tarefa do Windows valida a sessão a cada logon e só abre o navegador quando ela está inválida; não há relogin automático para 2FA, CAPTCHA ou credenciais.
- Dados são normalizados no contrato `PostDTO`, desacoplado do HTML/DOM do LinkedIn.

## Arquitetura (resumo)

- `src/scraper/` — Playwright: sessão autenticada, navegação e extração de posts.
- `src/cli/scrapeOnLogon.ts` — valida sessão, solicita login se necessário e coleta `rafael-vieira1720`.
- `src/db/` — cliente Supabase e repositórios (`linkedin_posts_profiles`, `linkedin_posts_posts`).
- `src/api/` — API REST Fastify, preservada para clientes internos e desenvolvimento.
- `src/shared/` — tipos, logger e utilitário de retry/backoff.
- `supabase/migrations/` — schema PostgreSQL com prefixo `linkedin_posts_` nas tabelas.

## Referencias

- Epic e fases: pasta `.issues/` deste repositorio.
- Configuração local e Agendador de Tarefas: [`coleta-local-logon.md`](coleta-local-logon.md).
- Integração do portfólio: [`integracao-portfolio-supabase.md`](integracao-portfolio-supabase.md).
- Hospedagem Vercel (opcional): [`hospedagem-vercel.md`](hospedagem-vercel.md).
- Perfil de referência: https://www.linkedin.com/in/rafael-vieira1720/

## Aviso legal

Scraping do LinkedIn viola os Termos de Uso da plataforma e pode levar à restrição ou ao bloqueio da conta usada para login. Recomenda-se usar uma conta secundária dedicada, nunca a conta pessoal principal. O serviço é somente leitura de conteúdo já público.
