#!/usr/bin/env bash
#
# DotLearn one-command deploy for a fresh Debian/Ubuntu server.
#
#   sudo ./scripts/deploy.sh
#
# Idempotent: the first run installs everything and asks for domain/email/
# admin password; later runs rebuild and restart without re-prompting.
# Docker is not used — the API runs under systemd and Caddy serves the
# static site with automatic HTTPS.
#
set -euo pipefail

# ── Paths and constants ────────────────────────────────────────
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

ENV_FILE="$REPO_DIR/.env"
SERVICE_USER="dotlearn"
API_RUNTIME="/opt/dotlearn/api"
WEB_ROOT="/var/www/dotlearn"
DEFAULT_DATA_DIR="/var/lib/dotlearn/data"
NODE_MAJOR=20

# ── Output helpers ─────────────────────────────────────────────
c_cyan='\033[1;36m'; c_green='\033[1;32m'; c_red='\033[1;31m'; c_yellow='\033[1;33m'; c_reset='\033[0m'
log()  { printf "\n${c_cyan}▸ %s${c_reset}\n" "$*"; }
ok()   { printf "${c_green}✓ %s${c_reset}\n" "$*"; }
warn() { printf "${c_yellow}! %s${c_reset}\n" "$*"; }
die()  { printf "${c_red}✗ %s${c_reset}\n" "$*" >&2; exit 1; }

[ "$(id -u)" = 0 ] || die "Run with sudo: sudo ./scripts/deploy.sh"
command -v apt-get >/dev/null 2>&1 || die "This script targets Debian/Ubuntu (apt-get). For other distros see docs/SELF_HOSTING.md."

# ── .env helpers (value-safe: never run user values through sed) ─
env_get() { sed -n "s/^$1=//p" "$ENV_FILE" 2>/dev/null | head -n1; }
env_set() {
  local key="$1" val="$2"
  [ -f "$ENV_FILE" ] || : > "$ENV_FILE"
  grep -v "^${key}=" "$ENV_FILE" > "$ENV_FILE.tmp" 2>/dev/null || true
  mv "$ENV_FILE.tmp" "$ENV_FILE"
  printf '%s=%s\n' "$key" "$val" >> "$ENV_FILE"
}
is_unset() { local v; v="$(env_get "$1")"; [ -z "$v" ] || [ "$v" = "example.com" ] || [ "$v" = "you@example.com" ] || [ "$v" = "https://example.com" ]; }

# ───────────────────────────────────────────────────────────────
log "1/9  System packages (Node ${NODE_MAJOR}, pnpm, Caddy)"

node_ok=0
if command -v node >/dev/null 2>&1; then
  cur="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
  if [ "$cur" -ge "$NODE_MAJOR" ]; then node_ok=1; fi
fi
if [ "$node_ok" = 0 ]; then
  log "Installing Node.js ${NODE_MAJOR}.x (NodeSource)"
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y nodejs
fi
ok "node $(node -v)"

corepack enable >/dev/null 2>&1 || npm install -g corepack >/dev/null 2>&1
corepack prepare pnpm@9 --activate >/dev/null 2>&1 || true
command -v pnpm >/dev/null 2>&1 || die "pnpm not available after corepack enable"
ok "pnpm $(pnpm -v)"

if ! command -v caddy >/dev/null 2>&1; then
  log "Installing Caddy (official apt repo)"
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl gnupg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update
  apt-get install -y caddy
fi
ok "caddy $(caddy version | head -n1)"

# ───────────────────────────────────────────────────────────────
log "2/9  Service user and directories"
id -u "$SERVICE_USER" >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin "$SERVICE_USER"
ok "user '$SERVICE_USER'"

# ───────────────────────────────────────────────────────────────
log "3/9  Configuration (.env)"
if [ ! -f "$ENV_FILE" ]; then
  cp "$REPO_DIR/.env.example" "$ENV_FILE"
  ok "created .env from template"
fi
chmod 600 "$ENV_FILE"

ask() {
  local key="$1" prompt="$2" def="$3" ans=""
  read -r -p "$prompt${def:+ ($def)}: " ans </dev/tty || true
  ans="${ans:-$def}"
  if [ -n "$ans" ]; then env_set "$key" "$ans"; fi
}

