# Personal Dashboard frontend

The frontend is a personal productivity dashboard for viewing calendar events, tasks, emails, projects, saved commands,
system information, and AI chat.
It is a React single-page application intended to connect to the companion FastAPI backend.

> Status: UI and test tooling are in this repository; a live backend URL and verified production deployment have not
> been confirmed.

## Features

- React views for dashboard overview, calendar, tasks, emails, projects, commands, and Gemini-powered chat.
- Google sign-in through the backend OAuth flow; the app keeps its JWT in browser local storage.
- Axios requests with bearer token injection and a configurable API base URL.
- AI chat history, file upload, and streaming over an authenticated WebSocket.
- Playwright browser tests and Vite production build.

## Tech Stack

- JavaScript ES modules and React 19.
- Vite development server and production bundler.
- Axios for HTTP requests; native WebSocket for AI token streaming.
- Playwright for browser-level end-to-end checks.

## Getting Started

### Prerequisites

- Node.js 20.x recommended. **[PLACEHOLDER: Set the exact tested Node.js patch version after validating CI/runtime.]**
- npm (lockfile is `package-lock.json`).
- A running backend for authenticated API use; optional mocked browser routes are available for isolated UI tests.

### Install and configure

From `frontend/`:

```bash
npm ci
```

Create `frontend/.env.local`:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
```

For a deployed frontend, set `VITE_API_BASE_URL` to the backend's HTTPS origin, for example
`https://YOUR-BACKEND.onrender.com`. This is a public frontend setting, not a secret. Never put database URLs, OAuth
client secrets, or API keys in `VITE_` variables.

### Run locally

Start the backend separately (see `../backend/README.md`), then run in `frontend/`:

```bash
npm run dev
```

Open the Vite URL shown in the terminal (normally `http://localhost:5173`).

## Usage

- The dashboard verifies a stored JWT with the backend and routes the user to Google sign-in when it is missing or
  invalid.
- Use the sidebar to switch between dashboard sections.
- The AI view uses `/dashboard/gemini/history`, `/dashboard/gemini/upload`, and WebSocket
  `/dashboard/gemini/stream?token=<JWT>`.

## API Documentation

The frontend API base URL is controlled by `VITE_API_BASE_URL`. API routes and Swagger documentation belong to the
backend at `/docs`.

| Purpose                | Backend route                                                                                    |
|------------------------|--------------------------------------------------------------------------------------------------|
| Sign-in and session    | `/dashboard/auth/google/login`, `/dashboard/auth/google/verify`, `/dashboard/auth/google/logout` |
| Calendar               | `/dashboard/calendar/events`                                                                     |
| Tasks                  | `/dashboard/todoist`                                                                             |
| Emails                 | `/dashboard/gmail`                                                                               |
| Projects               | `/dashboard/projects`                                                                            |
| Commands               | `/dashboard/commands`                                                                            |
| AI chat history/upload | `/dashboard/gemini/history`, `/dashboard/gemini/upload`                                          |
| AI streaming           | `/dashboard/gemini/stream` WebSocket                                                             |
| Server vitals          | `/dashboard/system/current`                                                                      |

**[PLACEHOLDER: Add screenshots/GIF from the running app, with user data and tokens removed.]**

## Design Decisions

- API origin lives in Vite environment configuration so local, test, and deployed builds can point to different backend
  environments.
- Authentication adds the bearer token centrally to HTTP calls; the WebSocket passes the JWT as a query parameter
  because browser WebSocket clients do not expose arbitrary headers.
- WebSocket events are typed JSON messages (`start`, `chunk`, `done`, `error`) so streaming chunks are distinguishable
  from completion and errors.
- The frontend does not connect directly to PostgreSQL or Redis. Sensitive database/cache credentials remain
  backend-only.

## Testing

Run the production bundle and lint checks from `frontend/`:

```bash
npm run build
npm run lint
```

Browser tests use Playwright:

```bash
npx playwright install chromium
npx playwright test
```

**[PLACEHOLDER: Add frontend test coverage results after the Playwright suite is corrected and run successfully.]**

## Deployment

Build with `npm run build`; Vite writes production assets to `dist/`. Deploy that directory using the selected static
hosting service and set `VITE_API_BASE_URL` to the deployed backend origin at build time.

**[PLACEHOLDER: Add the hosting provider, live URL, and CI/deploy procedure once chosen.]**

## Troubleshooting

- Requests go to the wrong server: confirm `VITE_API_BASE_URL`, then restart Vite or rebuild the deployed assets after
  changing it.
- Browser CORS errors: configure backend CORS origins to include the actual frontend origin.
- OAuth sign-in returns to the wrong page: set backend `FRONTEND_URL` and Google callback URL to the matching deployed
  URLs.
- AI WebSocket fails: use an HTTPS backend with WSS from an HTTPS page, ensure the JWT is present, and verify the
  backend route `/dashboard/gemini/stream`.
- Browser tests fail to launch: install Chromium with `npx playwright install chromium`.

## License

**[PLACEHOLDER: Add the project license and copyright holder.]**
