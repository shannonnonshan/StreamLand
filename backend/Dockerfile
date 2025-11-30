# -------------------------
# 1. BUILD STAGE
# -------------------------
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma
RUN npm install

COPY . .

# --- Nhận biến môi trường từ Render (dưới dạng ARGs) và chuyển thành ENVs ---
# Render sẽ tự động inject DATABASE_URL, MONGODB_URL vào đây
ARG DATABASE_URL
ARG DIRECT_URL
ARG MONGODB_URL

# Đặt chúng thành biến ENV để Prisma có thể đọc trong các lệnh RUN sau:
ENV DATABASE_URL=${DATABASE_URL}
ENV DIRECT_URL=${DIRECT_URL}
ENV MONGODB_URL=${MONGODB_URL}

# --- Chạy Prisma Generate (bây giờ sẽ hoạt động) ---
# Lỗi 1.601 sẽ được giải quyết vì ENV đã có sẵn
# Generate PostgreSQL client
RUN npx prisma generate --schema=./prisma/postgres/schema.prisma

# Generate MongoDB client
RUN npx prisma generate --schema=./prisma/mongodb/schema.prisma


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

# Copy built app & generated client files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY prisma ./prisma

# Set production environment
ENV NODE_ENV=production

# Expose port
EXPOSE 4000

# Start app (loại bỏ prisma generate khỏi CMD)
CMD ["node", "dist/main.js"]