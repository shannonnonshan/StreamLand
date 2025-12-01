# -------------------------
# 1. BUILD STAGE
# -------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package.json + prisma folder trước
COPY package*.json ./
COPY prisma ./prisma

# Cài tất cả dependencies (cả dev để build NestJS + Prisma)
RUN npm install

# Copy toàn bộ source code
COPY . .

# --- ARG từ Render (env sẽ được inject) ---
ARG DATABASE_URL
ARG DIRECT_URL
ARG MONGODB_URL

# --- Chuyển ARG thành ENV để Prisma đọc ---
ENV DATABASE_URL=${DATABASE_URL}
ENV DIRECT_URL=${DIRECT_URL}
ENV MONGODB_URL=${MONGODB_URL}

# --- Generate Prisma clients tuần tự ---
RUN npx prisma generate --schema=./prisma/postgres/schema.prisma
RUN npx prisma generate --schema=./prisma/mongodb/schema.prisma

# --- Build NestJS ---
RUN npm run build -p tsconfig.build.json

# -------------------------
# 2. PRODUCTION STAGE
# -------------------------
FROM node:20-alpine AS runner

WORKDIR /app

# Copy package.json + install chỉ production deps
COPY package*.json ./
RUN npm install --omit=dev

# Copy built app + Prisma clients
COPY --from=builder /app/dist ./dist
# Copy built app + Prisma clients
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# (Optional) Copy Prisma folder nếu runtime app dùng schema
COPY prisma ./prisma

# ENV
ENV NODE_ENV=production

# Expose port
EXPOSE 4000

# Start NestJS app
CMD ["node", "dist/main"]
