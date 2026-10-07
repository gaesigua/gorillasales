# GorillaSales

Sales force automation and sales operations platform for a coffee roasting and distribution
business in Rwanda: field visit logging, customer management, sales pipeline, monthly targets,
reports and team administration.

Built with Next.js 15 (App Router, Server Actions), Prisma and PostgreSQL.

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start a PostgreSQL database, for example with Docker:

   ```bash
   docker run -d --name gorillasales-postgres -e POSTGRES_PASSWORD=postgres \
     -e POSTGRES_DB=gorillasales -p 5432:5432 postgres:16-alpine
   ```

3. Create `.env` from `.env.example` and fill in:

   | Variable | Purpose |
   | --- | --- |
   | `DATABASE_URL` | PostgreSQL connection string |
   | `JWT_SECRET` | Session signing secret, at least 32 characters (`openssl rand -base64 48`) |
   | `SEED_USER_PASSWORD` | Initial password for demo users created by the seed (min 10 chars) |

4. Create the tables and load demo data:

   ```bash
   npm run db:push
   npm run db:seed
   ```

   The seed refuses to run on a database that already has data. To wipe and reseed a
   **development** database, run `SEED_ALLOW_RESET=yes npm run db:seed`. Never run the seed
   against production.

5. Start the app on [http://localhost:4028](http://localhost:4028):

   ```bash
   npm run dev
   ```

   Sign in with a seeded account, e.g. `eric.m@gorillacoffee.rw` (manager) or
   `remmy.k@gorillacoffee.rw` (sales officer), using `SEED_USER_PASSWORD`.

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Development server on port 4028 |
| `npm run build` | Production build (fails on type errors) |
| `npm start` | Run the production build |
| `npm run type-check` | TypeScript check |
| `npm run db:push` | Sync the Prisma schema to the database |
| `npm run db:seed` | Load demo data |
| `npm run db:studio` | Browse the database |

## Project structure

```
prisma/              Schema and demo seed
src/app/(app)/       Signed-in screens; the group layout checks the session and loads org config
src/app/login/       Login page
src/actions/         Server Actions (mutations); every action re-checks session, role and tenant
src/lib/data/        Server-side data loaders used by pages
src/lib/tenant.ts    Session validation, role checks and per-user data scoping
src/lib/types.ts     Shapes shared between server and UI
```

## Access rules

- **Admins and managers** see all reps' data and can change configuration and users.
  Only admins can manage admin accounts.
- **Sales officers** see only their own visits and deals, plus their own and unassigned
  customers. Visits they log are always recorded under their own name.
- Deactivating a user or resetting their password signs them out everywhere immediately.
- Every change is recorded in the `audit_logs` table.
