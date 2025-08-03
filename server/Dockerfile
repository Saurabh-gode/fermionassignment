# Stage 1: Build the application
FROM node:22.16.0-alpine AS builder

# Install Python, pip, and build tools for mediasoup
RUN apk add --no-cache python3 py3-pip make g++ linux-headers

# Set working directory
WORKDIR /server

# Copy package.json and package-lock.json (if exists)
COPY package*.json ./

# Install all dependencies (including devDependencies for TypeScript and mediasoup)
RUN npm ci

# Copy all source files
COPY . ./

# Build TypeScript code
RUN npm run build

# Stage 2: Create production image
FROM node:22.16.0-alpine

# Set working directory
WORKDIR /server

# Copy package.json and package-lock.json
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy built JavaScript files from builder stage
COPY --from=builder /server/dist ./dist

# Expose port for the Node.js app (WebSocket and API)
EXPOSE 8080

# Command to run the application
CMD ["node", "dist/app.js"]