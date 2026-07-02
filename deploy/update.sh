#!/usr/bin/env bash
# =============================================================================
# DotLearn: обновление контейнерного деплоя за общим фронт-Caddy (стек DotSound).
# Образы собирает GitHub Actions и публикует в ghcr.io - здесь их только ТЯНЕМ
# (docker compose pull) и перезапускаем. Сборки НА СЕРВЕРЕ нет: на 3.8GB боксе
# vite build уходит в своп на десятки минут, поэтому он вынесен на раннер CI.
#
# Штатный scripts/deploy.sh (bare-metal, свой Caddy) тут НЕ используется.
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
COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.prod.yml)

cd "$REPO_DIR"

if [ -d .git ]; then
	echo "==> git pull (конфиги/compose)..."
	git pull --ff-only || echo "  (pull пропущен: нет апстрима или есть локальные правки)"
fi

# GHCR_OWNER и прочее берутся из .env (docker compose читает его автоматически).
if ! grep -q '^GHCR_OWNER=' .env 2>/dev/null; then
	echo "Ошибка: в .env не задан GHCR_OWNER (GitHub-логин в нижнем регистре)." >&2
	echo "  Добавь строку:  GHCR_OWNER=твой-логин" >&2
	exit 1
fi

echo "==> Тяну свежие образы из ghcr.io..."
"${COMPOSE[@]}" pull

echo "==> Перезапуск контейнеров на новых образах (без сборки)..."
"${COMPOSE[@]}" up -d --no-build

echo "==> Чистка висячих образов..."
docker image prune -f >/dev/null 2>&1 || true

echo "Готово. dotlearn-web / api обновлены из ghcr. Свободно: $(df -h / | awk 'NR==2{print $4}')"
