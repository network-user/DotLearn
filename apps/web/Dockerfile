FROM node:22-alpine AS build

WORKDIR /workspace

RUN corepack enable

ARG VITE_API_BASE
ARG VITE_ADMIN_PATH
ARG VITE_GITHUB_URL
ARG VITE_UMAMI_WEBSITE_ID
ARG VITE_UMAMI_SRC

ENV VITE_API_BASE=$VITE_API_BASE
ENV VITE_ADMIN_PATH=$VITE_ADMIN_PATH
ENV VITE_GITHUB_URL=$VITE_GITHUB_URL
ENV VITE_UMAMI_WEBSITE_ID=$VITE_UMAMI_WEBSITE_ID
ENV VITE_UMAMI_SRC=$VITE_UMAMI_SRC

# .npmrc обязателен: public-hoist-pattern[]=@mdx-js/* поднимает @mdx-js/react в
# корневой node_modules, иначе MDX-файлы из /interview и /topics (вне apps/web)
# не резолвят его при сборке и vite build падает.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json .npmrc ./
COPY turbo.json tsconfig.base.json ./
COPY packages ./packages
COPY topics ./topics
COPY interview ./interview
COPY apps/web ./apps/web

RUN pnpm install --frozen-lockfile

# pyodide npm-пакет вендорит только core-рантайм; extra-пакеты (sqlite3) unvendored.
# `pnpm --filter @dotlearn/web build` ниже сам докачивает их с CDN pyodide через
# prebuild-хук (apps/web/scripts/fetch-pyodide-extra-packages.mjs, sha256 сверяется
# с pyodide-lock.json) - тот же скрипт гоняет CI и локальная разработка, так что
# фикс не может разойтись между окружениями, как это уже случалось однажды.

RUN pnpm --filter @dotlearn/contracts build
RUN pnpm --filter @dotlearn/sandbox build
RUN pnpm --filter @dotlearn/lesson-engine build

# Растущий interview-контент (тысячи MDX -> ~9000 модулей) раздувает vite build
# и падает с OOM (FATAL: heap limit, exit 134), пик - на этапе computing gzip size.
# Поднимаем heap Node; на GitHub-раннере 16GB RAM, 8GB heap влезает. Плюс в
# vite.config отключён reportCompressedSize (тот самый пик памяти).
ENV NODE_OPTIONS=--max-old-space-size=8192
RUN pnpm --filter @dotlearn/web build

# Unprivileged nginx: runs as the non-root `nginx` user and listens on 8080.
# Pin the minor line (like node:22-alpine / elasticsearch:8.13.4) for reproducible builds.
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime

COPY --from=build /workspace/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY apps/web/security-headers.conf /etc/nginx/security-headers.conf

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
