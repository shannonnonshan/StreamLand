# -------------------------
# 1. BUILD STAGE
# -------------------------
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
COPY prisma ./prisma

# --- Step 1: Generate PostgreSQL client ---
# Dùng env từ build args (Render sẽ inject env)
RUN DATABASE_URL=$DATABASE_URL DIRECT_URL=$DIRECT_URL npx prisma generate --generator client

# --- Step 2: Generate MongoDB client ---
RUN MONGODB_URL=$MONGODB_URL npx prisma generate --generator mongoClient

# Build TypeScript / app
RUN npm run build
# -------------------------
# 2. PRODUCTION STAGE
# -------------------------
FROM node:20-alpine AS runner

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
CMD ["node", "dist/main.js","prisma", "generate"]
