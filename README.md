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
   npm run db:deploy
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
| `npm test` | Unit tests (VAT, credit control, aging, commission, FIFO stock, roast yield) |
| `npm run db:migrate` | Create a migration after changing `prisma/schema.prisma` (development) |
| `npm run db:deploy` | Apply pending migrations (use this in production) |
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

## Upgrading a database created with `db push`

Databases created before migrations were introduced need a one-time baseline, then the
normal deploy:

```bash
npx prisma migrate resolve --applied 0_init
npm run db:deploy
```

The Phase 2 migration converts each historical visit that recorded a sale into a delivered
order with an invoice (and a cash payment if the visit was marked Paid).

## Order-to-cash flow

1. A rep places an order (from a visit or the Orders screen). Prices come from the customer's
   price list; only managers can change prices.
2. Credit check: orders for customers with overdue invoices, or that would take a credit
   customer over their limit, go on **credit hold** until a manager approves them.
   Cash-on-delivery customers are not limited by a credit amount.
3. Delivery: either a **delivery run** (below) or a direct delivery from a warehouse. Delivery
   takes the stock, issues the invoice (VAT backed out of VAT-inclusive prices; due after the
   customer's payment terms) and can record payment collected on delivery. Delivery is refused
   if there is not enough usable stock.
4. Payments (cash, MTN MoMo, Airtel Money, bank, cheque) are recorded against invoices.
   Balances and aging are always calculated from invoices and payments.

## Inventory and deliveries

- **Stock is tracked by batch** (lot) per warehouse, with roast date and best-before date.
  Every change is a row in an immutable stock ledger (`stock_movements`); batch balances can
  never go negative. Deliveries and roasting always use the **oldest usable batch first**
  (FIFO); expired batches are never used.
- **Receive Stock** (Inventory screen) records purchases and opening stock. Best-before
  defaults from the product's shelf life (Config → Products).
- **Roast runs** consume green coffee and produce finished products as a new batch numbered
  with the run (e.g. `RR-000012`). Implausible yields (outside 60–95%) are rejected.
- **Stock counts**: managers adjust a batch to the counted quantity with a reason.
- **Delivery runs** (Deliveries screen): warehouse staff group confirmed orders into a run for
  a driver and vehicle. Dispatching takes the goods out of the warehouse (refused if anything
  is short). The driver marks each stop delivered (invoice + payment collected) or failed.
  Completing the run returns failed stops' goods to the batches they came from and puts those
  orders back in the queue. The run shows the driver's collections by payment method for
  cash-up.

After upgrading an existing database, **record opening stock** (Inventory → Receive Stock)
before delivering orders: the migration creates a default "Main Warehouse" with no stock.

## Access rules

- **Admins and managers** see all reps' data and can change configuration and users.
  Only admins can manage admin accounts.
- **Sales officers** see only their own visits, deals, orders and invoices, plus their own and
  unassigned customers. Visits and orders they create are always recorded under their own name.
- **Delivery support** (warehouse staff) and managers receive stock, record roast runs, and
  plan, dispatch and complete delivery runs. Only managers adjust stock counts.
- **Drivers** see their own delivery runs and mark their stops delivered or failed. Drivers and
  delivery support also see all orders and invoices and can record payments.
- Deactivating a user or resetting their password signs them out everywhere immediately.
- Every change is recorded in the `audit_logs` table.
