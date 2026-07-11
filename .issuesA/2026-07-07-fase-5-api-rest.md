# Fase 5 — API REST

## 1. Resumo executivo

Implementar a API REST que expõe o cadastro de perfis e a consulta de posts já coletados (sempre lendo do MongoDB, nunca disparando scraping em tempo real), autenticada por API key e pronta para ser consumida por múltiplos clientes.

## 2. Contexto e referências

- Epic de origem: [`.issues/epic.md`](./epic.md) — seções 5.2 (Cadastro de perfis) e 5.6 (API REST de consumo)
- Depende da Fase 1 (modelos) e da Fase 4 (dados já persistidos pelo scheduler)
- Roadmap: seção 8 do epic, Fase 5 (estimativa: 1-2 dias)

## 3. Regras de negócio

- A API **nunca** dispara scraping síncrono — todo endpoint de leitura consulta exclusivamente o MongoDB (decisão #3 da epic).
- Todas as rotas exigem header `x-api-key` válido, exceto `GET /health`.
- Cadastrar um novo perfil (`POST /profiles`) deve deixá-lo pronto para ser coletado no próximo ciclo do scheduler (Fase 4) — não dispara coleta imediata síncrona.
- Consulta de posts é paginada, ordenada por `publicadoEm` decrescente (mais recentes primeiro).
- Perfil inexistente retorna `404` com corpo de erro claro; ausência/erro de API key retorna `401`.

## 4. Critérios de aceitação

- [x] `POST /profiles` cria um novo perfil monitorado e retorna `201`
- [x] `GET /profiles` lista perfis com `ultimaColetaEm`/`ultimoStatus`
- [x] `DELETE /profiles/:username` remove o perfil (e, opcionalmente, seus posts)
- [x] `GET /profiles/:username/posts?limit=&page=` retorna posts paginados, mais recentes primeiro (leitura pura de banco)
- [x] `GET /health` responde sem exigir API key
- [x] Requisição sem `x-api-key` válido retorna `401` em todas as rotas protegidas
- [x] Perfil inexistente em `GET /profiles/:username/posts` retorna `404` com mensagem clara

## 5. Análise do código existente

Reutiliza os modelos `Profile`/`Post` e a conexão MongoDB (Fase 1). Não há API preexistente no repositório — implementação nova em `src/api/`.

## 6. Arquitetura proposta

```
src/api/
├── routes/
│   ├── profiles.ts   # POST/GET/DELETE /profiles
│   └── posts.ts       # GET /profiles/:username/posts
├── middlewares/
│   └── apiKeyAuth.ts  # validação do header x-api-key
└── server.ts           # bootstrap do servidor HTTP (Fastify/Express)
```

Fluxo:

```
GET /profiles/:username/posts?limit=10&page=1
  → middleware apiKeyAuth (valida x-api-key)
  → busca Profile por username → 404 se não existir
  → busca Post paginado por profileUsername, ordenado por publicadoEm desc
  → retorna { profile, posts, pagination }
```

## 7. Mudanças por arquivo

| Arquivo | Tipo | Descrição da mudança |
|---|---|---|
| `src/api/server.ts` | criar | bootstrap do servidor HTTP (Fastify/Express), registro de rotas e middlewares |
| `src/api/routes/profiles.ts` | criar | `POST/GET/DELETE /profiles` |
| `src/api/routes/posts.ts` | criar | `GET /profiles/:username/posts` com paginação |
| `src/api/middlewares/apiKeyAuth.ts` | criar | validação do header `x-api-key` contra `API_KEY` do `.env` |
| `src/index.ts` | alterar | inicializar `api/server.ts` junto ao `cronJobs` (Fase 4) |
| `README.md` | alterar | documentar endpoints, autenticação e exemplos de request/response |

## 8. Contratos e tipos

```typescript
// POST /profiles
interface CreateProfileBody {
  username: string;
}

// GET /profiles/:username/posts
interface PostsResponse {
  profile: string;
  posts: PostDTO[];
  pagination: { page: number; limit: number; total: number };
}

interface ApiError {
  erro: string;
  detalhe?: string;
}
```

## 9. Impactos colaterais e dependências

- Primeiro ponto de contato de clientes externos (portfólio, na Fase 6, e futuros consumidores) — mudanças de contrato aqui impactam diretamente todos os consumidores.
- Depende dos dados persistidos pela Fase 4; se o scheduler nunca rodou para um perfil, a API retorna lista vazia de posts (não é erro).

## 10. Plano de execução em etapas

1. Configurar `server.ts` com Fastify/Express e o middleware `apiKeyAuth`.
2. Implementar rotas de `profiles` (`POST`, `GET`, `DELETE`).
3. Implementar rota de `posts` com paginação e ordenação.
4. Implementar tratamento padronizado de erros (`404`, `401`) e `GET /health`.
5. Documentar endpoints no `README.md` com exemplos de request/response.

## 11. Riscos, trade-offs e alternativas consideradas

- **API key simples vs OAuth/JWT:** optou-se por API key simples em header (decisão #6 da epic) por simplicidade, adequada ao número reduzido de consumidores esperado em v1; OAuth fica como possível evolução futura se o número de clientes externos crescer.
- **Fastify vs Express:** ambos atendem; escolha final fica a critério da implementação, sem impacto na especificação de contratos acima.

## 12. Plano de testes

- Testes de integração por rota: criação/listagem/remoção de perfil, consulta de posts com paginação, casos de erro (`401`, `404`).
- Teste de performance simples: validar tempo de resposta de `GET /profiles/:username/posts` abaixo de 300ms com dados de exemplo no banco.
- Teste manual via `curl`/Postman documentado no `README.md`.

## 13. Observabilidade e rollback

- Log de cada requisição (rota, status, tempo de resposta) via logger compartilhado (`src/shared/logger.ts`, Fase 3).
- Rollback: API é somente leitura sobre dados já persistidos (exceto cadastro/remoção de perfil) — reverter uma versão da API não afeta a integridade dos dados coletados.

## 14. Dúvidas em aberto

Nenhuma dúvida bloqueante — contratos e regras já definidos na epic (seções 5.2 e 5.6).

## 15. Aprovação

Status: implementado em 07/07/2026
