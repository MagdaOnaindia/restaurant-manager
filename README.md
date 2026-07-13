# Restaurant Manager

A management platform for hospitality (restaurants and chains) with **split-the-bill by QR at the table**: each diner scans the QR, sees the bill, chooses what to pay (everything, an equal share, their own dishes or a custom amount) and pays from their phone. Staff see the payments in real time.

> The product targets the Spanish hospitality market, so the user-facing UI and emails are in Spanish (Bizum, EU allergen labelling, etc.). Code, comments and docs are in English.

## Apps

| App | What it is | Dev URL |
| --- | --- | --- |
| `apps/api` | REST API (NestJS + Prisma + PostgreSQL) | http://localhost:4000 |
| `apps/web` | Management back office + each restaurant's public page | http://localhost:3100 |
| `apps/pay` | Diner app: QR → bill → split → pay | http://localhost:3001 |
| `packages/shared` | Shared types, Zod schemas and constants | — |

## Getting started

Requirements: Node.js ≥ 20, pnpm ≥ 9, Docker Desktop.

```bash
pnpm install
docker compose up -d            # PostgreSQL (localhost:5433) + Mailpit (UI: http://localhost:8025)
cp .env.example apps/api/.env   # adjust if needed
pnpm db:migrate                 # Prisma migrations
pnpm dev                        # api (4000) + web (3100) + pay (3001)
```

First steps: sign up at http://localhost:3100/register (the verification email lands in Mailpit: http://localhost:8025), create your organization and your first restaurant, add zones and tables, create a menu and publish it.

### Demo account

To explore the product with realistic data without creating anything by hand:

```bash
node scripts/seed-demo.mjs
```

It creates the restaurant **La Parrilla de Ana** (menu, daily menu, tables, today's reservations and a
half-paid bill via QR) and prints ready-to-use credentials:

- Back office: http://localhost:3100/login — `demo@rms.local` / `demo1234`
- Public page: http://localhost:3100/r/la-parrilla-de-ana

## Screenshots

| Landing | Daily dashboard |
| --- | --- |
| ![Landing](docs/screenshots/01-landing.png) | ![Dashboard](docs/screenshots/02-dashboard.png) |

| Waiter floor view | A table's bill |
| --- | --- |
| ![Floor view](docs/screenshots/03-comandero.png) | ![Bill](docs/screenshots/04-cuenta-mesa.png) |

| Menu editor | Today's reservations |
| --- | --- |
| ![Menus](docs/screenshots/05-editor-carta.png) | ![Reservations](docs/screenshots/06-reservas.png) |

| Restaurant public page | Diner splits and pays (mobile) |
| --- | --- |
| ![Public page](docs/screenshots/07-pagina-publica.png) | ![Diner](docs/screenshots/08-comensal-cuenta.png) |

Regenerate the screenshots with `node scripts/screenshots.mjs` (requires the demo account).

## Features

**Management platform**
- Accounts with email verification and password reset (JWT + rotating refresh in httpOnly cookies).
- Organizations/chains with `OWNER` / `ADMIN` / `MANAGER` / `STAFF` roles and email invitations.
- Multiple restaurants per organization, with a selector in the back office.
- Zones and tables with a **printable QR** per table (sheet of cut-out cards).
- Menus: à la carte or fixed-price (daily menu), categories, priced items, photo, **EU-14 allergens**, tags and availability; **time-based validity** (seasons, days, time slots) resolved in the restaurant's timezone; full menu duplication.
- Reservations: shifts with per-slot pacing capacity, availability engine, staff and public bookings, email confirmation and cancellation.
- Public page `/r/[slug]` with the live menu and a reservation widget.

**Split payments (SplitPay)**
- Touch-friendly waiter view: floor plan, per-table bill with price snapshots, free-form lines.
- The diner scans the QR → sees the live bill (SSE) → pays **everything / an equal share / their dishes / a custom amount** + tip, no install and no sign-up.
- Item-level split with temporary claims (two people can't pay the same dish).
- Protection against simultaneous double payments and 100% server-side amount validation.
- Stripe Connect (Express): money goes straight to the restaurant's account; card, Apple/Google Pay and Bizum via Payment Element.
- Mixed payment (QR + cash), email receipts, history with tips and CSV export.
- **Demo mode**: with no Stripe keys, the full flow works via a simulated confirm button.

## Enabling real payments (Stripe test mode)

1. Create an account at [stripe.com](https://stripe.com) and copy the **test mode** keys.
2. In `apps/api/.env`: `STRIPE_SECRET_KEY=sk_test_…` and `STRIPE_PUBLISHABLE_KEY=pk_test_…`.
3. Local webhooks: install the [Stripe CLI](https://docs.stripe.com/stripe-cli) and run
   `stripe listen --forward-to localhost:4000/webhooks/stripe`; copy the `whsec_…` into `STRIPE_WEBHOOK_SECRET`.
4. Restart the API. In the back office → **Cobros** → "Configurar cobros con Stripe" (Express test onboarding).
5. Pay with the test card `4242 4242 4242 4242`. Bizum can be enabled from the Stripe Dashboard (Payment methods).

> If your Stripe account doesn't have Connect enabled yet, set `STRIPE_DIRECT_CHARGES=true` (dev only) to charge the platform account directly while you test.

## Commands

```bash
pnpm dev          # all three servers in watch mode
pnpm build        # production build (turbo)
pnpm typecheck    # TypeScript across every package
pnpm --filter @rms/api test:e2e   # 61 e2e tests (requires docker compose up)
pnpm db:studio    # Prisma Studio
```

## Architecture

- **One modular API** (NestJS): `auth`, `orgs`, `tables`, `menus`, `reservations`, `checks`, `payments` (Stripe), `split-pay` (diner). Per-organization tenancy with role guards.
- **Money always in cents** (integers). Payments confirmed by the **Stripe webhook** are the single source of truth for "paid".
- **Real time** over SSE (in-memory bus; swap for Redis pub/sub across multiple replicas).
- Emails via Nodemailer (Mailpit in dev; point `SMTP_*` at Resend/SES/etc. in production).

## Deployment (indicative)

- `web` and `pay` → Vercel (`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_PAY_URL`).
- `api` + PostgreSQL → Railway/Fly/Render (run `prisma migrate deploy` on release).
- Set `WEB_URL`, `PAY_URL`, `API_PUBLIC_URL`, fresh JWT secrets, real SMTP and Stripe keys (with the webhook pointing at `https://api…/webhooks/stripe`).
- Photo uploads: in production swap local storage for S3/R2 (single touch point: `apps/api/src/uploads`).
