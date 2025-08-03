# Stage 1: Build the application
FROM node:22.16.0-alpine AS builder
WORKDIR /server
COPY package*.json ./
RUN npm ci
COPY . ./
RUN npm run build

# Stage 2: Create production image
FROM node:22.16.0-alpine
WORKDIR /server
COPY package*.json ./
RUN npm ci
COPY --from=builder /server/dist ./dist
EXPOSE 8080
CMD ["node", "dist/app.js"]