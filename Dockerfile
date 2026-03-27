FROM oven/bun:1.3-slim AS builder

WORKDIR /app

ARG VITE_API_URL
ARG VITE_GRAPHQL_ENDPOINT

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_GRAPHQL_ENDPOINT=$VITE_GRAPHQL_ENDPOINT

COPY package.json .

RUN bun install

COPY src src
COPY vite.config.ts .
COPY tsconfig.json .
COPY project.inlang project.inlang
COPY .env.production .env.production

RUN bun run build

EXPOSE 3000

CMD ["bun", "run", ".output/server/index.mjs"]