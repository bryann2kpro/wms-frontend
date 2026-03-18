FROM oven/bun:1.3-slim AS builder

WORKDIR /app

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