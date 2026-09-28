# Cephas Books

A responsive React and TypeScript frontend for an AI-powered financial management platform.

## Run locally

```bash
npm install
npm run dev
```

## Render client-side routes

Page URLs use browser paths such as `/invoices` and `/trial-balance`. In the Render static-site dashboard, add a rewrite rule so direct links and refreshes load the SPA:

| Source | Destination | Action |
| --- | --- | --- |
| `/*` | `/index.html` | Rewrite |

Add this rule after any specific redirects or rewrites.

## Project structure

- `app` — app composition and configuration
- `assets` — images, icons, and fonts
- `components` — reusable UI components
- `features` — domain-specific modules
- `hooks` — reusable React hooks
- `layouts` — shared page shells
- `pages` — route-level screens
- `services` — API clients and external integrations
- `styles` — global styles and design tokens
- `types` — shared TypeScript definitions
- `utils` — pure utility functions

## Implementation status

This repository contains the interactive frontend described by the PRD. Financial posting, authentication, tenant isolation, persistent storage, OCR, notifications, payments, and AI execution require backend APIs before production use.
