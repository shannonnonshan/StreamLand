# -------------------------
# 1. BUILD STAGE
# -------------------------
FROM node:20-bookworm-slim AS builder

WORKDIR /app

# Copy package.json + prisma folder
COPY package*.json ./
COPY prisma ./prisma

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# --- ARG from Render---
ARG DATABASE_URL
ARG DIRECT_URL
ARG MONGODB_URL

# --- ARG to ENV ---
ENV DATABASE_URL=${DATABASE_URL}
ENV DIRECT_URL=${DIRECT_URL}
ENV MONGODB_URL=${MONGODB_URL}

# --- Generate Prisma clients in order---
RUN npx prisma generate --schema=./prisma/postgres/schema.prisma
RUN npx prisma generate --schema=./prisma/mongodb/schema.prisma

# --- Build NestJS ---
RUN npm run build -p tsconfig.build.json

# -------------------------
# 2. PRODUCTION STAGE
# -------------------------
FROM node:20-bookworm-slim AS runner

WORKDIR /app

# ffmpeg is required for extracting audio from video during transcription
RUN apt-get update \
	&& apt-get install -y --no-install-recommends ffmpeg \
	&& rm -rf /var/lib/apt/lists/*

# Copy package.json + install for production deps
COPY package*.json ./
RUN npm install --omit=dev

# Copy built app + Prisma clients
COPY --from=builder /app/dist ./dist
# Copy built app + Prisma clients
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# (Optional) Copy Prisma folder if runtime app use schema
COPY prisma ./prisma

# ENV
ENV NODE_ENV=production

# Expose port
EXPOSE 4000

# Start NestJS app
CMD ["node", "dist/main"]
