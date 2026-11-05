# Histórico de mudanças

> **Para que serve:** registro datado de mudanças notáveis — não é estado atual
> **Fonte da verdade:** o que entrou/saiu do produto em cada data
> **Relacionados:** [context](context.md) · [especificacao](especificacao.md) · [CHANGELOG](../CHANGELOG.md)

Use `CHANGELOG.md` na raiz para releases Keep a Changelog. Este arquivo guarda o detalhe por data.

## 2026-11-04

### Gate `cache_stale` e URLs SDUI (issue #11)

- Coleta falha se `max(publicado_em)` do lote for mais velho que `SCRAPE_STALE_AFTER_DAYS` (default 8).
- Enriquecimento de URL SDUI mais resiliente (clipboard + fallback); short links `lnkd.in` aceitos.

## 2026-11-03

### Living docs (board#7)

- Conjunto canônico de 12 documentos em `docs/` alinhado ao padrão forge.
- Arquivos de comunidade e README vendável.

## Extraído do CHANGELOG

# Changelog

Todas as mudanças notáveis deste projeto serão documentadas neste arquivo.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/)
e este projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [Unreleased]

### Adicionado

- Living docs (hub `docs/context.md`), arquivos de comunidade e README no padrão board#7.
- Gate `cache_stale` (`SCRAPE_STALE_AFTER_DAYS`) e aceitação de short links `lnkd.in` (issue #11).
