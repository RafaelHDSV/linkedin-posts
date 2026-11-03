# API

> **Para que serve:** rotas HTTP, CLI I/O, códigos de erro e contratos
> **Fonte da verdade:** handlers / routers / entrypoints CLI
> **Relacionados:** [arquitetura](arquitetura.md) · [banco-de-dados](banco-de-dados.md) · [seguranca](seguranca.md)

## Convenções

- Prefixo / entrypoint: ver código (`/api`, `/v1`, binário CLI, etc.)
- Auth: ver [seguranca](seguranca.md)

## Superfície

Útil para cadastrar perfis e inspecionar o cache sem abrir o SQL Editor. **Não** é necessária em produção.

```bash
yarn dev
curl http://localhost:3333/health
curl -X POST http://localhost:3333/profiles \
  -H "x-api-key: $API_KEY" -H "content-type: application/json" \
  -d '{"username":"seu-username-linkedin"}'
curl "http://localhost:3333/profiles/seu-username-linkedin/posts?limit=3" \
  -H "x-api-key: $API_KEY"
```

Mais detalhes: [`docs/api-local.md`](docs/api-local.md).

---

| Método / comando | Caminho | Auth | Nota |
|---|---|---|---|
| | | | Preencher a partir do código |
