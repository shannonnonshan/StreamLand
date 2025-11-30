# -------------------------
# 1. BUILD STAGE
# -------------------------
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev for prisma)
RUN npm install

# Copy source code
COPY . .

# Copy Prisma schema
COPY prisma ./prisma

# Generate Prisma clients (không cần DATABASE_URL nếu chỉ generate client)
# Nếu muốn chỉ generate 1 generator, dùng: npx prisma generate --generator mongoClient
RUN npx prisma generate

# Build TypeScript or app
RUN npm run build

# -------------------------
# 2. PRODUCTION STAGE
# -------------------------
FROM node:18-alpine AS runner

WORKDIR /app

# Copy only package files for production
COPY package*.json ./

# Install only production dependencies
RUN npm install --omit=dev

# Copy built app
COPY --from=builder /app/dist ./dist

# Copy generated Prisma clients
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Copy Prisma schema (optional if needed at runtime)
COPY prisma ./prisma

# Set production environment
ENV NODE_ENV=production

# Expose port
EXPOSE 4000

# Start app
CMD ["node", "dist/main.js"]
