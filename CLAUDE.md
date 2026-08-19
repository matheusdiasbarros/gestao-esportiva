# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Estado atual do repositório

Este repositório foi criado em 2026-08-19 e ainda **não contém código de aplicação**. Os únicos arquivos versionados são `README.md` e `.gitignore`. Não existem build, lint, testes ou stack definida.

Projeto: **Gestão Esportiva** — sistema de gestão esportiva (README.md).

## Convenções observadas

- Documentação, README e mensagens de commit em **português**.
- Branch principal: `main`, rastreando `origin/main` (https://github.com/matheusdiasbarros/gestao-esportiva.git).
- Mensagens de commit no formato Conventional Commits (`chore: inicializa repositório`).
- O `.gitignore` inicial cobre Node (`node_modules/`, `dist/`), PHP (`vendor/`) e Python (`__pycache__/`, `.venv/`) — a stack ainda não foi escolhida, então nenhum desses padrões indica a tecnologia adotada.

## Ao adicionar a primeira stack

Quando o projeto ganhar código, **substitua esta seção** por informação concreta e verificada:

- Comandos de build, lint, execução local e testes (incluindo como rodar um único teste).
- Arquitetura de alto nível: camadas, fronteiras entre módulos e fluxos que exigem ler vários arquivos para entender.
- Enxugue o `.gitignore` para a stack realmente usada.

Não descreva aqui estrutura de arquivos ou componentes que possam ser descobertos com `ls`/`grep`.
