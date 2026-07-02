#!/usr/bin/env bash
# =============================================================================
# DotLearn: обновление контейнерного деплоя за общим фронт-Caddy (стек DotSound).
# git pull -> пересборка образов web+api -> перезапуск -> чистка dangling.
# Штатный scripts/deploy.sh (bare-metal, свой Caddy) тут НЕ используется -
# DotLearn живёт контейнерами в docker-сети dotsound, TLS даёт фронт-Caddy.
#
# Запуск:  sudo bash deploy/update.sh
# =============================================================================
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
	echo "Нужны root-права, перезапускаю через sudo..."
	exec sudo -E bash "$0" "$@"
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
# Имя внешней сети DotSound (проверь: docker network ls | grep dotsound).
export DOTSOUND_NETWORK="${DOTSOUND_NETWORK:-dotsoundbackend_dotsound}"

cd "$REPO_DIR"

if [ -d .git ]; then
	echo "==> git pull..."
	git pull --ff-only || echo "  (pull пропущен: нет апстрима или есть локальные правки)"
fi

echo "==> Пересборка и перезапуск контейнеров (web + api)..."
docker compose up -d --build

echo "==> Чистка висячих образов..."
docker image prune -f >/dev/null 2>&1 || true

echo "Готово. dotlearn-web / api обновлены. Свободно: $(df -h / | awk 'NR==2{print $4}')"
