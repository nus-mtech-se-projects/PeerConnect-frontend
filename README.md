# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## GitHub Packages And Dependency Security Setup

This project is configured to install npm packages from GitHub Packages for the scope `@nus-mtech-se-projects`.

### Repository Secrets

Add these secrets in GitHub: `Settings` -> `Secrets and variables` -> `Actions`.

- `AZURE_STATIC_WEB_APPS_API_TOKEN_SALMON_ISLAND_0F8625F00`
  - Required by `.github/workflows/azure-static-web-apps-salmon-island-0f8625f00.yml` for deployment.
- `NODE_AUTH_TOKEN` (optional for workflows in this repo)
  - Workflows currently use `${{ secrets.GITHUB_TOKEN }}` by default.
  - Add `NODE_AUTH_TOKEN` only if you need a custom token (for example cross-repo private package access).

### GitHub Packages Scope

The following files are configured for GitHub Packages:

- `.npmrc`
- `.github/workflows/azure-static-web-apps-salmon-island-0f8625f00.yml`
- `.github/workflows/dependency-security.yml`

Configured scope:

- `@nus-mtech-se-projects`

### Local Development Access

For local installs of private GitHub Packages, export a GitHub token with `read:packages`:

```bash
export NODE_AUTH_TOKEN=<your_github_personal_access_token>
npm ci
```

### Security Workflows

- `.github/workflows/dependency-security.yml`
  - Runs Dependency Review on pull requests.
  - Runs `npm audit --audit-level=high` on pushes and pull requests.

- `.github/workflows/azure-static-web-apps-salmon-island-0f8625f00.yml`
  - Builds with `npm ci --ignore-scripts` and `npm run build` before Azure deployment.
