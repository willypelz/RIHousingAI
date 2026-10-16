# ---- Build frontend ----
FROM node:20-slim AS client-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci --no-audit --no-fund
COPY client/ ./
RUN npm run build

# ---- Server ----
FROM node:20-slim
WORKDIR /app/server
ENV NODE_ENV=production
COPY server/package*.json ./
RUN npm ci --no-audit --no-fund
COPY server/ ./
COPY --from=client-build /app/client/dist /app/client/dist
EXPOSE 8080
CMD ["npx", "tsx", "src/index.ts"]
