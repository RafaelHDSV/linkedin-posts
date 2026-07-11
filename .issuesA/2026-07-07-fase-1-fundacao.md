# Fase 1 — Fundação

## 1. Resumo executivo

Estabelecer a base do repositório `linkedin-posts-api`: estrutura de projeto em TypeScript, conexão com MongoDB, modelos de dados (`Profile`, `Post`) e configuração de ambiente. Esta fase não implementa scraping nem API — é o alicerce sobre o qual as fases seguintes são construídas.

## 2. Contexto e referências

- Epic de origem: [`.issues/epic.md`](./epic.md) — "LinkedIn Posts API — Scraper de Posts do LinkedIn como Serviço Reutilizável"
- Roadmap: seção 8 do epic, Fase 1 (estimativa: 1-2 dias)
- Arquitetura de referência: seção 4 do epic

## 3. Regras de negócio

- Modelo `Profile`: `username`, `url`, `ativo`, `intervaloColetaHoras`, `ultimaColetaEm`, `ultimoStatus` (sucesso/erro), `criadoEm`.
- Modelo `Post`: `postId` (chave de deduplicação), `profileUsername`, `texto`, `url`, `publicadoEm`, `tipoMidia`, `midiaUrls[]`, `reacoesCount` (opcional), `coletadoEm`.
- `postId` é único por post — a regra de deduplicação (upsert) será implementada na Fase 5, mas o índice único já deve existir desde a modelagem.

## 4. Critérios de aceitação

- [x] Repositório inicializado com TypeScript, lint e scripts básicos (`dev`, `build`, `start`)
- [x] Conexão com MongoDB estabelecida via variável de ambiente `MONGODB_URI`
- [x] Modelos `Profile` e `Post` criados conforme os campos definidos acima
- [x] `.env.example` documenta todas as variáveis já conhecidas (`MONGODB_URI`, `API_KEY`, `SCRAPE_INTERVAL_HOURS`, `SCRAPE_CONCURRENCY`)
- [x] `docker-compose.yml` sobe um MongoDB local para desenvolvimento

## 5. Análise do código existente

Repositório novo — não se aplica (nenhum código anterior a reutilizar). Convenção seguida: mesmo stack já usado em outros projetos (TypeScript, MongoDB/Mongoose), garantindo consistência com o restante do portfólio de projetos.

## 6. Arquitetura proposta

Escopo desta fase, dentro da árvore completa definida no epic (seção 4):

```
linkedin-posts-api/
├── src/
│   ├── db/
│   │   ├── models/
│   │   │   ├── Profile.ts
│   │   │   └── Post.ts
│   │   └── connection.ts
│   ├── shared/
│   │   └── types.ts        # PostDTO, ProfileDTO
│   └── index.ts            # bootstrap inicial (placeholder)
├── .env.example
├── docker-compose.yml       # MongoDB local
├── package.json
└── tsconfig.json
```

Fluxo: `index.ts` inicializa a conexão com o Mongo (`db/connection.ts`) e loga sucesso/falha — sem lógica de negócio nesta fase.

## 7. Mudanças por arquivo

| Arquivo | Tipo | Descrição da mudança |
|---|---|---|
| `package.json` | criar | dependências (`typescript`, `mongoose`, `dotenv`) e scripts `dev`/`build`/`start` |
| `tsconfig.json` | criar | configuração TypeScript do projeto |
| `.env.example` | criar | variáveis `MONGODB_URI`, `API_KEY`, `SCRAPE_INTERVAL_HOURS`, `SCRAPE_CONCURRENCY` |
| `docker-compose.yml` | criar | serviço MongoDB local para desenvolvimento |
| `src/db/connection.ts` | criar | conexão Mongoose, com log de sucesso/erro |
| `src/db/models/Profile.ts` | criar | schema/model `Profile` |
| `src/db/models/Post.ts` | criar | schema/model `Post`, com índice único em `postId` |
| `src/shared/types.ts` | criar | `ProfileDTO`, `PostDTO` |
| `src/index.ts` | criar | bootstrap inicial (conecta ao banco, sem servidor/scraper ainda) |
| `README.md` | criar | instruções de setup inicial |

## 8. Contratos e tipos

```typescript
interface ProfileDTO {
  username: string;
  url: string;
  ativo: boolean;
  intervaloColetaHoras: number;
  ultimaColetaEm: string | null;
  ultimoStatus: "sucesso" | "erro" | null;
  criadoEm: string;
}

interface PostDTO {
  postId: string;
  profileUsername: string;
  texto: string;
  url: string;
  publicadoEm: string;
  tipoMidia: "texto" | "imagem" | "video" | "documento" | "outro";
  midiaUrls: string[];
  reacoesCount?: number;
  coletadoEm: string;
}
```

## 9. Impactos colaterais e dependências

- Nenhum impacto em sistemas externos (repositório novo, sem consumidores ainda).
- Dependência de infraestrutura: MongoDB precisa estar acessível (via `docker-compose` local ou Atlas) antes de iniciar as fases seguintes.

## 10. Plano de execução em etapas

1. Inicializar repositório, `tsconfig.json`, lint e scripts npm/yarn.
2. Subir `docker-compose.yml` com MongoDB local e implementar `db/connection.ts`.
3. Criar modelos `Profile` e `Post` e os tipos compartilhados em `shared/types.ts`.
4. Escrever `.env.example` e `README.md` com instruções de primeiro uso.

## 11. Riscos, trade-offs e alternativas consideradas

- **Mongoose vs driver nativo do MongoDB:** optou-se por Mongoose pelos schemas tipados e validação embutida; alternativa (driver nativo) é mais leve, mas exige mais boilerplate manual de validação — descartada para manter velocidade de desenvolvimento.

## 12. Plano de testes

- Smoke test manual: subir `docker-compose`, rodar `yarn dev` e confirmar log de conexão bem-sucedida ao MongoDB.
- Teste unitário simples de criação de um documento `Profile` e um `Post` (validação de schema e índice único de `postId`).

## 13. Observabilidade e rollback

- Log estruturado na inicialização indicando sucesso ou falha da conexão com o MongoDB.
- Rollback trivial: fase puramente estrutural, sem dados em produção ainda; reverter é apagar o repositório/branch sem efeitos colaterais.

## 14. Dúvidas em aberto

Nenhuma dúvida bloqueante nesta fase — decisões de stack e modelagem já registradas na epic (seção 2). Fica em aberto apenas a **Decisão pendente #1** do epic (nome definitivo do repositório/pacote), sem impacto na implementação desta fase.

## 15. Aprovação

Status: implementado em 07/07/2026
