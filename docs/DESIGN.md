# DESIGN

> **Para que serve:** tokens, tipografia e padrões de UI
> **Fonte da verdade:** CSS variables / theme do front
> **Relacionados:** [frontend](frontend.md) · [especificacao](especificacao.md)

Última atualização: 2026-11-03.

## Direção

| Requisito | Notas |
|-----------|--------|
| Node.js **≥ 22** | [nvm](https://github.com/nvm-sh/nvm) / [nvm-windows](https://github.com/coreybutler/nvm-windows) |
| Yarn | `npm i -g yarn` |
| Conta Supabase | Plano free basta |
| Windows (automação no logon) | Agendador de Tarefas; em outros SO use `yarn scrape` / cron manual |
| Conta LinkedIn secundária | Para o login do Playwright |

---

## Tokens

| Token | Papel |
|---|---|
| `--background` / `--foreground` | Superfície e texto |
| `--primary` | Ação principal |
