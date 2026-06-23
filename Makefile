# DotLearn ops shortcuts (server-side). See docs/SELF_HOSTING.md.
SHELL := /bin/bash
DATA_DIR := $(shell sed -n 's/^DATA_DIR=//p' .env 2>/dev/null | head -n1)
DATA_DIR := $(if $(DATA_DIR),$(DATA_DIR),/var/lib/dotlearn/data)
STAMP := $(shell date +%F-%H%M%S)

.PHONY: help deploy update restart status logs logs-web backup restore

help:
	@echo "make deploy   - install / redeploy everything (interactive on first run)"
	@echo "make update   - git pull, then redeploy"
	@echo "make restart  - restart API + Caddy"
	@echo "make status   - service status"
	@echo "make logs     - follow API logs"
	@echo "make logs-web - follow Caddy logs"
	@echo "make backup   - snapshot the data dir to ./backups"
	@echo "make restore FILE=backups/x.tar.gz - restore a snapshot"

deploy:
	sudo bash scripts/deploy.sh

update:
	git pull --ff-only
	sudo bash scripts/deploy.sh

restart:
	sudo systemctl restart dotlearn-api caddy

status:
	systemctl status dotlearn-api --no-pager || true
	systemctl status caddy --no-pager || true

logs:
	journalctl -u dotlearn-api -f

logs-web:
	journalctl -u caddy -f

backup:
	mkdir -p backups
	sudo tar czf backups/dotlearn-data-$(STAMP).tar.gz -C "$(DATA_DIR)" .
	@echo "→ backups/dotlearn-data-$(STAMP).tar.gz"

restore:
	@test -n "$(FILE)" || { echo "Usage: make restore FILE=backups/....tar.gz"; exit 1; }
	sudo systemctl stop dotlearn-api
	sudo tar xzf "$(FILE)" -C "$(DATA_DIR)"
	sudo chown -R dotlearn:dotlearn "$(DATA_DIR)"
	sudo systemctl start dotlearn-api
	@echo "restored from $(FILE)"
