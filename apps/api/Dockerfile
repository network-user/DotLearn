FROM node:20-alpine AS build

WORKDIR /workspace

RUN corepack enable

# .npmrc обязателен для корректной раскладки pnpm (public-hoist-pattern),
# как и в apps/web/Dockerfile - иначе install в контейнере отличается от локального.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json .npmrc ./
COPY turbo.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/api ./apps/api

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @dotlearn/contracts build
RUN pnpm --filter @dotlearn/api build

# pnpm deploy собирает изолированный prod-деплой с ПЛОСКИМ node_modules. Прежний
# способ (COPY apps/api/node_modules + cp) переносил pnpm-симлинки на workspace
# store в другую глубину пути, относительные ссылки ломались -> рантайм падал с
# "Cannot find module @nestjs/common". deploy инжектит и workspace-зависимость
# @dotlearn/contracts как реальные файлы.
RUN pnpm --filter=@dotlearn/api deploy --prod /output

FROM node:20-alpine AS runtime

WORKDIR /app

RUN addgroup -S dotlearn && adduser -S dotlearn -G dotlearn

# /output от pnpm deploy уже содержит dist/, package.json и плоский node_modules.
COPY --from=build /output ./

RUN mkdir -p /app/data && chown -R dotlearn:dotlearn /app

USER dotlearn

ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/app/data

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3000/api/health',(r)=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "dist/main.js"]
