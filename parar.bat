@echo off
setlocal

REM ============================================================================
REM  Gestao Esportiva - derruba o ambiente de desenvolvimento.
REM
REM  O Ctrl+C na janela do iniciar.bat para a API e a web, mas os containers do
REM  banco e do cache continuam rodando em segundo plano, consumindo memoria.
REM  Este script fecha os dois lados.
REM
REM  OS DADOS DO BANCO SAO PRESERVADOS. Para apagar tudo e comecar do zero o
REM  comando e outro: pnpm db:reset
REM
REM  Sem acento e sem "chcp", pelo mesmo motivo explicado no iniciar.bat.
REM ============================================================================

cd /d "%~dp0"
title Gestao Esportiva - parando

echo.
echo  Parando o ambiente...
echo.

REM ------------------------------------------------- 1. API, web e Expo
REM Encerra pela porta, e nao pelo nome do processo: matar "node" derrubaria
REM qualquer outro projeto Node aberto na maquina, o que seria uma surpresa
REM bem desagradavel no meio do trabalho.
for %%p in (3000 3333 8081) do (
  for /f "tokens=5" %%i in ('netstat -ano ^| findstr ":%%p " ^| findstr "LISTENING"') do (
    echo  Encerrando o processo da porta %%p...
    taskkill /F /PID %%i >nul 2>&1
  )
)

REM -------------------------------------------------- 2. Banco e cache
docker info >nul 2>&1
if errorlevel 1 (
  echo  Docker ja esta parado.
) else (
  echo  Derrubando PostgreSQL e Redis...
  call pnpm db:down
)

echo.
echo  Pronto. Os dados do banco continuam la.
echo  Para apagar tudo e recomecar limpo: pnpm db:reset
echo.

endlocal
pause
