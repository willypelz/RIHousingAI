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
COPY server/package*.json ./
# include dev deps: tsx is required to run the TS server at runtime
RUN npm ci --include=dev --no-audit --no-fund
ENV NODE_ENV=production
COPY server/ ./
COPY --from=client-build /app/client/dist /app/client/dist
COPY docs/ /app/docs/
EXPOSE 8080
CMD ["npx", "tsx", "src/index.ts"]
