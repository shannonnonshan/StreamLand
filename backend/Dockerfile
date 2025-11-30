# ================================
# Stage 1: Build
# ================================
FROM node:20-bullseye-slim AS builder
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies including devDependencies
RUN npm install

# Copy Prisma schema (required before generating)
COPY prisma ./prisma

# Generate Prisma Client
RUN npx prisma generate

# Copy the entire project
COPY . .

# Build NestJS
RUN npm run build


# ================================
# Stage 2: Production Image
# ================================
FROM node:20-bullseye-slim AS prod
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN npm install --only=production

# Copy Prisma schema (optional but recommended)
COPY prisma ./prisma

# Copy the compiled NestJS dist folder
COPY --from=builder /app/dist ./dist

# Copy Prisma Client generated in the builder stage
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Start the application
# (Uncomment the next line if you want automatic DB migrations)
# CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]

CMD ["node", "dist/main.js"]
