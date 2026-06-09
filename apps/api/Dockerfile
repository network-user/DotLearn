FROM node:20-alpine AS build

WORKDIR /workspace

RUN corepack enable

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY turbo.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/api ./apps/api

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @dotlearn/contracts build
RUN pnpm --filter @dotlearn/api build

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

CMD ["node", "dist/main.js"]
