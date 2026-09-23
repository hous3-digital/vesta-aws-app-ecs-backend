# Vesta backend - local environment. Run from the repo root.
#   make env    copies app/.env.local.example -> app/.env.local (if missing)
#   make up     starts Postgres + Redis (docker compose)
#   make db     applies migrations and seeds to the local database
#   make dev    starts the API in watch mode reading app/.env.local
#   make smoke  runs the smoke flow against http://localhost:3000
#   make down   stops the containers
.PHONY: env up down db dev smoke logs

APP := app

env:
	@test -f $(APP)/.env.local || (cp $(APP)/.env.local.example $(APP)/.env.local && echo "created $(APP)/.env.local")

up:
	cd $(APP) && docker compose up -d --wait

down:
	cd $(APP) && docker compose down

logs:
	cd $(APP) && docker compose logs -f

db: env
	cd $(APP) && yarn prisma:gen && yarn db:local

dev: env
	cd $(APP) && yarn start:local

smoke:
	cd $(APP) && yarn smoke
