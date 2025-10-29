# 🗄️ Dual Database Setup Guide

## Cấu trúc thư mục

```
prisma/
├── postgres/
│   ├── schema.prisma      # PostgreSQL schema (user, auth, courses)
│   ├── migrations/        # PostgreSQL migrations
│   └── seed.ts           # PostgreSQL seed data
│
└── mongodb/
    ├── schema.prisma      # MongoDB schema (chat, notifications, realtime)
    └── seed.ts           # MongoDB seed data
```

## 📦 MongoDB được dùng cho:
- **Chat Messages** - Direct messages giữa users
- **Live Stream Chat** - Real-time chat trong livestream
- **Notifications** - Thông báo real-time
- **Activity Logs** - User activity tracking
- **Live Stream Sessions** - Analytics và viewer tracking
- **User Presence** - Online/offline status

## 📦 PostgreSQL được dùng cho:
- **Users & Authentication**
- **Courses & Content**
- **Student/Teacher Profiles**
- **Permissions & Roles**
- **Structured relational data**

## 🚀 Setup Commands

### 1. Cài đặt dependencies
```bash
npm install
```

### 2. Thêm MONGODB_URL vào .env
```env
# MongoDB Database (For Real-time Data)
MONGODB_URL="mongodb://localhost:27017/streamland"
# Hoặc dùng MongoDB Atlas:
# MONGODB_URL="mongodb+srv://username:password@cluster.mongodb.net/streamland"
```

### 3. Generate Prisma Clients
```bash
# Generate PostgreSQL client
npx prisma generate --schema=./prisma/postgres/schema.prisma

# Generate MongoDB client  
npx prisma generate --schema=./prisma/mongodb/schema.prisma

# Hoặc cả 2 cùng lúc (sau khi thêm script vào package.json):
npm run prisma:generate
```

### 4. Run Migrations

**PostgreSQL:**
```bash
npx prisma migrate dev --schema=./prisma/postgres/schema.prisma
```

**MongoDB** (không cần migrate, dùng db push):
```bash
npx prisma db push --schema=./prisma/mongodb/schema.prisma
```

### 5. Seed Data (Optional)
```bash
# PostgreSQL
npx ts-node prisma/postgres/seed.ts

# MongoDB
npx ts-node prisma/mongodb/seed.ts
```

### 6. Open Prisma Studio
```bash
# PostgreSQL
npx prisma studio --schema=./prisma/postgres/schema.prisma

# MongoDB
npx prisma studio --schema=./prisma/mongodb/schema.prisma
```

## 📝 Thêm vào package.json

Thêm các scripts này vào `package.json`:

```json
{
  "scripts": {
    "prisma:postgres:generate": "prisma generate --schema=./prisma/postgres/schema.prisma",
    "prisma:mongodb:generate": "prisma generate --schema=./prisma/mongodb/schema.prisma",
    "prisma:generate": "npm run prisma:postgres:generate && npm run prisma:mongodb:generate",
    
    "prisma:postgres:migrate": "prisma migrate dev --schema=./prisma/postgres/schema.prisma",
    "prisma:postgres:deploy": "prisma migrate deploy --schema=./prisma/postgres/schema.prisma",
    "prisma:mongodb:push": "prisma db push --schema=./prisma/mongodb/schema.prisma",
    
    "prisma:studio:postgres": "prisma studio --schema=./prisma/postgres/schema.prisma",
    "prisma:studio:mongodb": "prisma studio --schema=./prisma/mongodb/schema.prisma"
  }
}
```

## 🔧 Sử dụng trong code

### PostgreSQL (existing)
```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Use as normal
const users = await prisma.user.findMany();
```

### MongoDB (new)
```typescript
import { PrismaClient as MongoClient } from '@prisma/mongodb-client';

const mongo = new MongoClient();

// Use for realtime data
const messages = await mongo.chatMessage.findMany({
  where: { senderId: userId }
});
```

## 🎯 Next Steps

1. ✅ Cấu trúc thư mục đã tạo
2. ✅ Schema files đã tạo
3. ⏳ Thêm MONGODB_URL vào .env
4. ⏳ Run `npm run prisma:generate`
5. ⏳ Tạo MongoDB service trong NestJS
6. ⏳ Implement Socket.IO với MongoDB cho real-time features

## 💡 Tips

- MongoDB không cần migrations, chỉ cần `db push`
- Dùng `@map("_id")` và `@db.ObjectId` cho MongoDB IDs
- Generator outputs phải khác nhau để tránh conflict
- Có thể dùng cả 2 databases trong cùng 1 service

## 🐛 Troubleshooting

**Error: "generator client already exists"**
→ Đổi tên generator trong MongoDB schema thành `mongoClient`

**Error: "datasource db already exists"**  
→ Đổi tên datasource trong MongoDB schema thành `mongodb`

**MongoDB connection fails**
→ Kiểm tra MongoDB đang chạy: `mongod` hoặc dùng MongoDB Atlas
