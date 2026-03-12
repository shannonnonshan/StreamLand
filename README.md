# StreamLand - Live Streaming Education Platform

A comprehensive online education platform that enables teachers to host live streaming classes and share educational content with students in real-time.

## Team Members

- **Đoàn Minh Khanh**
- **Đinh Thị Thanh Vy**

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Running the Application](#running-the-application)
- [Project Structure](#project-structure)
- [Environment Variables](#environment-variables)
- [API Documentation](#api-documentation)

## Overview

StreamLand is a modern education platform that bridges the gap between teachers and students through live streaming technology. Teachers can broadcast live classes, upload educational materials, and interact with students in real-time, while students can join live sessions, watch recorded videos, and engage with educational content.

### 🌐 Network Infrastructure

The platform uses **WebRTC** with **TURN server support** to ensure reliable connections for multiple viewers simultaneously, even behind firewalls and restrictive NAT configurations. This guarantees that students can join livestreams from any network environment.

## Features

### For Teachers
- **Live Streaming**: Broadcast live classes with real-time video and audio
- **Document Management**: Upload and organize teaching materials (PDF, DOC, PPT, Excel)
- **Dashboard Analytics**: Track viewers, engagement, and performance metrics
- **Schedule Management**: Plan and schedule upcoming livestreams
- **Real-time Chat**: Interact with students during live sessions
- **Recording**: Automatically record livestreams for later viewing
- **Student Management**: View followers and engagement statistics

### For Students
- **Live Classes**: Join live streaming sessions from teachers
- **Video Library**: Access recorded livestreams and educational videos
- **Document Access**: Download and view educational materials
- **Messaging**: Chat with teachers and peers
- **Notifications**: Get notified about upcoming classes
- **Follow Teachers**: Subscribe to favorite teachers
- **Dashboard**: Personalized view of available livestreams and videos

### For Admins
- **User Management**: Manage teachers and students
- **Platform Analytics**: Monitor platform usage and statistics
- **Settings**: Configure platform settings and parameters

## Tech Stack

### Frontend
- **Framework**: Next.js 15 (React 18)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: 
  - Heroicons
  - Lucide React
  - Framer Motion (animations)
- **Real-time**: Socket.IO Client
- **WebRTC**: Simple-peer for live streaming
- **State Management**: React Hooks
- **HTTP Client**: Fetch API
- **Notifications**: React Hot Toast

### Backend
- **Framework**: NestJS
- **Language**: TypeScript
- **Database**: 
  - PostgreSQL (Supabase) - Main data
  - MongoDB - Chat and messages
- **ORM**: Prisma (dual database setup)
- **Authentication**: JWT (JSON Web Tokens)
- **Password Hashing**: bcrypt
- **Real-time**: Socket.IO
- **File Storage**: Cloudflare R2
- **Email**: Nodemailer
- **Validation**: class-validator

### Infrastructure
- **Database Hosting**: 
  - Supabase (PostgreSQL)
  - MongoDB Atlas
- **Object Storage**: Cloudflare R2
- **WebRTC Signaling**: Socket.IO
- **Containerization**: Docker support

## Prerequisites

Before running the application, ensure you have the following installed:

- **Node.js**: v18 or higher
- **npm**: v9 or higher (comes with Node.js)
- **PostgreSQL**: v14 or higher (or Supabase account)
- **MongoDB**: v6 or higher (or MongoDB Atlas account)
- **Git**: For cloning the repository

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/shannonnonshan/StreamLand.git
cd StreamLand
```

### 2. Install Backend Dependencies

```bash
cd backend
npm install
```

### 3. Install Frontend Dependencies

```bash
cd ../frontend
npm install
```

### 4. Setup Environment Variables

#### Backend Environment (.env)

Create a `.env` file in the `backend` directory:

```env
# Database URLs
DATABASE_URL="postgresql://user:password@host:5432/streamland"
MONGODB_URL="mongodb+srv://user:password@cluster.mongodb.net/streamland-chat"

# JWT Configuration
JWT_SECRET="your-secret-key-here"
JWT_EXPIRATION="7d"

# Email Configuration
MAIL_HOST="smtp.gmail.com"
MAIL_PORT=587
MAIL_USER="your-email@gmail.com"
MAIL_PASSWORD="your-app-password"
MAIL_FROM="noreply@streamland.com"

# Cloudflare R2 Configuration
R2_ACCOUNT_ID="your-account-id"
R2_ACCESS_KEY_ID="your-access-key"
R2_SECRET_ACCESS_KEY="your-secret-key"
R2_BUCKET_NAME="streamland-storage"
R2_PUBLIC_URL="https://your-bucket.r2.dev"

# Application
PORT=3001
FRONTEND_URL="http://localhost:3000"
```

#### Frontend Environment (.env)

Create a `.env` file in the `frontend` directory:

```env
NEXT_PUBLIC_API_URL="http://localhost:3001"
NEXT_PUBLIC_SOCKET_URL="http://localhost:3001"
NEXT_PUBLIC_WEBRTC_STUN_URLS="stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302"
NEXT_PUBLIC_WEBRTC_TURN_URLS="turn:YOUR_TURN_IP:3478?transport=udp,turn:YOUR_TURN_IP:3478?transport=tcp"
NEXT_PUBLIC_WEBRTC_TURN_USERNAME="streamland-turn"
NEXT_PUBLIC_WEBRTC_TURN_CREDENTIAL="your-strong-turn-password"
NEXT_PUBLIC_WEBRTC_ICE_TRANSPORT_POLICY="all"
```

For production livestreaming across different networks, use a self-hosted TURN server. See `GCP_TURN_SETUP.md` for the full Google Cloud setup and coturn configuration.

### 5. Setup Databases

#### PostgreSQL (Prisma)

```bash
cd backend

# Generate Prisma Client for PostgreSQL
npx prisma generate --schema=prisma/postgres/schema.prisma

# Run migrations
npx prisma migrate deploy --schema=prisma/postgres/schema.prisma

# (Optional) Seed database with sample data
npx prisma db seed
```

#### MongoDB (Prisma)

```bash
# Generate Prisma Client for MongoDB
npx prisma generate --schema=prisma/mongodb/schema.prisma
```

## Running the Application

### Development Mode

#### 1. Start Backend Server

```bash
cd backend
npm run start:dev
```

The backend will start on `http://localhost:3001`

#### 2. Start Frontend Server

Open a new terminal:

```bash
cd frontend
npm run dev
```

The frontend will start on `http://localhost:3000`

### Production Mode

#### Backend

```bash
cd backend
npm run build
npm run start:prod
```

#### Frontend

```bash
cd frontend
npm run build
npm start
```

### Using Docker (Optional)

```bash
# From root directory
docker-compose up -d
```

## 📁 Project Structure

```
StreamLand/
├── backend/                    # NestJS Backend
│   ├── prisma/
│   │   ├── postgres/          # PostgreSQL schema & migrations
│   │   │   ├── schema.prisma
│   │   │   ├── migrations/
│   │   │   └── seed.ts
│   │   └── mongodb/           # MongoDB schema
│   │       ├── schema.prisma
│   │       └── seed.ts
│   ├── src/
│   │   ├── admin/            # Admin module
│   │   ├── auth/             # Authentication & authorization
│   │   ├── chat/             # Real-time chat
│   │   ├── livestream/       # Livestream management
│   │   ├── mail/             # Email service
│   │   ├── notification/     # Notifications
│   │   ├── prisma/           # Prisma service
│   │   ├── r2-storage/       # Cloudflare R2 integration
│   │   ├── redis/            # Redis caching
│   │   ├── stream/           # WebRTC streaming
│   │   ├── student/          # Student module
│   │   ├── teacher/          # Teacher module
│   │   └── main.ts
│   └── package.json
│
├── frontend/                  # Next.js Frontend
│   ├── public/
│   │   ├── admin/            # Admin assets
│   │   └── image/            # Images
│   ├── src/
│   │   ├── app/
│   │   │   ├── admin/        # Admin pages
│   │   │   ├── auth/         # Authentication pages
│   │   │   ├── student/      # Student pages
│   │   │   └── teacher/      # Teacher pages
│   │   ├── component/        # Reusable components
│   │   ├── contexts/         # React contexts
│   │   ├── hooks/            # Custom hooks
│   │   ├── lib/              # Utilities
│   │   └── utils/            # Helper functions
│   └── package.json
│
├── docker-compose.yml        # Docker configuration
└── README.md                 # This file
```

## 🔐 Environment Variables

### Required Backend Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `MONGODB_URL` | MongoDB connection string | `mongodb+srv://...` |
| `JWT_SECRET` | Secret key for JWT tokens | `your-secret-key` |
| `R2_ACCOUNT_ID` | Cloudflare R2 account ID | `abc123...` |
| `R2_ACCESS_KEY_ID` | R2 access key | `your-access-key` |
| `R2_SECRET_ACCESS_KEY` | R2 secret key | `your-secret-key` |

### Required Frontend Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Backend API URL | `http://localhost:3001` |
| `NEXT_PUBLIC_SOCKET_URL` | Socket.IO server URL | `http://localhost:3001` |

##  API Documentation

### Authentication Endpoints

- `POST /auth/register` - Register new user
- `POST /auth/login` - User login
- `POST /auth/logout` - User logout
- `GET /auth/profile` - Get user profile

### Livestream Endpoints

- `GET /livestream/active/all` - Get all active live streams
- `GET /livestream/recorded/all` - Get recorded videos
- `GET /livestream/scheduled/upcoming` - Get upcoming scheduled streams
- `GET /livestream/:id` - Get livestream details
- `POST /livestream` - Create new livestream (Teacher)
- `PATCH /livestream/:id/start` - Start livestream (Teacher)
- `PATCH /livestream/:id/end` - End livestream (Teacher)

### Teacher Endpoints

- `GET /teacher/:id/profile` - Get teacher profile (Public)
- `GET /teacher/:id/videos` - Get teacher videos/livestreams
- `GET /teacher/:id/dashboard/stats` - Get dashboard statistics
- `POST /teacher/:id/documents` - Upload document
- `DELETE /teacher/:teacherId/documents/:documentId` - Delete document

### Student Endpoints

- `GET /student/:id/dashboard` - Get student dashboard
- `GET /student/:id/following` - Get followed teachers
- `POST /student/follow/:teacherId` - Follow teacher
- `DELETE /student/unfollow/:teacherId` - Unfollow teacher

### Admin Endpoints

- `GET /admin/stats` - Get platform statistics
- `GET /admin/users` - Get all users
- `POST /admin/change-password` - Change admin password

## 🎥 Live Streaming Architecture

The platform uses **WebRTC** for peer-to-peer video streaming with **Socket.IO** for signaling and **TURN servers** for NAT traversal:

1. **Teacher initiates broadcast** → Creates WebRTC offer
2. **Server signals students** → Distributes connection details
3. **Students join stream** → Establish P2P connections (direct or via TURN relay)
4. **Real-time chat** → Socket.IO message broadcasting
5. **Recording** → Server captures and stores to R2

### 🔌 TURN Server Support

The application includes **free public TURN servers** (Open Relay Project) configured out-of-the-box to ensure reliable connectivity:

- ✅ **Works behind firewalls** - Students can connect from corporate networks
- ✅ **Supports restrictive NAT** - Handles symmetrical NAT configurations
- ✅ **Multiple viewers simultaneously** - No connection limits for students
- ✅ **Multiple server redundancy** - STUN + TURN servers on different ports (80, 443, TCP/UDP)

**For production deployment or custom TURN servers**, see [TURN_SERVER_SETUP.md](./TURN_SERVER_SETUP.md) for detailed configuration guide.

## 🔧 Development Tools

### Backend Commands

```bash
# Start development server
npm run start:dev

# Build for production
npm run build

# Run tests
npm run test

# Generate Prisma client
npx prisma generate

# Create migration
npx prisma migrate dev --name migration_name

# Open Prisma Studio
npx prisma studio
```

### Frontend Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

```

## 🐛 Troubleshooting

### Prisma Client Not Generated

```bash
# Regenerate Prisma clients
cd backend
npx prisma generate --schema=prisma/postgres/schema.prisma
npx prisma generate --schema=prisma/mongodb/schema.prisma
```

### Database Connection Issues

1. Check database credentials in `.env`
2. Ensure database server is running
3. Check firewall settings
4. Verify network connectivity

## License

This project is developed for educational purposes.

## Contributing

This is an academic project developed by Đoàn Minh Khanh and Đinh Thị Thanh Vy.

## Support

For questions or issues, please contact the development team.

---

**Built by Đoàn Minh Khanh & Đinh Thị Thanh Vy**
