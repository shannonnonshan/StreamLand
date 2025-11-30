# -------------------------
# 1. BASE IMAGE
# -------------------------
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .
# Copy env file
COPY .env .env
# Prisma generate
RUN npx prisma generate

# Build NestJS
RUN npm run build

# -------------------------
# 2. PRODUCTION IMAGE
# -------------------------
FROM node:18-alpine AS runner

WORKDIR /app

COPY package*.json ./
# Install only production dependencies
RUN npm install --omit=dev

# Copy build output
COPY --from=builder /app/dist ./dist

# Copy Prisma folder
COPY prisma ./prisma

ENV NODE_ENV=production

EXPOSE 4000

CMD ["node", "dist/main.js"]
