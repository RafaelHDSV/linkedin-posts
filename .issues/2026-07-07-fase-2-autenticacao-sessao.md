# Fase 2 — Autenticação e gestão de sessão

## 1. Resumo executivo

Implementar o fluxo de login manual no LinkedIn via Playwright, persistindo a sessão autenticada (`storageState`) para reuso headless nas coletas automatizadas das fases seguintes, com validação e alerta de expiração.

## 2. Contexto e referências

- Epic de origem: [`.issues/epic.md`](./epic.md) — seção 5.1 (Autenticação e gestão de sessão)
- Depende da Fase 1 (estrutura do repositório) já implementada
- Roadmap: seção 8 do epic, Fase 2 (estimativa: 1 dia)

## 3. Regras de negócio

- Login é **manual e único**: o usuário autentica em um navegador Playwright não-headless (incluindo 2FA, se houver).
- A sessão resultante (`storageState`) é salva localmente e reutilizada por execuções headless futuras — nunca se armazenam credenciais (usuário/senha) em texto puro no código ou em banco.
- Recomendação registrada na epic (decisão #8): usar uma conta secundária do LinkedIn dedicada ao serviço, não a conta pessoal principal.
- Sessão deve ser validada antes de cada coleta; se inválida, a coleta falha de forma controlada e loga alerta pedindo novo login manual — sem tentativa automática de recuperação de credenciais.

## 4. Critérios de aceitação

- [x] Comando `yarn auth:login` abre navegador interativo e salva `storage/session.json` ao final do login
- [x] Arquivo de sessão fica fora do controle de versão (`.gitignore`)
- [x] Função `session.isValid()` detecta corretamente sessão expirada (ex.: redirecionamento para tela de login)
- [ ] Sessão válida é reutilizada por pelo menos 7 dias sem novo login manual (validação ao vivo — depende de conta real)
- [x] Alerta claro é logado quando a sessão expira ou uma verificação de segurança (CAPTCHA/2FA) é detectada

## 5. Análise do código existente

Reutiliza a estrutura criada na Fase 1: `src/shared/logger.ts` (a criar como parte do mecanismo compartilhado, seção 6 do epic) e `src/db/connection.ts` não são impactados diretamente — esta fase é isolada em `src/scraper/`.

## 6. Arquitetura proposta

```
src/scraper/
├── browser.ts   # bootstrap do Playwright + carregamento do storageState
└── session.ts   # login manual, validação e alerta de expiração
storage/
└── session.json  # gerado em runtime, fora do versionamento
```

Fluxo:

```
yarn auth:login
  → browser.launch({ headless: false })
  → usuário loga manualmente no LinkedIn
  → context.storageState({ path: "storage/session.json" })

session.ensureValidSession() (chamado pelo scheduler/scraper nas fases seguintes)
  → carrega storageState
  → abre página de teste (ex.: feed)
  → se redirecionado para login → sessão inválida → loga alerta e aborta coleta
  → se ok → retorna contexto autenticado
```

## 7. Mudanças por arquivo

| Arquivo | Tipo | Descrição da mudança |
|---|---|---|
| `src/scraper/browser.ts` | criar | bootstrap do Playwright, criação de contexto com `storageState` |
| `src/scraper/session.ts` | criar | fluxo de login manual (`auth:login`) e `isValid()`/`ensureValidSession()` |
| `.gitignore` | alterar | adicionar `storage/` |
| `package.json` | alterar | adicionar script `auth:login` e dependência `playwright` |
| `README.md` | alterar | documentar o passo de login manual como pré-requisito de uso |

## 8. Contratos e tipos

```typescript
interface SessionStatus {
  valido: boolean;
  motivo?: "expirada" | "captcha" | "nao_autenticado";
  verificadoEm: string;
}

function ensureValidSession(): Promise<SessionStatus>;
function loginInterativo(): Promise<void>; // usado apenas por `yarn auth:login`
```

## 9. Impactos colaterais e dependências

- Dependência externa: instalação dos binários do Chromium via Playwright (`playwright install`).
- Impacta diretamente as Fases 3 e 4 (motor de scraping e scheduler), que consomem `ensureValidSession()` antes de cada coleta.
- Ambiente de deploy precisa permitir a execução do Chromium headless (ver seção 7 do epic — não serverless).

## 10. Plano de execução em etapas

1. Instalar Playwright e configurar `browser.ts` (bootstrap headless/non-headless).
2. Implementar `session.ts` com o fluxo de login manual e persistência do `storageState`.
3. Implementar `ensureValidSession()` com detecção de expiração/CAPTCHA.
4. Testar o ciclo completo: login manual → fechar processo → nova execução headless reaproveitando a sessão.

## 11. Riscos, trade-offs e alternativas consideradas

- **Login manual vs automação de login (usuário/senha via script):** optou-se por login manual para evitar armazenar credenciais e reduzir risco de detecção como bot logo na autenticação; automação de login é mais frágil frente a 2FA e verificações de segurança do LinkedIn.
- Risco de a sessão expirar em produção sem supervisão — mitigado pelo alerta obrigatório (critério de aceite acima) e pela seção 10 (riscos) do epic.

## 12. Plano de testes

- Manual: executar `yarn auth:login`, validar geração do `storage/session.json`.
- Manual: aguardar/forçar expiração da sessão e confirmar que `ensureValidSession()` detecta e loga corretamente.
- Unitário: mock de página retornando URL de login para validar a lógica de `isValid()`.

## 13. Observabilidade e rollback

- Log de alerta (nível `warn`/`error`) quando a sessão expira, exige CAPTCHA ou não é encontrada.
- Rollback: remover `storage/session.json` e repetir o login manual; não há estado persistente crítico além do arquivo de sessão.

## 14. Dúvidas em aberto

Nenhuma dúvida bloqueante — decisão de autenticação já registrada na epic (decisão #7 e #8).

## 15. Aprovação

Status: implementado em 07/07/2026 (validação ao vivo da longevidade da sessão pendente de conta real)
