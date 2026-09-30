# node:22 (Debian/glibc): já traz o módulo nativo node:sqlite, sem dependência nativa pra compilar
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
RUN npm prune --omit=dev

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production \
    TZ=America/Sao_Paulo \
    DB_PATH=/app/data/orbita.db
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
RUN mkdir -p /app/data && chown -R node:node /app/data
USER node
VOLUME ["/app/data"]
EXPOSE 3001
CMD ["node", "--disable-warning=ExperimentalWarning", "dist/server.js"]