if is_unset DOMAIN;     then ask DOMAIN "Domain (e.g. learn.example.com)" ""; fi
if is_unset ACME_EMAIL; then ask ACME_EMAIL "Email for Let's Encrypt" ""; fi

DOMAIN="$(env_get DOMAIN)"
[ -n "$DOMAIN" ] && [ "$DOMAIN" != "example.com" ] || die "DOMAIN is required"
ACME_EMAIL="$(env_get ACME_EMAIL)"

# Derive same-origin values from the domain (deterministic, overwrite).
env_set VITE_API_BASE "https://$DOMAIN"
env_set WEB_ORIGIN    "https://$DOMAIN"
env_set NODE_ENV      "production"
env_set HOST          "127.0.0.1"
env_set TRUSTED_PROXY_HOPS "1"
[ -n "$(env_get DATA_DIR)" ] || env_set DATA_DIR "$DEFAULT_DATA_DIR"
if [ "$(env_get DATA_DIR)" = "/app/data" ]; then env_set DATA_DIR "$DEFAULT_DATA_DIR"; fi
[ -n "$(env_get ADMIN_LOGIN)" ] || env_set ADMIN_LOGIN "admin"
[ -n "$(env_get PORT)" ] || env_set PORT "3000"

PORT="$(env_get PORT)"
DATA_DIR="$(env_get DATA_DIR)"
VITE_ADMIN_PATH="$(env_get VITE_ADMIN_PATH)"; [ -n "$VITE_ADMIN_PATH" ] || { VITE_ADMIN_PATH="/admin"; env_set VITE_ADMIN_PATH "$VITE_ADMIN_PATH"; }
ok "domain $DOMAIN · data $DATA_DIR · admin path $VITE_ADMIN_PATH"

# ───────────────────────────────────────────────────────────────
log "4/9  Install workspace dependencies"
pnpm install --frozen-lockfile

# ───────────────────────────────────────────────────────────────
log "5/9  Admin secrets"
if [ -z "$(env_get ADMIN_PASSWORD_HASH)" ] || [ -z "$(env_get ADMIN_JWT_SECRET)" ]; then
  pw=""; pw2="x"
  while [ "$pw" != "$pw2" ] || [ "${#pw}" -lt 8 ]; do
    read -r -s -p "Admin password (min 8 chars): " pw </dev/tty; echo
    read -r -s -p "Repeat password: " pw2 </dev/tty; echo
    [ "$pw" = "$pw2" ] || warn "passwords differ, try again"
    [ "${#pw}" -ge 8 ] || warn "too short, try again"
  done
  login="$(env_get ADMIN_LOGIN)"
  secrets="$(cd "$REPO_DIR/apps/api" && ADMIN_LOGIN="$login" node scripts/gen-admin-secrets.mjs "$pw")"
  for k in ADMIN_PASSWORD_HASH ADMIN_TOTP_SECRET ADMIN_BACKUP_CODES_HASHED ADMIN_JWT_SECRET ADMIN_REFRESH_SECRET; do
    grep -v "^${k}=" "$ENV_FILE" > "$ENV_FILE.tmp" && mv "$ENV_FILE.tmp" "$ENV_FILE"
  done
  printf '%s\n' "$secrets" >> "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  ok "secrets written (QR + backup codes shown above — save them now)"
else
  ok "admin secrets already present — keeping them"
fi

# ───────────────────────────────────────────────────────────────
log "6/9  Build (frontend + API)"
# Force a clean, deterministic build: nest's deleteOutDir + tsc incremental
# cache can otherwise emit a partial dist on re-runs.
find "$REPO_DIR" -name '*.tsbuildinfo' -not -path '*/node_modules/*' -delete 2>/dev/null || true
rm -rf "$REPO_DIR"/apps/*/dist "$REPO_DIR"/packages/*/dist
export NODE_ENV=production
export VITE_API_BASE="https://$DOMAIN"
export VITE_ADMIN_PATH="$VITE_ADMIN_PATH"
pnpm --filter @dotlearn/contracts build
pnpm --filter @dotlearn/sandbox build
pnpm --filter @dotlearn/lesson-engine build
pnpm --filter @dotlearn/web build
pnpm --filter @dotlearn/api build
ok "build complete"

