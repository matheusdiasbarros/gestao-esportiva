@echo off
setlocal enabledelayedexpansion

REM ============================================================================
REM  Gestao Esportiva - sobe o ambiente completo para testar no navegador.
REM
REM  E so dar dois cliques.
REM
REM  ESTE ARQUIVO FICOU CURTO EM 2026-08-29, E DE PROPOSITO. Ele repetia os sete
REM  passos do README - .env, dependencias, banco, espera, build, migrations,
REM  seed - e essa copia so servia ao Windows. Quem chegasse de Mac ou Linux
REM  voltava para os passos manuais, e as duas versoes divergiriam no dia em que
REM  um passo mudasse em uma so.
REM
REM  Agora a preparacao inteira mora em "scripts/bootstrap.mjs", que roda nos
REM  tres sistemas. Aqui ficou so o que e do Windows de verdade: ligar o Docker
REM  Desktop se ele estiver parado, e abrir o navegador na hora certa.
REM
REM  DUAS DECISOES QUE PARECEM ESTRANHAS E NAO SAO. As duas viraram bug na
REM  primeira versao deste arquivo, e estao aqui para nao voltarem:
REM
REM  1. NENHUM CARACTERE ACENTUADO, E NENHUM "chcp". Mudar a pagina de codigo no
REM     meio de um .bat dessincroniza o leitor do cmd: ele passa a interpretar
REM     bytes no deslocamento errado e cai no meio de uma linha, tentando
REM     executar um pedaco de palavra. O sintoma foi "'M' nao e reconhecido como
REM     um comando", sem nenhuma relacao aparente com a causa.
REM
REM  2. A pausa usa "ping", nao "timeout". O timeout recusa rodar quando a
REM     entrada esta redirecionada - comum ao chamar o script de outro programa.
REM     Sem pausa, o laco de espera percorre todas as tentativas em
REM     milissegundos e conclui, errado, que o Docker nao subiu.
REM ============================================================================

cd /d "%~dp0"
title Gestao Esportiva - ambiente de desenvolvimento

echo.
echo  ============================================
echo   Gestao Esportiva
echo  ============================================
echo.

REM ---------------------------------------------------------------- 1. pnpm
REM O bootstrap confere Node, Docker e o resto. O pnpm e a excecao: e ele quem
REM roda o bootstrap, entao precisa existir antes.
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

REM ------------------------------------------------------------- 2. Docker
REM O bootstrap recusa rodar com o Docker parado, e faz certo: ele nao tem como
REM saber onde o Docker Desktop foi instalado. No Windows nos sabemos, entao
REM tentamos ligar antes de chamar - e so aqui, porque no Linux o servico ja
REM sobe com a maquina e no Mac o caminho e outro.
docker info >nul 2>&1
if not errorlevel 1 goto :docker_pronto

echo  [i] Docker parado. Iniciando o Docker Desktop...

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

REM -------------------------------------------------------- 3. O ambiente
REM Aqui esta tudo: .env, dependencias, banco, espera, build, migrations e seed.
REM Mesmo codigo que um desenvolvedor de Mac ou Linux roda.
call pnpm bootstrap
if errorlevel 1 goto :fim_com_erro

REM ----------------------------------------------------------- 4. Navegador
REM Abre sozinho quando a web responder, num processo a parte. Abrir junto com
REM o servidor mostraria uma pagina de erro nos primeiros segundos.
start "" /min powershell -NoProfile -WindowStyle Hidden -Command "for($i=0;$i -lt 90;$i++){try{ if((Invoke-WebRequest -Uri 'http://localhost:3000' -UseBasicParsing -TimeoutSec 2).StatusCode -eq 200){ Start-Process 'http://localhost:3000'; break } }catch{ Start-Sleep -Seconds 2 }}"

echo.
echo  ============================================
echo   Ligando API e web
echo  ============================================
echo.
echo   O navegador abre sozinho em alguns segundos.
echo   Para parar tudo: Ctrl+C nesta janela, depois rode parar.bat
echo.

call pnpm dev

goto :fim

REM ------------------------------------------------------------ auxiliares

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
