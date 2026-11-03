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
