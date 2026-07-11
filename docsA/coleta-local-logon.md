# Coleta local no logon do Windows

O fluxo principal deste projeto é local: o Windows verifica a sessão do LinkedIn quando você entra no PC.

- Sessão válida: a tarefa encerra sem abrir janela e sem coletar nada.
- Sessão expirada, bloqueada ou ausente: o navegador abre o LinkedIn para login manual. Depois de chegar ao feed, a coleta de `rafael-vieira1720` é executada e o cache é atualizado no Supabase.

> O LinkedIn pode aplicar CAPTCHA, 2FA ou outros desafios. O processo não tenta preencher credenciais nem contornar esses mecanismos.

## Preparação

```powershell
yarn install
yarn playwright install chromium
Copy-Item .env.example .env
```

Configure em `.env` as credenciais do Supabase e mantenha:

```env
SESSION_STORAGE_PROVIDER=local
SESSION_LOCAL_PATH=storage/session.json
SCRAPE_USERNAME=rafael-vieira1720
```

Cadastre o perfil uma vez, caso ainda não exista:

```powershell
curl.exe -X POST http://localhost:3333/profiles `
  -H "x-api-key: SUA_API_KEY" `
  -H "content-type: application/json" `
  -d "{\"username\":\"rafael-vieira1720\"}"
```

## Registrar a tarefa

Abra o PowerShell no diretório do repositório e execute:

```powershell
.\scripts\register-scrape-on-logon-task.ps1
```

A tarefa `LinkedIn Posts - Coleta no logon` será registrada para o usuário atual, com gatilho `At logon`. O script usa o caminho do próprio repositório, portanto continua funcionando caso a tarefa seja executada pelo Agendador de Tarefas.

## Execução e testes

```powershell
# Simula o fluxo do logon.
yarn scrape:on-logon

# Verifica apenas o estado da sessão.
yarn scrape:on-logon --dry-run

# Abre login e coleta mesmo com a sessão válida.
yarn scrape:on-logon --force

# Atualização manual após publicar um post.
yarn scrape rafael-vieira1720
```

Para testar a janela de login, remova temporariamente `storage/session.json` ou execute o comando após a sessão expirar. Nunca versione esse arquivo.

## Solução de problemas

- **Yarn não encontrado:** abra o Agendador de Tarefas e confirme que o Node.js/Yarn está disponível no `PATH` do usuário. O script falha com mensagem explícita se não estiver.
- **Perfil não cadastrado:** cadastre `rafael-vieira1720` antes de registrar a tarefa.
- **CAPTCHA ou checkpoint:** conclua o desafio na janela do LinkedIn e entre novamente até o feed.
- **Tarefa não inicia:** execute `.\scripts\scrape-on-logon.ps1` manualmente no PowerShell para ver o erro e valide o caminho do repositório no Agendador.

## Remover a automação

Desabilite ou exclua a tarefa `LinkedIn Posts - Coleta no logon` no Agendador de Tarefas do Windows. A coleta manual com `yarn scrape` continua disponível.
