FROM node:22-alpine AS builder

RUN corepack enable

WORKDIR /app

COPY package.json .

RUN pnpm install

COPY src src
COPY vite.config.ts .
COPY tsconfig.json .
COPY project.inlang project.inlang

RUN pnpm run build

FROM node:22-alpine AS runner

RUN corepack enable

WORKDIR /app

COPY --from=builder /app/.output /app/.output

COPY --from=builder /app/package.json /app/package.json
COPY --from=builder /app/pnpm-lock.yaml /app/pnpm-lock.yaml
COPY --from=builder /app/tsconfig.json /app/tsconfig.json
COPY --from=builder /app/vite.config.ts /app/vite.config.ts
COPY --from=builder /app/project.inlang /app/project.inlang

RUN pnpm install --production
EXPOSE 3000
CMD ["pnpm", "preview"]