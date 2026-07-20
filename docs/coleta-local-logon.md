# Coleta local no logon (Windows)

Este guia cobre **como** o LinkedIn é consultado no seu PC: login manual, coleta manual e (opcional) tarefa no logon do Windows.

**Pré-requisito:** [setup-supabase.md](setup-supabase.md) concluído (tabelas + perfil cadastrado).

---

## Como funciona

```
Logon Windows (Task Scheduler)
        ↓
  yarn scrape:on-logon
        ↓
   Sessão válida? ──sim──→ coleta em silêncio (sem janela) → upsert no Supabase
        │
       não
        ↓
  Abre Chromium → você faz login → chega ao /feed
        ↓
  coleta (SCRAPE_USERNAME) → upsert no Supabase
```

| Situação | O que acontece |
|----------|----------------|
| Sessão válida no logon | Coleta silenciosa (sem janela) e upsert no Supabase |
| Sessão expirada / ausente | Janela de login → coleta automática após o feed |
| Você publicou um post e a sessão ainda vale | O próximo logon já coleta; para atualizar na hora, rode `yarn scrape <username>` |

> 2FA, CAPTCHA e checkpoint são resolvidos **por você** na janela aberta. O projeto não preenche senha nem contorna anti-bot.

**macOS / Linux:** não há script de Agendador incluso. Use `yarn auth:login` + `yarn scrape` quando precisar, ou agende o mesmo comando com `cron` / `launchd`.

---

## Preparação (primeira vez)

```powershell
yarn install
yarn playwright install chromium
Copy-Item .env.example .env   # se ainda não fez
```

Confirme no `.env`:

```env
SESSION_STORAGE_PROVIDER=local
SESSION_LOCAL_PATH=storage/session.json
SCRAPE_USERNAME=seu-username-linkedin
```

Gere a sessão inicial:

```powershell
yarn auth:login
```

O Chromium abre; faça login até o **feed**. O arquivo `storage/session.json` é criado (gitignored — **nunca** commite).

Primeira coleta:

```powershell
yarn scrape seu-username-linkedin
```

Verifique no Supabase (**Table Editor** → `linkedin_posts_posts`) se os posts apareceram.

---

## Automação no logon (Windows)

Na **raiz do repositório clonado**:

```powershell
.\scripts\register-scrape-on-logon-task.ps1
```

Cria a tarefa **LinkedIn Posts - Coleta no logon** (gatilho **At logon**, usuário atual). Internamente: `scripts/scrape-on-logon.ps1` → `yarn scrape:on-logon`.

Se **mover** a pasta do projeto, execute o registro de novo (o caminho fica absoluto na tarefa).

---

## Comandos de referência

```powershell
yarn scrape:on-logon              # fluxo do logon
yarn scrape:on-logon --dry-run    # só testa a sessão
yarn scrape:on-logon --force      # força login + scrape (debug)
yarn scrape seu-username-linkedin # atualização manual
yarn auth:login                   # renovar sessão sem scrape
```

Para simular sessão expirada: apague `storage/session.json` ou use `--force`.

---

## Solução de problemas

| Sintoma | Verificação |
|---------|-------------|
| `Yarn não encontrado` | PATH do usuário no Agendador; reinicie o terminal após instalar Node/Yarn |
| Perfil não cadastrado | [setup-supabase.md §4](setup-supabase.md#4-cadastrar-o-perfil) |
| `sessao_invalida` | Conclua login até o **feed**; rode `yarn auth:login` |
| CAPTCHA / checkpoint | Resolva na janela; não há bypass automático |
| Tarefa não executa | Rode `.\scripts\scrape-on-logon.ps1` manualmente e leia o erro |
| 0 posts coletados | Perfil sem posts recentes, layout do LinkedIn alterado ou bloqueio — veja logs no terminal |
| `Defina SCRAPE_USERNAME` | Preencha `SCRAPE_USERNAME` no `.env` |

Debug visual do Chromium na coleta: `SCRAPE_HEADLESS=false` no `.env`.

---

## Desativar a automação

No **Agendador de Tarefas**, desabilite ou exclua **LinkedIn Posts - Coleta no logon**.  
`yarn scrape` e `yarn auth:login` continuam disponíveis.

---

## Próximo passo

→ [integracao-site.md](integracao-site.md) — exibir os posts no seu site.
