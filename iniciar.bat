@echo off
setlocal enabledelayedexpansion

REM ============================================================================
REM  Gestao Esportiva - sobe o ambiente completo para testar no navegador.
REM
REM  E so dar dois cliques. O script confere as ferramentas, sobe o banco,
REM  prepara o schema, popula os dados de exemplo, liga a API e a web, e abre o
REM  navegador quando estiver pronto.
REM
REM  Cada passo depende do anterior, entao qualquer falha interrompe e explica o
REM  que fazer. Seguir em frente produziria um erro adiante, longe da causa.
REM
REM  TRES DECISOES QUE PARECEM ESTRANHAS E NAO SAO. As tres viraram bug na
REM  primeira versao deste arquivo, e estao aqui para nao voltarem:
REM
REM  1. NENHUM CARACTERE ACENTUADO, E NENHUM "chcp". Mudar a pagina de codigo no
REM     meio de um .bat dessincroniza o leitor do cmd: ele passa a interpretar
REM     bytes no deslocamento errado e cai no meio de uma linha, tentando
REM     executar um pedaco de palavra. O sintoma foi "'M' nao e reconhecido como
REM     um comando", sem nenhuma relacao aparente com a causa.
REM
REM  2. As pausas usam "ping", nao "timeout". O timeout recusa rodar quando a
REM     entrada esta redirecionada - comum ao chamar o script de outro programa.
REM     Sem pausa, o laco de espera percorre todas as tentativas em
REM     milissegundos e conclui, errado, que o banco nao subiu.
REM
REM  3. Usa expansao atrasada (!VAR! no lugar de %VAR%). Dentro de um bloco
REM     entre parenteses o batch resolve %VAR% ao LER o bloco, antes de
REM     executar, e uma variavel definida ali dentro chega vazia na linha
REM     seguinte.
REM ============================================================================

cd /d "%~dp0"
title Gestao Esportiva - ambiente de desenvolvimento

echo.
echo  ============================================
echo   Gestao Esportiva
echo  ============================================
echo.

REM ---------------------------------------------------------------- 1. Node
where node >nul 2>&1
if errorlevel 1 (
  echo  [X] Node.js nao encontrado.
  echo      Instale a versao indicada no arquivo .nvmrc e rode este script de novo.
  goto :fim_com_erro
)

REM ---------------------------------------------------------------- 2. pnpm
where pnpm >nul 2>&1
if errorlevel 1 (
  echo  [i] pnpm nao encontrado. Ativando pelo corepack...
  call corepack enable pnpm
  if errorlevel 1 (
    echo  [X] Nao foi possivel ativar o pnpm.
    echo      Rode "corepack enable pnpm" num terminal como administrador.
    goto :fim_com_erro
  )
)

REM ---------------------------------------------------------------- 3. .env
if not exist ".env" (
  echo  [i] Arquivo .env nao existe. Criando a partir do .env.example...
  copy /y ".env.example" ".env" >nul
  echo.
  echo      ATENCAO: o .env foi criado com valores de exemplo.
  echo      Gere um JWT_SECRET proprio e, se for testar e-mail, preencha a
  echo      RESEND_API_KEY. Sem a chave o sistema funciona: a mensagem vai
  echo      para o log com o link dentro.
  echo.
)

REM ------------------------------------------------------------- 4. Docker
echo  [1/6] Conferindo o Docker...
docker info >nul 2>&1
if not errorlevel 1 goto :docker_pronto

echo        Docker parado. Iniciando o Docker Desktop...

set "DOCKER_EXE="
if exist "%LOCALAPPDATA%\Programs\DockerDesktop\Docker Desktop.exe" set "DOCKER_EXE=%LOCALAPPDATA%\Programs\DockerDesktop\Docker Desktop.exe"
if exist "%ProgramFiles%\Docker\Docker\Docker Desktop.exe" set "DOCKER_EXE=%ProgramFiles%\Docker\Docker\Docker Desktop.exe"

if not defined DOCKER_EXE (
  echo  [X] Docker Desktop nao encontrado nos lugares de costume.
  echo      Abra o Docker Desktop a mao e rode este script de novo.
  goto :fim_com_erro
)

start "" "!DOCKER_EXE!"

REM O Docker Desktop demora para responder mesmo depois de a janela aparecer.
REM Esperar o "docker info" e o unico jeito confiavel de saber que esta pronto.
for /l %%i in (1,1,60) do (
  call :dormir 3
  docker info >nul 2>&1
  if not errorlevel 1 goto :docker_pronto
)

