# Stage 1: Build the application
FROM node:22.16.0-alpine AS builder
WORKDIR /server
COPY server/package*.json ./
RUN npm ci
COPY server/tsconfig.json ./
COPY server/app.ts ./
RUN npm run build

# Stage 2: Create production image
FROM node:22.16.0-alpine
WORKDIR /server
COPY server/package*.json ./
RUN npm ci --only=production
COPY --from=builder /server/dist ./dist
EXPOSE 8080
CMD ["node", "dist/app.js"]