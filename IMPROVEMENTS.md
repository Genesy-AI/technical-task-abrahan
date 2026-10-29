# Improvements v2

## 1. Bugs

- `POST /leads` reads `name`, the frontend sends `firstName`: every create returns 400.
- Lead update: frontend uses `PUT`, backend only exposes `PATCH`, and missing fields are stored as the string `"undefined"`.
- Frontend types are hand-written and drift from the schema (`lastName`/`email` nullable, wrong `LeadsCreateOutput`).
- `/leads/bulk` only dedupes against the database, so duplicates inside the same CSV are imported. No unique constraint exists, so concurrent imports also duplicate.
- `generateMessageFromTemplate` uses a string replacement: field values containing `$&` or `$1` corrupt the message.
- `GET /leads/:id` returns `200 null` for missing leads; `DELETE /leads/:id` with a missing or non-numeric id returns a generic 500.
- `backend/prisma/dev.db` and `frontend/.env` are tracked in git. `.env.sample` describes MySQL while the schema hardcodes SQLite.

## 2. Backend

### Architecture
- Split into layers so endpoints do not depend on Prisma:
  - Presentation: the HTTP API.
  - Domain: core business logic, unaware of any external provider.
  - Infrastructure: Prisma, Temporal and other provider implementations.
- Validate all input with Zod.
- Global error middleware mapping domain errors to HTTP status codes.

### Configuration
- Move port, Temporal address and task queue to environment variables, validated with Zod at startup.

### Temporal
- Reuse a single client connection instead of opening one per request.
- Run the worker as a separate process from the API.
- Use a deterministic workflow id per lead to prevent duplicate verifications.
- Make verification asynchronous: return `202` with a job id and expose its status (polling or SSE). This removes the per-lead request fan-out in the frontend.

### Data
- Deduplicate by email with a unique index.
- Batch writes with `createMany` / `$transaction` instead of per-row queries.
- Add pagination, filtering and sorting to `GET /leads`.

### Security
- Replace the hardcoded `*` CORS with the `cors` package and configured origins.
- Add `helmet`, a request body size limit and rate limiting.
- Add authentication.

### Operations
- Structured logging (e.g. pino) with request ids.
- `/health` endpoint and graceful shutdown (Prisma, worker).

## 3. Frontend

### Architecture
- Adopt [Feature-Sliced Design](https://feature-sliced.design).
- Split the ~350-line components: logic into hooks (`useLeadSelection`, `useVerifyEmails`), UI into reusable primitives (`Button`, `Modal`, `Dropdown`, `Table`, `Badge`).
- Remove `useApiMutation` (unused, heavily typed with `any`) and keep one data-fetching pattern with a query key factory.
- Replace inline SVGs with `@tabler/icons-react` (already installed, unused).
- Drop `lodash`; it is used for a single function.

### Design system
- Use Tailwind's built-in features properly and define the theme from the Figma design system, so components rely on semantic tokens instead of accumulating long, hardcoded class lists.
- Tailwind v4 ignores `tailwind.config.js`; define tokens with `@theme` in `index.css`.
- Remove hardcoded hex colors and duplicated classes (e.g. `Toaster`).

### UX and accessibility
- Use accessible primitives (Radix or Headless UI) for modals and dropdowns: focus trap, ESC, outside click, ARIA.
- Confirm before deleting.
- Replace emoji email status with accessible badges.
- Replace the full page reload on error with `refetch()`.
- Add an Error Boundary.
- Table: search, sorting, filtering, pagination and virtualization (TanStack Table / Virtual). Show the new lead fields.

## 4. Cross-cutting

- Monorepo (pnpm workspaces) with a `shared` package for Zod schemas, types and constants.
- OpenAPI docs generated from the Zod schemas.
- Testing: endpoint integration tests (supertest), component tests (Testing Library + MSW).
- Consistent formatting across the backend.
- `docker-compose` for Temporal, API and worker.
- CI running lint, typecheck and tests.
