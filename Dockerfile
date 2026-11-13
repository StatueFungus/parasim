# syntax=docker/dockerfile:1

# ---- Build: erzeugt dist/ (keine npm-Abhängigkeiten nötig) ----
FROM node:22-alpine AS build
WORKDIR /app
ARG APP_VERSION=""
ARG GIT_SHA="unknown"
ENV APP_VERSION=${APP_VERSION} GIT_SHA=${GIT_SHA}
COPY package.json ./
COPY scripts/page.mjs scripts/build.mjs ./scripts/
COPY src ./src
RUN node scripts/build.mjs

# ---- Laufzeit: nginx ohne root, Port 8080 ----
FROM nginxinc/nginx-unprivileged:1.27-alpine
ARG APP_VERSION=""
ARG GIT_SHA="unknown"
LABEL org.opencontainers.image.title="ParaSim" \
      org.opencontainers.image.description="Streckenflug-Simulator für Gleitschirmpiloten im Browser" \
      org.opencontainers.image.licenses="MPL-2.0" \
      org.opencontainers.image.source="https://github.com/StatueFungus/parasim" \
      org.opencontainers.image.version="${APP_VERSION}" \
      org.opencontainers.image.revision="${GIT_SHA}"
COPY deploy/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY deploy/nginx/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/dist /usr/share/nginx/html
USER 101
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/healthz >/dev/null || exit 1
