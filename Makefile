.PHONY: up down logs migrate seed reset test e2e lint typecheck

up:
	docker compose up -d --build

down:
	docker compose down

logs:
	docker compose logs -f app

migrate:
	docker compose exec app node_modules/.bin/prisma migrate deploy

seed:
	docker compose exec app node_modules/.bin/tsx prisma/seed.ts

# Removes containers AND data volumes (database, files).
reset:
	docker compose down -v

lint:
	pnpm lint

typecheck:
	pnpm typecheck

test:
	pnpm test

e2e:
	pnpm test:e2e
