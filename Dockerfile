FROM node:22-alpine AS builder

RUN corepack enable

WORKDIR /app

ARG VITE_API_URL
ARG VITE_GRAPHQL_ENDPOINT

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_GRAPHQL_ENDPOINT=$VITE_GRAPHQL_ENDPOINT

COPY package.json pnpm-lock.yaml* ./

RUN pnpm install --frozen-lockfile --ignore-scripts

COPY src src
COPY vite.config.ts .
COPY tsconfig.json .
COPY project.inlang project.inlang

RUN pnpm run build

FROM node:22-alpine AS runner

WORKDIR /app

COPY --from=builder /app/.output /app/.output

EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
