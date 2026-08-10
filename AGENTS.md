# Project Context: "PICCOL" (E-Commerce Backend Portfolio)

This file is the **SINGLE SOURCE OF TRUTH** for AI Agents working on this project.
The goal is to showcase Senior-Level Node.js skills using a strict Layered Architecture.

## 1. Tech Stack
- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** MySQL (v8.0 via Docker)
- **ORM:** Sequelize (v6.x)
- **Testing:** Jest
- **Architecture:** Controller-Service-Repository pattern
- **Environment:** Docker & Docker Compose

## 2. Directory Structure & Rules (STRICT)
All backend code is located in `/backend`.

### Core Layers
- `/backend/controllers/**`: **HTTP Layer only.**
    - **Rule:** Controllers are grouped by domain (e.g., `/user`, `/customer`, `/product`). Respect this nesting.
    - **Responsibility:** Validate inputs, call Services, handle HTTP responses. NO core business logic here.
- `/backend/services`: **Business Logic Layer.**
    - **Rule:** All complex logic (calculations, database transactions) goes here.
    - **Naming:** `[Entity]Service.js` (e.g., `authService.js`).
- `/backend/models`: **Data Layer.**
    - Sequelize models definition.

### Support Structures
- `/backend/classes`: Use this for Custom Errors (e.g., `InvalidImageTypeError`) or Utility Classes.
- `/backend/middlewares`: Reusable middleware.
    - **IMPORTANT:** Always check this folder before writing new validation logic.
    - Use `responseFormatter.js` for consistent JSON responses.
    - Use `errorMiddleware.js` for global error handling.
- `/backend/routes`: Express routers. Grouped by domain.
- `/backend/__tests__`: All Jest test files reside here.

## 3. Environment & Networking
- **Configuration Source:** REFER to `docker-compose.yml` for service names/ports.
- **DB Connection:**
    - Hostname inside Docker: `db`
    - Hostname from Host Machine: `localhost`
    - Port: `3306`
- **Backend Port:** Internal `5000`, Exposed `5001`.

## 4. Coding Standards (Interview Quality)
- **Service Pattern:** Never write business logic inside a Controller. Always create or extend a Service.
- **Async/Await:** Mandatory. Avoid callback hell or raw Promise chains.
- **Error Handling:**
    - Throw custom errors from Services.
    - Catch them in Controllers (or let `async-handler` do it) and pass to `next(err)`.
    - **NEVER** use `console.log` for errors in production code.
- **Language:**
    - **Code/Comments:** English.
    - **User-facing Strings:** Italian (e.g., error messages returned to the client).

## 5. Existing Utilities (Reuse these!)
Do not reinvent the wheel. The project already contains:
- `responseFormatter.js` -> Use this to wrap successful responses.
- `uploadMiddleware.js` / `handleMulterErrorsMiddleware.js` -> For file uploads.
- `validateProductImageMiddleware.js` -> For image validation.

## 6. Frontend Context (Status: ON HOLD)
The frontend is located in `/frontend` but is currently **NOT the focus**.
However, keep these integration rules in mind while building the Backend:
- **Stack:** React + Vite.
- **Role:** Single Page Application (SPA) consuming the Backend REST API.
- **Communication:**
    - The Backend must serve **pure JSON** (No Server-Side Rendering).
    - **CORS:** The backend must allow requests from `http://localhost:3000`.

## 7. Data Design & Trade-off Protocol

Before creating or modifying a Sequelize model, or writing any Service method
that touches shared/mutable data, check these 5 categories. If one applies,
STOP and present 2 options with pros/cons in the response — do NOT implement
a solution directly without an explicit decision from the developer.

1. **Time** — Could this field be referenced elsewhere as if it were fixed,
   while actually changing later? (e.g. product price referenced by past
   orders → snapshot vs live reference)
2. **Deletion** — What breaks elsewhere if this row is deleted? (e.g. a
   deleted address referenced by an order → copy fields, don't rely on FK only)
3. **Concurrency** — What happens if two requests touch this data at the
   same instant? (e.g. last item in stock → use a Sequelize transaction
   with row locking: `transaction.LOCK.UPDATE`)
4. **Duplication** — What happens if this operation (payment, order
   creation) arrives twice? (idempotency check needed)
5. **State** — Can this record jump between states without passing through
   intermediate ones? (define allowed transitions explicitly in the Service)

### Rule: no implementation without explicit choice
When one of the categories above applies, do not silently pick the solution
that seems best. Present the trade-off, wait for an explicit choice, then implement.

## 8. Design Decisions Log

(append here every time a trade-off above gets resolved, with the reason —
keep entries short, one line each)

- `OrderItem.price` is a snapshot at purchase time, not a live reference to
  `Product.price` — prevents past orders from being rewritten if a product
  price changes later.
- `services/authContract.ts` (TypeScript migration, Fase 2.4): kept the
  runtime `assertAuthCompatible` check **alongside** the new static generic
  constraint (`TInstance extends Model & AuthCompatibleAttributes` on
  `authenticate`/`registerEntity`), instead of relying on types alone —
  static types don't protect call sites still in `.js` during the
  incremental migration, nor values typed `any` (e.g. `models/index.ts`'s
  model dictionary), so the runtime check stays as a low-cost defense until
  the whole call chain is TypeScript with no `any` in between.