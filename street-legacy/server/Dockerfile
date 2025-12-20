# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY shared/package*.json ./shared/
COPY server/package*.json ./server/

# Install dependencies
RUN npm ci --workspace=shared --workspace=server

# Copy source
COPY shared ./shared
COPY server ./server

# Build shared first, then server
RUN npm run build -w shared
RUN npm run build -w server

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY shared/package*.json ./shared/
COPY server/package*.json ./server/

# Install production dependencies only
RUN npm ci --workspace=shared --workspace=server --omit=dev

# Copy built files
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/server/dist ./server/dist

# Copy SQL files for db scripts
COPY server/src/db/*.sql ./server/dist/db/

EXPOSE 3001

ENV NODE_ENV=production

CMD ["node", "server/dist/index.js"]
