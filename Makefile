# Vesta backend - local environment. Run from the repo root.
#   make env    copies app/.env.local.example -> app/.env.local (if missing)
#   make up     starts Postgres + Redis (docker compose)
#   make db     applies migrations and seeds to the local database
#   make dev    starts the API in watch mode reading app/.env.local
#   make smoke  runs the smoke flow against http://localhost:3000
#   make db-reset drops and recreates the LOCAL database, then reseeds (only reads app/.env.local)
#   make down   stops the containers
.PHONY: env up down db db-reset dev smoke logs

APP := app

env:
	@test -f $(APP)/.env.local || (cp $(APP)/.env.local.example $(APP)/.env.local && echo "created $(APP)/.env.local")
	@test -f $(APP)/.env.test || (cp $(APP)/.env.test.example $(APP)/.env.test && echo "created $(APP)/.env.test")

up:
	cd $(APP) && docker compose up -d --wait

down:
	cd $(APP) && docker compose down

logs:
	cd $(APP) && docker compose logs -f

db: env
	cd $(APP) && yarn prisma:gen && yarn db:local

db-reset: env
	cd $(APP) && yarn db:reset:local

dev: env
	cd $(APP) && yarn start:local

smoke:
	cd $(APP) && yarn smoke
