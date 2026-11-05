# Ambiente e operação

> **Para que serve:** como rodar, configurar e publicar linkedin-posts
> **Fonte da verdade:** `package.json`, `.env.example`, scripts de CI/deploy
> **Relacionados:** [context](context.md) · [seguranca](seguranca.md)

## Setup

```bash
git clone https://github.com/RafaelHDSV/linkedin-posts.git
cd linkedin-posts
yarn install
yarn playwright install chromium
cp .env.example .env
```

Variáveis relevantes da coleta (além de Supabase/sessão em [`.env.example`](../.env.example)):

| Variável | Default | Uso |
|----------|---------|-----|
| `SCRAPE_USERNAME` | — | Slug do perfil no logon |
| `SCRAPE_HEADLESS` | `true` (exceto se `false`) | `false` para depurar o Chromium |
| `SCRAPE_STALE_AFTER_DAYS` | `8` | Erro `cache_stale` se o post mais recente do lote for mais velho que N dias |
