# PeerConnect Frontend

PeerConnect is a student collaboration platform focused on:

- Study Groups
- Peer Tutoring
- Restricted Member management
- Profile and authentication flows
- AI and Support module placeholders for future expansion

This repository contains the React + Vite frontend application.

## Tech Stack

- React 19
- Vite 7
- React Router 7
- Azure MSAL (`@azure/msal-browser`, `@azure/msal-react`)
- Vitest + Testing Library
- Playwright (end-to-end)
- ESLint 9

## Project Structure

- `src/pages`: Route-level pages and dashboard modules
- `src/components`: Shared UI and layout components
- `src/styles`: Global, page-level, and component-level styles
- `src/utils`: Auth, profile sync, and utilities
- `src/__tests__`: Unit/integration tests
- `e2e`: End-to-end tests

## Main Application Flows

1. Authentication via MSAL and backend session/token integration
2. Dashboard with module switching between Study Groups, Peer Tutoring, and Restricted Members
3. Group lifecycle operations: create, join, leave, manage
4. Tutoring lifecycle operations: create class, join/leave, view feedback
5. Restricted member controls: search users, restrict, allow
6. Profile updates with avatar synchronization across dashboard modules

## Environment Configuration

Development API base URL is configured in `env.development`:

```env
VITE_API_BASE=http://localhost:8080
```

If you use a different backend origin, update this value before running locally.

## Local Development

Install dependencies:

```bash
npm install
```

Run development server:

```bash
npm run dev
```

Alternative startup script (Windows):

```bash
./start.bat
```

`start.bat` clears ports `5173` and `5174` before launching Vite.

## Available Scripts

- `npm run dev`: Start Vite dev server
- `npm run build`: Build production bundle
- `npm run preview`: Preview production build locally
- `npm run lint`: Run ESLint checks
- `npm run test`: Start Vitest in watch mode
- `npm run test:run`: Run Vitest once

## Testing

Unit/integration tests:

```bash
npm run test:run
```

End-to-end tests:

```bash
npx playwright test
```

## Deployment Notes

- SPA routing fallback is configured in `staticwebapp.config.json`
- Route rewrites point unknown routes to `index.html`
- Static assets are excluded from rewrite handling

## Additional Documentation

See [ProjectReference.md](ProjectReference.md) for detailed background, requirements, and architectural context.
