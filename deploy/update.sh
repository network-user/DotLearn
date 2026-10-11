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
	if ! git pull --ff-only; then
		echo "Ошибка: git pull --ff-only не смог обновить репозиторий (см. вывод выше)." >&2
		echo "  Обычно значит - на сервере есть локальные правки поверх origin/main." >&2
		echo "  Разберись (git status / git diff в $REPO_DIR), иначе автодеплой будет" >&2
		echo "  молча перезапускать контейнеры на СТАРОМ compose-конфиге." >&2
		exit 1
	fi
fi

# GHCR_OWNER и прочее берутся из .env (docker compose читает его автоматически).
if ! grep -q '^GHCR_OWNER=' .env 2>/dev/null; then
	echo "Ошибка: в .env не задан GHCR_OWNER (GitHub-логин в нижнем регистре)." >&2
	echo "  Добавь строку:  GHCR_OWNER=твой-логин" >&2
	exit 1
fi

# Тянем отдельным docker-конфигом. В /root/.docker остаётся credsStore или
# протухший PAT: logout его не вычищает, и ghcr на публичный образ отвечает
# 403 denied. pull_policy: always есть и у up, поэтому тот же конфиг нужен
# на оба вызова. GHCR_TOKEN (GITHUB_TOKEN из CI) кладётся только сюда и
# вместе с каталогом удаляется.
pull_docker_config="$(mktemp -d)"
trap 'rm -rf "$pull_docker_config"' EXIT
for plugins in \
	/usr/libexec/docker/cli-plugins \
	/usr/lib/docker/cli-plugins \
	/usr/local/lib/docker/cli-plugins \
	"${HOME:-/root}/.docker/cli-plugins"; do
	if [ -d "$plugins" ]; then
		ln -s "$plugins" "$pull_docker_config/cli-plugins"
		break
	fi
done
if [ -n "${GHCR_TOKEN:-}" ]; then
	if [ -z "${GHCR_USER:-}" ]; then
		echo "Ошибка: задан GHCR_TOKEN, но нет GHCR_USER." >&2
		exit 1
	fi
	echo "==> Логин в ghcr.io временным токеном..."
	printf '%s' "$GHCR_TOKEN" | DOCKER_CONFIG="$pull_docker_config" docker login ghcr.io -u "$GHCR_USER" --password-stdin
	unset GHCR_TOKEN
fi
export DOCKER_CONFIG="$pull_docker_config"

echo "==> Тяну свежие образы из ghcr.io..."
"${COMPOSE[@]}" pull

echo "==> Перезапуск контейнеров на новых образах (без сборки)..."
"${COMPOSE[@]}" up -d --no-build

echo "==> Чистка висячих образов..."
docker image prune -f >/dev/null 2>&1 || true

echo "Готово. dotlearn-web / api обновлены из ghcr. Свободно: $(df -h / | awk 'NR==2{print $4}')"
