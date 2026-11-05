# Cephas Books

Responsive React and TypeScript client for Cephas Books. The sibling `CephasBooks-BE` repository supplies the NestJS API and PostgreSQL database.

## Run the complete local stack with Docker Desktop

1. Start Docker Desktop.
2. From this repository, run:

   ```powershell
   docker compose up --build
   ```

3. Open [http://localhost](http://localhost). The API is at [http://localhost:3000/api/v1](http://localhost:3000/api/v1), with API docs at [http://localhost:3000/docs](http://localhost:3000/docs).

Compose builds the backend from `../CephasBooks-BE`, runs its Prisma migrations, and keeps database data in the `cephas_postgres` Docker volume. To stop the stack, press Ctrl+C and run `docker compose down`. To remove the local database too, run `docker compose down -v`.

The default database password and JWT secrets are for local development only. You can override them in a root `.env` file using `POSTGRES_PASSWORD`, `JWT_ACCESS_SECRET`, and `JWT_REFRESH_SECRET`. To use the deployed backend instead, set `VITE_API_BASE_URL` in a frontend `.env` file and run the Vite commands below.

New accounts need email verification. For local registration, add `ZOHO_MAIL_API_URL`, `ZOHO_MAIL_API_TOKEN`, and `EMAIL_FROM` to the root `.env`; otherwise use an account already registered in the local database.

## Offline POS and sync

Sign in and load the POS catalog while connected so the register, shift, and products are available on the device. If the network drops during checkout, completed POS sales are saved in that browser's local outbox. The app displays the connection and pending sale count, then submits queued sales when connectivity returns. Each queued sale carries an idempotency key so retrying does not create duplicate sales. Pending sales are device and browser specific; keep that browser data until the pending count returns to zero.

The API and database run locally, so POS, sales, inventory, and the other API backed sections can be used without a connection to the hosted service. Offline checkout queues POS sales; other write actions still need a connection to the local API. External services such as email require internet access and their backend credentials.

## Run the frontend without Docker

```bash
npm install
npm run dev
```

By default, `.env.example` points to the hosted API. To use a local backend, create `.env` with:

```env
VITE_API_BASE_URL=http://localhost:3000/api
```

Start PostgreSQL and the API using the instructions in `../CephasBooks-BE/README.md`.

## Render client-side routes

For a Render static site, add this rewrite so direct links and refreshes load the SPA:

| Source | Destination | Action |
| --- | --- | --- |
| `/*` | `/index.html` | Rewrite |

## Project structure

- `src/app` — application composition and configuration
- `src/components` — reusable UI components
- `src/pages` — route-level screens
- `src/services` — API clients and offline POS outbox
- `src/styles` — global styles and design tokens
