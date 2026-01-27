# Backend for CoHost Platform

Node.js + Express API with PostgreSQL and Prisma ORM.

## Setup

```bash
npm install

# Set up environment variables
cp .env.example .env

# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate
```

## Development

```bash
npm run dev
```

Server runs on `http://localhost:3001`

## API Routes

- `POST /api/auth/signup` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/tasks` - List user tasks
- `POST /api/tasks` - Create task
- `PUT /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task
- `GET /api/listings` - List user listings
- `POST /api/listings` - Create listing
