#!/usr/bin/env bash
#
# Gestão Esportiva — sobe o ambiente completo, no macOS e no Linux.
#
#   chmod +x iniciar.sh   (uma vez)
#   ./iniciar.sh
#
# É o par do `iniciar.bat`, e tem o mesmo tamanho pelo mesmo motivo: a preparação
# inteira mora em `scripts/bootstrap.mjs`, que roda nos três sistemas. Aqui fica
# só o que é específico daqui — ligar o Docker Desktop no macOS, e abrir o
# navegador na hora certa.
#
set -euo pipefail
cd "$(dirname "$0")"

echo
echo "  ============================================"
echo "   Gestao Esportiva"
echo "  ============================================"
echo

# ------------------------------------------------------------------ 1. pnpm
# O bootstrap confere Node, Docker e o resto. O pnpm é a exceção: é ele quem
# roda o bootstrap, então precisa existir antes.
if ! command -v pnpm >/dev/null 2>&1; then
  echo "  [i] pnpm nao encontrado. Ativando pelo corepack..."
  corepack enable pnpm || {
    echo "  [X] Nao foi possivel ativar o pnpm."
    echo "      Instale com: npm install -g pnpm"
    exit 1
  }
fi

# ---------------------------------------------------------------- 2. Docker
# O bootstrap recusa rodar com o Docker parado, e faz certo: ele não tem como
# adivinhar como se liga o Docker em cada sistema. Aqui nós sabemos.
if ! docker info >/dev/null 2>&1; then
  if [[ "$(uname -s)" == "Darwin" ]]; then
    echo "  [i] Docker parado. Iniciando o Docker Desktop..."
    open -a Docker || {
      echo "  [X] Docker Desktop nao encontrado."
      echo "      Abra-o a mao e rode este script de novo."
      exit 1
    }
  else
    echo "  [i] Docker parado. Tentando subir o servico..."
    sudo systemctl start docker || {
      echo "  [X] Nao foi possivel subir o Docker."
      echo "      Suba a mao e rode este script de novo."
      exit 1
    }
  fi

  # O Docker demora para responder mesmo depois de a janela aparecer. Esperar o
  # `docker info` é o único jeito confiável de saber que está pronto.
  for _ in $(seq 1 60); do
    sleep 3
    if docker info >/dev/null 2>&1; then break; fi
  done

  if ! docker info >/dev/null 2>&1; then
    echo "  [X] O Docker nao respondeu em 3 minutos."
    exit 1
  fi
fi

# ------------------------------------------------------------- 3. O ambiente
# Aqui está tudo: .env, dependências, banco, espera, build, migrations e seed.
# Mesmo código que o `iniciar.bat` chama no Windows.
pnpm bootstrap

# -------------------------------------------------------------- 4. Navegador
# Abre sozinho quando a web responder, num processo à parte. Abrir junto com o
# servidor mostraria uma página de erro nos primeiros segundos.
(
  for _ in $(seq 1 90); do
    if curl -fsS -o /dev/null --max-time 2 http://localhost:3000; then
      if command -v xdg-open >/dev/null 2>&1; then xdg-open http://localhost:3000
      elif command -v open >/dev/null 2>&1; then open http://localhost:3000
      fi
      break
    fi
    sleep 2
  done
) >/dev/null 2>&1 &

echo
echo "  ============================================"
echo "   Ligando API e web"
echo "  ============================================"
echo
echo "   O navegador abre sozinho em alguns segundos."
echo "   Para parar tudo: Ctrl+C aqui, depois 'pnpm db:down'."
echo

pnpm dev
