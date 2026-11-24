# Cephas Books

Responsive React and TypeScript client for Cephas Books. The sibling `CephasBooks-BE` repository supplies the NestJS API and PostgreSQL database.

PS C:\Users\akind\Desktop\CephasBOOKS-Project\CephasBooks-BE> 
access the BE from here  for all end to  end wiring.

make sure  that all fixes and implementation are all mobile and tablet and all screen responsive..also be sure that offine compactibility are well check

Audit the last implementationand check for any gap, error or inconsistency and fix them neatly


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

## Offline access and sync

After a successful online sign-in, accept the local-use prompt to save an offline password verifier and your profile in this browser. Your saved sign-in survives closing and reopening the browser. Sign in with the same email and password while disconnected. Pages and records are available offline after they have loaded successfully on this device; open the areas you need while online first. The app is installable, and supported browsers offer an **Add app shortcut** button.

Changes submitted while offline are kept in this browser's pending queue. When connectivity returns, Cephas Books asks before sending queued changes to the cloud; it never syncs them automatically. Review the pending count before clearing browser data or switching devices. Offline-created records may not appear in other cached screens until a successful sync and refresh. Email, SMS, payment providers, and external commerce integrations require connectivity. Local browser storage is specific to the browser profile and is not a substitute for a managed local database or a separate backup.

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
