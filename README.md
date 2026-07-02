# Restaurant Manager

Plataforma de gestión para hostelería (restaurantes y cadenas) con cobro dividido por QR en mesa.

- **apps/api** — API REST (NestJS + Prisma + PostgreSQL).
- **apps/web** — Backoffice de gestión y página pública de cada restaurante (Next.js, puerto 3000).
- **apps/pay** — App del comensal: escanear QR, ver la cuenta, dividir y pagar (Next.js, puerto 3001).
- **packages/shared** — Tipos, esquemas Zod y constantes compartidas.

## Requisitos

- Node.js ≥ 20, pnpm ≥ 9
- Docker Desktop (PostgreSQL y Mailpit)

## Puesta en marcha

```bash
pnpm install
docker compose up -d          # PostgreSQL (localhost:5433) + Mailpit (UI en http://localhost:8025)
cp .env.example apps/api/.env # y ajustar si hace falta
pnpm db:migrate               # migraciones Prisma
pnpm dev                      # levanta api (4000), web (3000) y pay (3001)
```

- API: http://localhost:4000/health
- Backoffice: http://localhost:3000
- App de pago: http://localhost:3001
- Emails de desarrollo (Mailpit): http://localhost:8025

## Comandos útiles

```bash
pnpm typecheck   # TypeScript en todos los paquetes
pnpm test        # tests
pnpm db:studio   # Prisma Studio
```