# ───────────────────────────────────────────────────────────────
log "7/9  Assemble runtime artifacts"
rm -rf "$API_RUNTIME"
mkdir -p "$(dirname "$API_RUNTIME")"
pnpm --filter @dotlearn/api deploy --prod "$API_RUNTIME"
chown -R "$SERVICE_USER:$SERVICE_USER" "$API_RUNTIME"

rm -rf "$WEB_ROOT"
mkdir -p "$WEB_ROOT"
cp -r "$REPO_DIR/apps/web/dist/." "$WEB_ROOT/"
chown -R caddy:caddy "$WEB_ROOT"

mkdir -p "$DATA_DIR"
chown -R "$SERVICE_USER:$SERVICE_USER" "$DATA_DIR"
ok "api → $API_RUNTIME · web → $WEB_ROOT · data → $DATA_DIR"

# ───────────────────────────────────────────────────────────────
log "8/9  systemd (API) + Caddy (HTTPS)"
NODE_BIN="$(command -v node)"
sed -e "s|__SERVICE_USER__|$SERVICE_USER|g" \
    -e "s|__API_RUNTIME__|$API_RUNTIME|g" \
    -e "s|__REPO_DIR__|$REPO_DIR|g" \
    -e "s|__NODE_BIN__|$NODE_BIN|g" \
    -e "s|__DATA_DIR__|$DATA_DIR|g" \
    "$REPO_DIR/deploy/dotlearn-api.service" > /etc/systemd/system/dotlearn-api.service

install -d -m 755 /etc/caddy
cp "$REPO_DIR/deploy/Caddyfile" /etc/caddy/Caddyfile
install -d -m 755 /etc/systemd/system/caddy.service.d
cat > /etc/systemd/system/caddy.service.d/dotlearn.conf <<EOF
[Service]
Environment=DOMAIN=$DOMAIN
Environment=ACME_EMAIL=$ACME_EMAIL
Environment=WEB_ROOT=$WEB_ROOT
Environment=API_UPSTREAM=127.0.0.1:$PORT
EOF

systemctl daemon-reload
systemctl enable --now dotlearn-api >/dev/null 2>&1 || systemctl restart dotlearn-api
systemctl restart dotlearn-api
systemctl enable caddy >/dev/null 2>&1 || true
systemctl restart caddy

if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -q "Status: active"; then
  ufw allow 80/tcp  >/dev/null 2>&1 || true
  ufw allow 443/tcp >/dev/null 2>&1 || true
  ok "ufw: opened 80/443"
fi

# ───────────────────────────────────────────────────────────────
log "9/9  Reclaim disk (drop build deps, keep runtime bundle)"
rm -rf "$REPO_DIR/node_modules" "$REPO_DIR"/apps/*/node_modules "$REPO_DIR"/packages/*/node_modules
pnpm store prune >/dev/null 2>&1 || true
ok "build dependencies removed; pnpm store pruned"

# ───────────────────────────────────────────────────────────────
sleep 2
api_state="$(systemctl is-active dotlearn-api 2>/dev/null || true)"
caddy_state="$(systemctl is-active caddy 2>/dev/null || true)"
printf "\n${c_green}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c_reset}\n"
ok "Deploy finished"
echo "  Site:        https://$DOMAIN"
echo "  Admin:       https://$DOMAIN$VITE_ADMIN_PATH"
echo "  API health:  systemctl status dotlearn-api  ($api_state)"
echo "  Caddy:       systemctl status caddy         ($caddy_state)"
echo
echo "  Logs:        journalctl -u dotlearn-api -f"
echo "               journalctl -u caddy -f"
echo
[ "$api_state" = active ] || warn "API is not active yet — check: journalctl -u dotlearn-api -n 50"
echo "  DNS: point an A/AAAA record for $DOMAIN at this server before the"
echo "  certificate can be issued (ports 80 and 443 must be reachable)."
printf "${c_green}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c_reset}\n"
