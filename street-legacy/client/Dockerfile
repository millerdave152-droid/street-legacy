# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY shared/package*.json ./shared/
COPY client/package*.json ./client/

# Install dependencies
RUN npm ci --workspace=shared --workspace=client

# Copy source
COPY shared ./shared
COPY client ./client

# Build shared first, then client
RUN npm run build -w shared
RUN npm run build -w client

# Production stage
FROM nginx:alpine

# Copy nginx config
COPY client/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built files
COPY --from=builder /app/client/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
