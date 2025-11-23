# Docker Setup for StreamLand

## Architecture

This project uses a **Hybrid Setup**:
- **Redis**: Docker Local (FREE, fast, no limits)
- **PostgreSQL**: Supabase Cloud (FREE tier)
- **MongoDB**: Atlas Cloud (FREE tier)

## Quick Start

### 1. Start Redis:
```bash
docker-compose up -d
```

### 2. Check status:
```bash
docker-compose ps
```

### 3. View logs:
```bash
docker-compose logs -f redis
```

### 4. Stop Redis:
```bash
docker-compose down
```

### 5. Stop and remove data:
```bash
docker-compose down -v
```

## Services

| Service | Location | Connection |
|---------|----------|------------|
| Redis | Docker Local | `localhost:6379` |
| PostgreSQL | Supabase Cloud | Already in backend/.env |
| MongoDB | Atlas Cloud | Already in backend/.env |

## Commands

### Redis CLI
```bash
docker exec -it streamland-redis redis-cli -a streamland123
```

