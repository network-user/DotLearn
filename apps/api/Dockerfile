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
RUN pnpm prune --prod

FROM node:20-alpine AS runtime

WORKDIR /app

RUN corepack enable && addgroup -S dotlearn && adduser -S dotlearn -G dotlearn

COPY --from=build /workspace/apps/api/dist ./dist
COPY --from=build /workspace/apps/api/package.json ./package.json
COPY --from=build /workspace/apps/api/node_modules ./node_modules
COPY --from=build /workspace/packages ./packages
COPY --from=build /workspace/node_modules ./root_node_modules
RUN cp -r /app/root_node_modules/. /app/node_modules/ && rm -rf /app/root_node_modules

RUN mkdir -p /app/data && chown -R dotlearn:dotlearn /app

USER dotlearn

ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/app/data

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3000/',()=>process.exit(0)).on('error',()=>process.exit(1))"

CMD ["node", "dist/main.js"]
