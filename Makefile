IMAGE ?= parasim:dev

.PHONY: dev check build docker-build docker-run helm-lint helm-template

dev:            ## Entwicklungsserver auf http://localhost:8000
	npm start

check:          ## Lint, Tests, Build
	npm run check

build:
	npm run build

docker-build:   ## Container-Image bauen
	docker build --build-arg GIT_SHA=$$(git rev-parse --short HEAD) -t $(IMAGE) .

docker-run: docker-build   ## Container auf http://localhost:8080 starten
	docker run --rm -p 8080:8080 --read-only --tmpfs /tmp $(IMAGE)

helm-lint:
	helm lint --strict charts/parasim
	helm lint --strict charts/parasim -f deploy/helm/values-production.yaml

helm-template:
	helm template parasim charts/parasim -f deploy/helm/values-production.yaml