echo  [X] O Docker nao respondeu em 3 minutos.
echo      Verifique se ele terminou de iniciar e rode este script de novo.
goto :fim_com_erro

:docker_pronto
echo        Docker respondendo.

REM -------------------------------------------------------- 5. Dependencias
if not exist "node_modules" (
  echo  [2/6] Instalando dependencias. Na primeira vez demora alguns minutos...
  call pnpm install
  if errorlevel 1 goto :fim_com_erro
) else (
  echo  [2/6] Dependencias ja instaladas.
)

REM ------------------------------------------------------ 6. Banco e cache
echo  [3/6] Subindo PostgreSQL e Redis...
call pnpm db:up
if errorlevel 1 goto :fim_com_erro

REM O container aceita conexao antes de o banco estar pronto para consultas.
REM Sem esta espera, a migration falha por corrida contra a inicializacao.
echo        Esperando o banco ficar pronto...
for /l %%i in (1,1,40) do (
  call :banco_saudavel && goto :banco_pronto
  call :dormir 3
)
echo  [X] O PostgreSQL nao ficou saudavel em 2 minutos.
echo      Veja o que ele diz com: docker compose logs postgres
goto :fim_com_erro

:banco_pronto
echo        Banco pronto.

REM --------------------------------------------------------------- 7. Build
REM O build vem ANTES das migrations: a CLI do TypeORM compila as entidades, e
REM elas importam @gestao/types, que so existe depois de gerado.
echo  [4/6] Compilando...
call pnpm build
if errorlevel 1 goto :fim_com_erro

REM ---------------------------------------------------------- 8. Migrations
echo  [5/6] Aplicando migrations e dados de exemplo...
call pnpm --filter @gestao/api migration:run
if errorlevel 1 goto :fim_com_erro

REM A seed e idempotente: rodar de novo nao duplica nada.
call pnpm --filter @gestao/api seed
if errorlevel 1 goto :fim_com_erro

REM ----------------------------------------------------------- 9. Navegador
REM Abre sozinho quando a web responder, num processo a parte. Abrir junto com
REM o servidor mostraria uma pagina de erro nos primeiros segundos.
start "" /min powershell -NoProfile -WindowStyle Hidden -Command "for($i=0;$i -lt 90;$i++){try{ if((Invoke-WebRequest -Uri 'http://localhost:3000' -UseBasicParsing -TimeoutSec 2).StatusCode -eq 200){ Start-Process 'http://localhost:3000'; break } }catch{ Start-Sleep -Seconds 2 }}"

echo.
echo  ============================================
echo   [6/6] Ligando API e web
echo  ============================================
echo.
echo   Site .............. http://localhost:3000
echo   API ............... http://localhost:3333/api/v1
echo   Documentacao API .. http://localhost:3333/api/v1/docs
echo.
echo   Contas de teste, senha "desenvolvimento1":
echo     rodrigo@exemplo.local ... professor, com link de captacao
echo     marina@exemplo.local .... aluna de dois professores
echo     beatriz@exemplo.local ... aluna sem professor
echo     carlos@exemplo.local .... responsavel por uma aluna menor
echo.
echo   O navegador abre sozinho em alguns segundos.
echo   Para parar tudo: Ctrl+C nesta janela, depois rode parar.bat
echo.

call pnpm dev

goto :fim

REM ------------------------------------------------------------ auxiliares

REM Sai com 0 quando o PostgreSQL reporta "healthy", com 1 caso contrario.
REM Separado em sub-rotina porque um "for /f" aninhado dentro do "for /l" da
REM espera confunde a expansao das variaveis de laco.
:banco_saudavel
for /f "delims=" %%s in ('docker inspect --format "{{.State.Health.Status}}" gestao-postgres 2^>nul') do (
  if "%%s"=="healthy" exit /b 0
)
exit /b 1

REM Pausa de N segundos que funciona mesmo com a entrada redirecionada, que e
REM justamente onde o "timeout" do Windows desiste. O ping espera N-1 vezes o
REM intervalo entre pacotes, por isso o +1.
:dormir
set /a _ESPERA=%1+1
ping -n !_ESPERA! 127.0.0.1 >nul 2>&1
exit /b 0

:fim_com_erro
echo.
echo  ============================================
echo   Nao foi possivel subir o ambiente.
echo  ============================================
echo.
pause
exit /b 1

:fim
endlocal
pause
