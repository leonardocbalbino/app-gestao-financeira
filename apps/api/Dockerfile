# Imagem de produção da API (executar a partir da raiz do monorepo):
#   docker build -f apps/api/Dockerfile -t gestao-api .
FROM node:22-slim
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter @app/api... --ignore-scripts
COPY packages/shared packages/shared
COPY apps/api apps/api
COPY db/migrations db/migrations
ENV NODE_ENV=production PORT=8080
EXPOSE 8080
WORKDIR /app/apps/api
# Migrations antes de subir (idempotentes); depois API + worker.
CMD ["sh", "-c", "npx tsx src/db/migrate.ts && npx tsx src/main.ts"]
