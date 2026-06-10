FROM node:20-alpine AS build

WORKDIR /workspace

RUN corepack enable

ARG VITE_API_BASE
ARG VITE_ADMIN_PATH

ENV VITE_API_BASE=$VITE_API_BASE
ENV VITE_ADMIN_PATH=$VITE_ADMIN_PATH

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY turbo.json tsconfig.base.json ./
COPY packages ./packages
COPY topics ./topics
COPY interview ./interview
COPY apps/web ./apps/web

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @dotlearn/contracts build
RUN pnpm --filter @dotlearn/sandbox build
RUN pnpm --filter @dotlearn/lesson-engine build
RUN pnpm --filter @dotlearn/ai-providers build
RUN pnpm --filter @dotlearn/web build

FROM nginx:alpine AS runtime

COPY --from=build /workspace/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY apps/web/security-headers.conf /etc/nginx/security-headers.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
