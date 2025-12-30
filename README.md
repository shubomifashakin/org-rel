# Org-Rel

A robust multi-tenant Role-Based Access Control (RBAC) API designed for comprehensive user-organization management. This NestJS-based application provides secure, scalable infrastructure for managing users, organizations, and permissions with fine-grained access control.

## Features

- Role-based access control
- Multi-tenant architecture
- Organization management
- User role assignment
- Project management within organizations
- User invitation and management

## Tech Stack

- NestJS
- PostgreSQL
- Redis (for caching and rate limiting)
- JWT (for authentication)
- TypeScript
- Docker (for containerization)
- Jest (for testing)
- Argon2 (for password hashing)
- Prisma (for database ORM)
- Resend (for email notifications)
- Winston (for logging)

## Directories

- [src/](src) - Main application source code
  - `common/` - Common utilities and shared code
  - `core/` - Core application logic and services
  - `middlewares/` - All middleware functions
  - `modules/` - Feature modules and route definitions
  - `types/` - TypeScript type definitions
  - `app.module.ts` - Main application module
  - `main.ts` - Server entry point

### Database

- [prisma/](prisma)
  - `migrations/` - Database migration files
  - `schema.prisma` - Prisma schema definition

## Getting Started

1. Clone the repository
2. Install dependencies: `npm install`
3. Set up environment variables (see `.env.example`)
4. Start the docker containers: `docker-compose up -d`
5. Run migrations: `npx prisma migrate dev`
6. Start the server: `npm run start:dev`

## Testing

- Run unit tests: `npm run test`
- Run e2e tests: `npm run test:e2e`
