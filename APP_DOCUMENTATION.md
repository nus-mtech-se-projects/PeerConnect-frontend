# PeerConnect Frontend — Full Application Documentation

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Project Structure](#3-project-structure)
4. [Pages](#4-pages)
5. [Components](#5-components)
6. [Services](#6-services)
7. [Utils](#7-utils)
8. [Strategies](#8-strategies)
9. [Factories](#9-factories)
10. [Authentication](#10-authentication)
11. [Routing](#11-routing)
12. [Styling](#12-styling)
13. [Testing](#13-testing)
14. [Deployment & Configuration](#14-deployment--configuration)
15. [Environment Configuration](#15-environment-configuration)
16. [Design Patterns & Architecture](#16-design-patterns--architecture)

---

## 1. Project Overview

**PeerConnect** is a centralized, secure peer tutoring and study group platform designed for NUS (National University of Singapore) students. The frontend is a React SPA (Single Page Application) deployed on Azure Static Web Apps.

### Core Features

| Feature | Description |
|---|---|
| **Study Groups** | Self-organized peer collaboration with shared goals and schedules |
| **Peer Tutoring** | 1:1 and group tutoring sessions, online or in-person |
| **AI Tutor** | AI-powered chatbot for course-related queries, quizzes, flashcards, and study plans |
| **Well-Being Resources** | Mental health support links, NUS counselling, and Singapore crisis helplines |
| **Restricted Member Management** | Block or allow users from participating in groups |
| **Group Chat** | Real-time group messaging with file attachment support |

---

## 2. Tech Stack

### Core

| Package | Version | Purpose |
|---|---|---|
| React | 19.2.0 | UI framework |
| React Router | 7.13.0 | Client-side routing |
| Vite | 7.x | Build tool and dev server |

### Authentication

| Package | Purpose |
|---|---|
| `@azure/msal-browser` | Microsoft OAuth via MSAL |
| `@azure/msal-react` | React bindings for MSAL |
| Azure Static Web Apps (SWA) | Built-in `/.auth/` authentication endpoints |

### Testing

| Package | Version | Purpose |
|---|---|---|
| Vitest | 4.0.18 | Unit and integration testing |
| React Testing Library | 16.3.2 | Component testing |
| `@testing-library/jest-dom` | 6.9.1 | DOM assertion matchers |
| Playwright | 1.58.2 | End-to-end testing |
| jsdom | 28.0.0 | DOM simulation for tests |

### Linting & Utilities

| Package | Purpose |
|---|---|
| ESLint 9 | Code linting |
| `eslint-plugin-react-hooks` | Hooks rules enforcement |
| `eslint-plugin-react-refresh` | Vite fast-refresh linting |
| `eslint-plugin-vitest` | Vitest-specific lint rules |
| `prop-types` | Runtime prop type checking |
| `wait-on` | Wait for services during e2e setup |

---

## 3. Project Structure

```
PeerConnect-frontend/
├── index.html                      # HTML entry point
├── package.json                    # Dependencies and scripts
├── vite.config.js                  # Vite + Vitest configuration
├── eslint.config.js                # ESLint rules
├── playwright.config.ts            # Playwright e2e configuration
├── staticwebapp.config.json        # Azure SWA routing rules
├── sonar-project.properties        # SonarQube code quality config
├── env.development                 # Dev environment variables
├── env.production                  # Production environment variables
├── start.bat                       # Windows dev startup script
│
├── src/
│   ├── main.jsx                    # React app entry point
│   ├── App.jsx                     # Root component with routes and auth init
│   ├── AuthConfig.js               # SWA auth endpoints and getSwaUser()
│   │
│   ├── auth/
│   │   └── msalConfig.js           # MSAL configuration for Microsoft OAuth
│   │
│   ├── pages/                      # Route-level page components
│   │   ├── Home.jsx
│   │   ├── Login.jsx
│   │   ├── Signup.jsx
│   │   ├── Profile.jsx
│   │   ├── ForgotPassword.jsx
│   │   ├── ChangePassword.jsx
│   │   ├── About.jsx
│   │   ├── GroupDetail.jsx
│   │   ├── GroupThread.jsx
│   │   ├── WellBeing.jsx
│   │   ├── AiTutor.jsx
│   │   └── __tests__/              # Page-level unit tests
│   │
│   ├── components/                 # Shared/reusable UI components
│   │   ├── Navbar.jsx
│   │   ├── Footer.jsx
│   │   ├── DashboardLayout.jsx
│   │   ├── PrivateRoute.jsx
│   │   ├── PublicRoute.jsx
│   │   ├── Carousel.jsx
│   │   ├── FeatureCard.jsx
│   │   ├── ConfirmDialog.jsx
│   │   ├── Toast.jsx
│   │   ├── PasswordCodeForm.jsx
│   │   ├── Icons.jsx
│   │   ├── __tests__/              # Component unit tests
│   │   └── chat/                   # Chat-specific components
│   │       ├── GroupChatContainer.jsx
│   │       ├── GroupChatPanel.jsx
│   │       ├── GroupChatWorkspace.jsx
│   │       ├── GroupChatMessageList.jsx
│   │       ├── GroupChatComposer.jsx
│   │       └── GroupChatsNavList.jsx
│   │
│   ├── services/
│   │   ├── groupChatService.js     # Group chat API calls
│   │   └── chatRefreshStrategies.js # Polling/noop refresh strategies
│   │
│   ├── utils/
│   │   ├── auth.js                 # API base URL, auth headers, token helpers
│   │   ├── profileSync.js          # Event-driven profile sync across dashboard
│   │   └── restrictedUsers.js      # Restricted member utilities
│   │
│   ├── strategies/
│   │   └── resourceStrategies.js   # Strategy pattern for well-being resources
│   │
│   ├── factories/
│   │   └── chatMessageViewModelFactory.js  # Chat message view model factory
│   │
│   ├── styles/
│   │   ├── global.css              # CSS variables, base styles, grid
│   │   ├── components/             # Per-component CSS files
│   │   └── pages/                  # Per-page CSS files
│   │
│   ├── assets/
│   │   └── images/                 # Static image assets
│   │
│   └── test/
│       └── setup.js                # Vitest global setup
│
├── e2e/                            # Playwright end-to-end tests
│   ├── helpers/
│   │   └── group-fixtures.ts       # Shared test helpers and fixtures
│   └── *.spec.ts                   # 18 e2e test spec files
│
└── coverage/                       # Generated test coverage reports
```

---

## 4. Pages

### Home.jsx — `/`
**Auth:** Private

The main dashboard after login. For unauthenticated users it renders the landing page with a carousel and feature cards.

**Dashboard Modules:**
- **Study Groups** — List, search, filter, create, and join study groups; group chat sidebar
- **Peer Tutoring** — Create or join tutoring courses; manage enrollments
- **Restricted Members** — Search and restrict/allow users from groups
- Profile avatar synced across all modules via `profileSync.js`

---

### Login.jsx — `/login`
**Auth:** Public (redirects authenticated users to `/`)

Login form with:
- Email/NUS ID and password fields
- Microsoft OAuth button (MSAL / SWA `/.auth/login/aad`)
- Links to forgot password and signup

---

### Signup.jsx — `/signup`
**Auth:** Public (redirects authenticated users to `/`)

Account creation form:
- Fields: NUS ID, full name, email, phone number, password, retype password
- Submits to `POST /api/auth/register`

---

### Profile.jsx — `/profile`
**Auth:** Private

User profile management:
- Faculty, major (NUS-specific tree), year of study, bio
- Avatar upload (PNG/JPEG, max 2MB) with dropzone
- Emits profile update events via `profileSync.js`

---

### ForgotPassword.jsx — `/forgot-password`
**Auth:** Public

Two-step password reset:
1. Enter NUS ID/email to receive reset code
2. Submit code + new password via `PasswordCodeForm`

---

### ChangePassword.jsx — `/change-password`
**Auth:** Private

Change password for authenticated users:
- Request code to registered email
- Submit code + new password via `PasswordCodeForm`

---

### About.jsx — `/contact`
**Auth:** Public

General about/contact information page for the platform.

---

### GroupDetail.jsx — `/group/:groupId`
**Auth:** Private

Detailed view for a specific study group:
- Members list with role badges (owner, admin, member)
- Session scheduling (create, view, delete sessions)
- Group settings editing (name, description, capacity)
- Transfer group ownership
- Dissolve group with confirmation dialog
- Owner/admin controls conditionally rendered

---

### WellBeing.jsx — `/wellbeing`
**Auth:** Public

Well-being and mental health resources rendered via `ResourceContext` (Strategy Pattern):
- **NUS Strategy** — Counselling, wellness programmes, crisis/emergency support
- **External Strategy** — Singapore community helplines, online platforms, specialised services

---

### AiTutor.jsx — `/ai-tutor`
**Auth:** Private

AI-powered tutoring chatbot:
- Conversational Q&A for course topics
- **Quiz generation** — 5 or 20 randomly chosen questions
- **Flashcard creation** — Key terms with definitions
- **Study plan generation** — 7-day personalised study plan
- **Topic suggestions** — Module-related topic recommendations

---

## 5. Components

### Layout & Navigation

| Component | Purpose |
|---|---|
| `Navbar.jsx` | Top navigation bar with logo, auth links, and responsive hamburger menu |
| `Footer.jsx` | Footer with brand, product, company, support links, and newsletter signup |
| `DashboardLayout.jsx` | Authenticated sidebar layout with module switching, user card, and logout |

### Route Guards

| Component | Behaviour |
|---|---|
| `PrivateRoute.jsx` | Checks `localStorage.accessToken`; redirects to `/login` if missing |
| `PublicRoute.jsx` | Redirects authenticated users away from auth pages back to `/` |

### UI Components

| Component | Purpose |
|---|---|
| `Carousel.jsx` | Auto-rotating slides with arrows and dot indicators (used on landing page) |
| `FeatureCard.jsx` | Displays a title and description for feature showcase cards |
| `ConfirmDialog.jsx` | Reusable modal confirmation dialog with custom labels and button colours |
| `Toast.jsx` | Success/error toast notification, auto-dismisses after 3.5 seconds |
| `PasswordCodeForm.jsx` | Reusable form for code verification + new password input |
| `Icons.jsx` | Exports SVG icons: Menu, Close, Groups, Tutoring, AI, Support, Restrict, WellBeing, Search, Plus |

### Chat Components (`src/components/chat/`)

| Component | Purpose |
|---|---|
| `GroupChatContainer.jsx` | Manages messages state, sender info, and polling refresh strategy |
| `GroupChatPanel.jsx` | Chat UI layout combining message list and composer |
| `GroupChatWorkspace.jsx` | Combines the chat nav list and chat panel into one workspace |
| `GroupChatMessageList.jsx` | Renders messages with sender names, timestamps, and attachment links |
| `GroupChatComposer.jsx` | Message input field with file attachment support |
| `GroupChatsNavList.jsx` | Sidebar list of accessible group chats for navigation |

---

## 6. Services

### `groupChatService.js`

API service layer for all group chat operations.

| Function | Description |
|---|---|
| `fetchAccessibleGroupChats()` | Fetch list of all accessible group chats |
| `fetchGroupChatSummaryByChatId(chatId)` | Fetch metadata for a specific chat |
| `fetchGroupChatMessagesByChatId(chatId)` | Load message history for a chat |
| `sendGroupChatMessageByChatId(chatId, content)` | Send a plain text message |
| `sendGroupChatMessageWithAttachmentByChatId(chatId, content, file, onProgress)` | Send message with file upload and progress callback |
| `fetchGroupChatAttachmentBlob(attachmentId)` | Fetch attachment binary data |
| `downloadGroupChatAttachment(attachment)` | Trigger browser download for an attachment |
| `fetchGroupChatSummary(groupId)` | Group-scoped chat summary |
| `fetchGroupChatMessages(groupId)` | Group-scoped message fetch |
| `sendGroupChatMessage(groupId, content)` | Group-scoped message send |

---

### `chatRefreshStrategies.js`

Implements a strategy pattern for chat auto-refresh behaviour.

| Function | Description |
|---|---|
| `createPollingRefreshStrategy(intervalMs)` | Polls for new messages at a set interval (default 8 seconds) |
| `createNoopRefreshStrategy()` | Manual refresh only; no automatic polling |
| `resolveChatRefreshStrategy(strategyName)` | Factory that resolves a strategy by name string |

---

## 7. Utils

### `auth.js`

| Export | Purpose |
|---|---|
| `API_BASE` | API endpoint from `import.meta.env.VITE_API_BASE` |
| `authHeaders()` | Returns `{ Authorization: "Bearer <token>" }` from localStorage |
| `validatePasswordCode(code, password, retypePassword)` | Validates password reset form fields |
| `waitForToken(timeoutMs)` | Polls localStorage until a valid JWT is present |

---

### `profileSync.js`

Event-driven profile synchronisation across dashboard modules.

| Export | Purpose |
|---|---|
| `extractAvatarUrl(entity)` | Extracts avatar URL from various API response shapes |
| `emitProfileUpdated(payload)` | Dispatches a `CustomEvent` with updated profile data |
| `subscribeProfileUpdated(handler)` | Subscribes to profile update events |

Avatar URL paths checked: `avatarUrl`, `avatar`, `profile.avatar`, `user.avatar`, etc.

---

### `restrictedUsers.js`

Utilities for restricted member management.

| Export | Purpose |
|---|---|
| `getRuMemberInitials(user)` | Returns user initials for display in avatar placeholder |
| `formatRestrictedUserName(user)` | Formats user's full display name |
| `loadRestrictedUsers(showToast)` | Fetches the restricted users list from the API |
| `executeRestrictionAction(...)` | Executes restrict or allow action against a user |
| `createAllowConfirmDialog(...)` | Builds the confirmation dialog config for allowing a user |

---

## 8. Strategies

### `resourceStrategies.js`

Implements the **Strategy Pattern** for contextual well-being resource rendering in `WellBeing.jsx`.

```
ResourceStrategy (abstract base)
├── getUserLabel()          → Audience label string
├── getUserDescription()    → Longer description string
└── getSections()           → Array of { title, cards[] }

NUSResourceStrategy (concrete)
└── Sections:
    ├── Counselling & Psychological Support (UCS, UHC, Peer Helpers)
    ├── Wellness Programmes (OSA workshops)
    └── Crisis & Emergency Support (24/7 Campus Security, Samaritans)

ExternalResourceStrategy (concrete)
└── Sections:
    ├── Online Platforms (MindSG, IMH)
    ├── Helplines (SOS 1767, IMH Emergency)
    └── Specialised Services (CHAT for ages 16-30)

ResourceContext
└── Wraps a strategy instance; delegates all calls to the current strategy
```

---

## 9. Factories

### `chatMessageViewModelFactory.js`

Transforms raw API message objects into presentation-layer view models.

**Output shape:**
```js
{
  id,
  senderName,
  senderEmail,
  content,
  attachment,     // { id, fileName, fileSize }
  sentAtLabel,    // Formatted as "DD/MM/YYYY HH:MM"
  sentAt,         // Raw Date object
  isMine          // Boolean: true if message belongs to current viewer
}
```

---

## 10. Authentication

### Authentication Architecture

PeerConnect uses **two authentication paths**:

| Path | Method | Used For |
|---|---|---|
| Native login | `POST /api/auth/login` | Email/password credentials |
| Microsoft OAuth | Azure SWA `/.auth/login/aad` | Microsoft account (MSAL) |

Both paths result in a JWT `accessToken` stored in `localStorage`.

---

### `AuthConfig.js`

| Export | Value |
|---|---|
| `SWA_LOGIN_URL` | `/.auth/login/aad` |
| `SWA_LOGOUT_URL` | `/.auth/logout` |
| `getSwaUser()` | Fetches `clientPrincipal` from `/.auth/me` |

**Azure Registration:**
- Tenant ID: `e7fd6993-e646-4b0e-a981-d38362d2d061`
- Client ID: `57cf3921-0d5b-4c96-9277-10a54818b823`
- No client-side secrets; all configured in Azure portal

---

### `auth/msalConfig.js`

MSAL configuration for personal Microsoft accounts:
- Authority: `https://login.microsoftonline.com/consumers`
- Scopes: `["User.Read"]`
- Cache location: `localStorage`
- Log level: `Warning`

---

### SWA OAuth Flow (`App.jsx`)

```
1. App loads → check localStorage.accessToken
2. If swaLoggingIn session flag is set:
   a. Call /.auth/me → get clientPrincipal
   b. POST /api/auth/microsoft → receive accessToken
   c. Retry up to 10 times (30s) for backend cold start
3. Store accessToken in localStorage
4. All API requests include Authorization: Bearer <token>
5. On logout: clear localStorage + call /.auth/logout
```

---

## 11. Routing

All page components are **lazy-loaded** with `React.lazy()` and wrapped in `<Suspense>`.

| Path | Component | Type | Auth |
|---|---|---|---|
| `/` | `Home` | Private | Required |
| `/login` | `Login` | Public | Redirects if logged in |
| `/signup` | `Signup` | Public | Redirects if logged in |
| `/forgot-password` | `ForgotPassword` | Public | None |
| `/contact` | `About` | Public | None |
| `/wellbeing` | `WellBeing` | Public | None |
| `/profile` | `Profile` | Private | Required |
| `/change-password` | `ChangePassword` | Private | Required |
| `/restrict-user` | Redirects to `/` with state | Private | Required |
| `/group/:groupId` | `GroupDetail` | Private | Required |
| `/ai-tutor` | `AiTutor` | Private | Required |
| `*` | Redirects to `/` | — | — |

**Route Guards:**
- `<PrivateRoute>` — Checks `localStorage.accessToken`; redirects to `/login` if missing
- `<PublicRoute>` — Redirects authenticated users away from auth-only pages

---

## 12. Styling

### CSS Architecture

**Global Styles** (`src/styles/global.css`):
- CSS custom properties (variables) for theming
- Base HTML/body reset
- Responsive `.page` container grid
- Breakpoints: 768px (mobile), 1024px (tablet)

**NUS Brand Colours:**
```css
--primary: #003D7C;     /* NUS Blue */
--accent:  #EF7C00;     /* NUS Orange */
```

**Full CSS variable set:**
```css
--bg, --surface, --surface2          /* Background layers */
--text, --muted                      /* Text colours */
--primary, --primary2, --primary3    /* NUS Blue variants */
--accent, --accent2, --accent3       /* NUS Orange variants */
--shadow, --shadow2                  /* Drop shadows */
--border                             /* Border with opacity */
```

---

### Page Styles (`src/styles/pages/`)

| File | Page |
|---|---|
| `Home.css` | Landing page, carousel, feature cards, dashboard layout |
| `Dashboard.css` | Sidebar, module nav, tiles, buttons, toasts |
| `Auth.css` | Login, signup, password forms |
| `Profile.css` | Profile form, avatar upload, dropzone |
| `About.css` | About page layout |
| `WellBeing.css` | Resource cards, badges, links |
| `GroupDetail.css` | Members list, sessions, group settings |
| `AiTutor.css` | AI chat interface, quiz/flashcard displays |

### Component Styles (`src/styles/components/`)

| File | Component |
|---|---|
| `AppShell.css` | Main layout shell |
| `Navbar.css` | Navigation bar, hamburger menu |
| `Carousel.css` | Slides, arrows, dot indicators |
| `Footer.css` | Footer grid layout |
| `RestrictUser.css` | Restricted members interface |

### Responsive Guidelines

- **Mobile-first**: Base styles for < 768px
- **Tablet**: Adjustments for 769px – 1024px
- **Desktop**: Full-width for 1025px+
- Layout: Flexbox and CSS Grid throughout

---

## 13. Testing

### Unit & Integration Tests (Vitest)

**Configuration** (`vite.config.js`):
- Environment: `jsdom`
- Setup file: `src/test/setup.js`
- Globals enabled
- Pattern: `src/**/*.test.{js,jsx}`

**Page Tests** (`src/pages/__tests__/`):

| File | Coverage |
|---|---|
| `About.test.jsx` | About page rendering |
| `AiTutor.test.jsx` | AI tutor chat and quiz flows |
| `ChangePassword.test.jsx` | Password change flow |
| `ForgotPassword.test.jsx` | Password reset flow |
| `GroupDetail.test.jsx` | Group detail actions |
| `Home.test.jsx` | Dashboard modules, landing page |
| `Login.test.jsx` | Login form, OAuth button |
| `Profile.test.jsx` | Profile form, avatar upload |
| `Signup.test.jsx` | Registration form |

**Component Tests** (`src/components/__tests__/`):

| File | Coverage |
|---|---|
| `Carousel.test.jsx` | Auto-rotation, navigation |
| `FeatureCard.test.jsx` | Card rendering |
| `Footer.test.jsx` | Links and layout |
| `Navbar.test.jsx` | Auth state, hamburger menu |
| `PrivaterRoute.test.jsx` | Redirect when unauthenticated |
| `PublicRoute.test.jsx` | Redirect when authenticated |

**Run commands:**
```bash
npm run test          # Watch mode
npm run test:run      # Single run with coverage
```

---

### End-to-End Tests (Playwright)

**Configuration** (`playwright.config.ts`):
- Base URL: `http://localhost:4173`
- Server: runs `npm run build && npm run preview` before tests
- Reuses existing server unless in CI

**18 Spec Files (`e2e/`):**

| File | Covers |
|---|---|
| `auth-guard.spec.ts` | Protected route redirect logic |
| `login.spec.ts` | Login form and credential validation |
| `signup.spec.ts` | Account creation flow |
| `change-password.spec.ts` | Password change with verification code |
| `forgot-password.spec.ts` | Password reset flow |
| `group-join.spec.ts` | Joining a study group |
| `group-leave.spec.ts` | Leaving a group with confirmation |
| `group-modify.spec.ts` | Editing group details |
| `group-session.spec.ts` | Scheduling group sessions |
| `group-email.spec.ts` | Group email notifications |
| `group-transfer.spec.ts` | Transferring group ownership |
| `group-member-management.spec.ts` | Member approval and removal |
| `peer-tutoring-dashboard.spec.ts` | Peer tutoring module |
| `restricted-member.spec.ts` | Restrict and allow users |
| `profile.spec.ts` | Profile management |
| `home.spec.ts` | Home dashboard rendering |
| `navigation.spec.ts` | Navigation between pages |
| `helpers/group-fixtures.ts` | Shared test helpers and fixture data |

**Test Helpers (group-fixtures.ts):**
- `authenticate()` — Simulate a logged-in session
- `setupAndGoto()` — Initialize environment and navigate
- `mockRoute()` — Mock API responses
- `createGroupData()` — Generate fixture group data
- Constants: `GROUP_ID`, `OWNER_USER_ID`, `CURRENT_USER_ID`

**Run command:**
```bash
npx playwright test
```

---

## 14. Deployment & Configuration

### Azure Static Web Apps (`staticwebapp.config.json`)

```json
{
  "navigationFallback": {
    "rewrite": "/index.html",
    "exclude": ["/assets/*", "/*.{css,js,svg,png,jpg,ico}", "/.auth/*"]
  }
}
```

- All unknown routes rewrite to `/index.html` — enables React Router client-side routing
- Static assets and `/.auth/*` endpoints are excluded from the rewrite

### SonarQube (`sonar-project.properties`)

Used for continuous code quality and security scanning in the CI pipeline.

### Build Scripts

```bash
npm run dev           # Start Vite dev server (hot reload)
npm run build         # Production build → dist/
npm run preview       # Preview production build locally on :4173
npm run lint          # Run ESLint
```

### Windows Dev Script (`start.bat`)

Clears ports 5173 and 5174 before starting the dev server — avoids port-in-use conflicts on Windows.

---

## 15. Environment Configuration

| Variable | Development | Production |
|---|---|---|
| `VITE_API_BASE` | `http://localhost:8080` | `https://peerconnect.azurestaticapps.net` |

Environment files:
- `env.development` — Used by `npm run dev`
- `env.production` — Used by `npm run build`

All `VITE_` prefixed variables are exposed to the browser via `import.meta.env.*`.

---

## 16. Design Patterns & Architecture

### Patterns Implemented

| Pattern | Location | Description |
|---|---|---|
| **Strategy** | `resourceStrategies.js` | Swap well-being resource context between NUS and External audiences |
| **Factory** | `chatMessageViewModelFactory.js` | Create normalised view models from raw API chat messages |
| **Observer** | `profileSync.js` | Broadcast profile updates across dashboard modules via `CustomEvent` |
| **Route Guard** | `PrivateRoute`, `PublicRoute` | Declarative access control for authenticated and public routes |
| **Lazy Loading** | `App.jsx` | Route-level code splitting with `React.lazy()` and `<Suspense>` |

### State Management Approach

No external state management library is used. State is handled at three levels:

| Level | Method |
|---|---|
| **Persisted session** | `localStorage` (access token, session flags) |
| **UI state** | React `useState` per component |
| **Cross-component events** | `CustomEvent` via `profileSync.js` |
| **URL state** | React Router route params (e.g., `/group/:groupId`) |

### Data Flow: Authentication

```
Login form submit
  → POST /api/auth/login
  → JWT accessToken returned
  → Stored in localStorage
  → authHeaders() attaches token to every API request
  → Logout: localStorage cleared + /.auth/logout called
```

### Data Flow: Group Chat

```
Component mounts
  → fetchAccessibleGroupChats() loads chat list
  → User selects a chat → fetchGroupChatMessagesByChatId()
  → createPollingRefreshStrategy(8000) begins polling
  → User sends message → sendGroupChatMessageByChatId()
  → Messages re-fetched and rendered via chatMessageViewModelFactory
```

### Data Flow: Profile Sync

```
User updates profile in Profile.jsx
  → emitProfileUpdated(payload) dispatches CustomEvent
  → All subscribed dashboard modules (Home.jsx, DashboardLayout.jsx)
    receive event and update avatar/name display
```
