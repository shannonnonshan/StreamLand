<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).

## StreamLand Backend — Project-specific Notes

This folder contains the NestJS backend for the StreamLand platform. Below are quick, project-specific instructions.

### Environment

Create `backend/.env` (example):

```
# Database
DATABASE_URL="postgresql://user:password@host:5432/streamland"
MONGODB_URL="mongodb+srv://user:password@cluster.mongodb.net/streamland-chat"

# JWT
JWT_SECRET="your-secret-key"
JWT_EXPIRATION="7d"

# Email
MAIL_HOST="smtp.example.com"
MAIL_PORT=587
MAIL_USER="your-email@example.com"
MAIL_PASSWORD="your-email-password"

# Cloudflare R2
R2_ACCOUNT_ID=""
R2_ACCESS_KEY_ID=""
R2_SECRET_ACCESS_KEY=""
R2_BUCKET_NAME="streamland-storage"

PORT=3001
FRONTEND_URL="http://localhost:3000"
```

### Useful commands

```bash
cd backend
npm install

# Generate Prisma client for both DBs if needed
npx prisma generate --schema=prisma/postgres/schema.prisma
npx prisma generate --schema=prisma/mongodb/schema.prisma

# Development
npm run start:dev

# Build / production
npm run build
npm run start:prod

# Tests
npm run test
npm run test:e2e
```

### Notes

- Run `npx prisma generate` after editing any Prisma schema.
- See `prisma/postgres` and `prisma/mongodb` for schema and seeds.
- R2 integration uses Cloudflare credentials in env; do not commit secrets.

## Roles & Permissions

StreamLand uses role-based access control (RBAC) to manage permissions across the platform. Below is a recommended role layout and examples of how the backend enforces permissions.

Core roles
- `admin` — Full access to platform management endpoints (user management, system stats, configuration). Intended for site operators.
- `teacher` — Can create/manage livestreams, upload documents, view their analytics, start/stop broadcasts, and manage their content.
- `student` — Can view/join livestreams, watch recorded videos, download documents, follow teachers, and interact in chat.
- `guest` — Unauthenticated or limited-access users (can view public content or preview pages).

Permissions examples
- `livestream:create` — Allowed for `teacher` and `admin`.
- `livestream:manage` — Owner-only permission (teacher who created the stream) or `admin`.
- `documents:upload` — Allowed for `teacher` and `admin`.
- `users:read` — Allowed for `admin` (and limited self-view for other roles).

Enforcement strategy
- JWT claims: include `role` and minimal `permissions` array in the token payload for quick checks.
- Guards: use NestJS guards (e.g., `RolesGuard`, `PermissionsGuard`) to protect controllers/routes.
- Ownership checks: for resources with owners (e.g., livestreams, documents), combine role checks with resource-owner checks in services or guards.

Practical examples
- Protect a route with roles:

```ts
@UseGuards(AuthGuard, RolesGuard)
@Roles('teacher', 'admin')
@Post('livestream')
createLivestream() { }
```

- Ownership check in service (pseudocode):

```ts
const stream = await this.livestreamRepo.findById(id);
if (stream.ownerId !== user.id && user.role !== 'admin') {
  throw new ForbiddenException();
}
```

Auditing & escalation
- Log administrative actions and content moderation events for auditability.
- Provide an admin-only endpoint to view platform-wide metrics and logs.

Security notes
- Keep permission checks thin in controllers and move complex rules to services/guards so unit tests can cover logic.
- Rotate admin credentials and limit `admin` accounts to trusted operators.

### Troubleshooting Prisma connection errors (P1001)

If you see errors like `PrismaClientKnownRequestError: Can't reach database server ... (P1001)`, try these steps:

1. Verify `DATABASE_URL` in `backend/.env` points to the correct host and port (pooler vs direct DB). If using Supabase pooling, confirm the provided pooler host and port.

2. Test network connectivity from the machine running the backend:

PowerShell (Windows):
```powershell
Test-NetConnection -ComputerName aws-1-ap-south-1.pooler.supabase.com -Port 6543
```

Linux/macOS:
```bash
nc -vz aws-1-ap-south-1.pooler.supabase.com 6543
# or
psql "${DATABASE_URL}"
```

3. Check SSL and query params: ensure `?sslmode=require` or equivalent is set when required by your provider.

4. Use `DIRECT_URL` (non-pooler) for migrations if your pooler blocks certain commands; keep pooled `DATABASE_URL` for runtime.

5. Look for transient network issues — implement retries (cleanup jobs already have retry logic in code).

6. If the host is unreachable consistently, contact your DB provider (Supabase) or verify VPC/firewall rules.


## Key paths (backend)

- `backend/src/` — main NestJS application source (controllers, modules, services).
- `backend/src/prisma/` — Prisma integration service and client setup.
- `backend/prisma/postgres/` — PostgreSQL schema, migrations, and seeds.
- `backend/prisma/mongodb/` — MongoDB schema and seed scripts used for chat/messages.
- `backend/scripts/` — utility scripts for schema checks and maintenance.
- `backend/Dockerfile` — Docker image build for backend service.


