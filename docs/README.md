# StreamLand Documentation

This folder contains all technical documentation for the StreamLand project.

## Authentication & Authorization

- **[OAUTH_SETUP.md](./OAUTH_SETUP.md)** - OAuth integration setup guide (Google & GitHub)
- **[OAUTH_NEW_FLOW.md](./OAUTH_NEW_FLOW.md)** - New OAuth authentication flow documentation
- **[OAUTH_ROLE_LOGIC.md](./OAUTH_ROLE_LOGIC.md)** - Role-based access control logic for OAuth
- **[AUTH_IMPLEMENTATION.md](./AUTH_IMPLEMENTATION.md)** - Frontend authentication implementation guide

## Database

- **[DUAL_DATABASE_SETUP.md](./DUAL_DATABASE_SETUP.md)** - PostgreSQL + MongoDB dual database configuration

## Deployment

- **[README.Docker.md](./README.Docker.md)** - Docker setup and deployment instructions

## Backend Role Guard Usage

The backend includes role-based authorization guards:

```typescript
import { Roles } from './auth/decorators/roles.decorator';
import { RolesGuard } from './auth/guards/roles.guard';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { Role } from '@prisma/client';

// Protect routes by role
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Get('admin-only')
adminOnly() {
  return 'Admin only content';
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.TEACHER, Role.ADMIN)
@Get('teacher-or-admin')
teacherOrAdmin() {
  return 'Teacher or Admin content';
}
```

## Available Roles

- `STUDENT` - Regular student users
- `TEACHER` - Teacher accounts with livestream capabilities
- `ADMIN` - Administrator accounts with full system access
