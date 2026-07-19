# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Piccol is an e-commerce project built as a Node.js/Express portfolio piece showcasing a strict layered
backend architecture. The backend is the actively developed part; the frontend (React + Vite) is currently
just the Vite scaffold and is **not** the focus of work — do not add frontend features unless explicitly
asked.

There is an `AGENTS.md` at the repo root that is the single source of truth for architecture rules on this
project — read it. The summary below reflects it plus details found in the actual code.

## Commands

All commands run from `backend/` unless noted.

```bash
npm run dev     # nodemon with debugger on 0.0.0.0:9229, starts server.js
npm test        # jest (test files live in backend/__tests__/*.test.js)
npm test -- authService.test.js   # run a single test file
npm run lint    # eslint . --fix
```

Whole stack (MySQL, phpMyAdmin, backend, backend test runner, frontend) via Docker Compose from the repo
root:

```bash
docker compose up            # db, phpmyadmin (8080), backend (5001->5000, debug 9229), frontend (3000)
docker compose run --rm test_backend   # runs `npm test` in a container against the dockerized db
```

DB host is `db` inside Docker, `localhost` from the host machine, port `3306`. Sequelize config is in
`backend/config/config.json` (currently only a `development` block, root/rootpassword/mydatabase).

Sequelize CLI (run from `backend/`):

```bash
npx sequelize-cli db:migrate
npx sequelize-cli db:seed:all
```

Required env vars (see `backend/.env.example`): `JWT_SECRET`, `SHOW_ROUTES`, `MAX_FILE_SIZE` (MB, business
limit for uploaded images), `MAX_FILE_HARD_SIZE` (MB, multer hard limit — currently hardcoded to 10 in
`uploadMiddleware.js`/`handleMulterErrorsMiddleware.js` rather than actually read from this var).

## Architecture

### Layering (enforced by convention, see AGENTS.md)

`routes/` → `controllers/` (HTTP only: parse input, call services, format response) → `services/`
(business logic, DB transactions) → `models/` (Sequelize). Controllers are grouped by domain directory
(`controllers/user/`, `controllers/customer/`, `controllers/product/`). Never put business logic in a
controller — extend or add a service instead. `classes/` holds custom Error subclasses (e.g.
`InvalidImageTypeError`); user-facing strings (validation messages, API errors) are in Italian, code and
comments are in English.

### Two parallel identity models

There are two separate authenticated entities with independent tables, routes and controllers — they are
**not** a shared "User" hierarchy:

- **User** (`models/user.js`) — internal/admin accounts, `level` enum `admin`/`superadmin`, mounted at
  `/admin/user` (see `routes/adminRoutes.js` → `routes/userRoutes.js`). `authUserMiddleware` protects these
  routes and attaches `req.user`.
- **Customer** (`models/customer.js`) — storefront customers, mounted at `/` (`routes/customerRoutes.js`).

Both share the same auth mechanics via `services/authService.js` (`authenticate(entityModel, email,
password)`) and `services/registerService.js` (`registerEntity(entityModel, userData, tokenPayloadFields)`)
— generic functions parameterized by Sequelize model, reused across both domains. Do not duplicate
login/register logic per-entity; extend these shared services instead.

**Token invalidation pattern**: JWTs are stateful. On login/register, the signed token is also written to
the entity's `current_token` column. `authUserMiddleware` decodes the JWT *and* checks it matches
`current_token` in the DB — this is what makes logout / password-change invalidate old tokens (logout sets
`current_token = null`; password/2FA-style flows should do the same for any entity whose credentials
change).

### Response and error conventions

`middlewares/responseFormatter.js` runs first in the app.js chain and monkey-patches `res.success(data,
message, code)` / `res.error(code, message, err)` onto every response — controllers and route handlers use
these instead of raw `res.json`. `res.error` logs via Winston (`config/logger.js`, writes to
`backend/logs/`) whenever an `Error` instance is passed. `middlewares/errorMiddleware.js` is the last
middleware in `index.js` and is the catch-all `next(err)` handler (also normalizes JSON body-parse
SyntaxErrors to a 400). `middlewares/noPathMiddleware.js` handles unmatched routes (404). Always resolve
errors through this res.success/res.error pair rather than inventing a new response shape.

### Validation error accumulation pattern

Multer-based file upload validation doesn't fit express-validator's model, so this codebase accumulates
errors on `req.validationErrors` (an array of `{ msg, path, filename?, isFatal? }`) across multiple
middlewares, then merges them with express-validator's own errors in
`middlewares/validationHandlerMiddleware.js`, which groups them by field (image errors are grouped by
filename) before calling `res.error(400, ...)`. The chain for product image upload
(`routes/productRoutes.js`) is: `uploadMiddleware` (mimetype filter, hard size limit) →
`handleMulterErrorsMiddleware` (catches MulterError, e.g. hard-limit overflow, flags it `isFatal`) →
`validateProductImageMiddleware` (business-level size limit from `MAX_FILE_SIZE`, dimension check against
`config/imageConfig.js` maxWidth/maxHeight via the `image-size` package, cleans up temp files on failure) →
express-validator field checks → `validationHandlerMiddleware`. When adding new upload-adjacent validation,
push onto `req.validationErrors` rather than throwing, so it merges into the same grouped error response.

### Data model

`User` –< `Product` (`createdBy` FK, `as: 'creator'`). Migrations already exist for `categories`,
`product_images`, and a product↔categories join table (`backend/migrations/2025120423*`), but there are no
corresponding Sequelize models/associations yet — if asked to work on categories or product images, you'll
need to add the models first. `models/index.js` auto-loads every `*.js` file in `models/` (excluding
`.test.js`) and wires up `.associate` — new models just need to be dropped in that directory.

### Known incomplete piece

`controllers/product/productController.js#createProduct` is a stub (`return res.success({})`) even though
its full route (`POST /products/new`) already wires up auth, image upload/validation, and field validation
— the actual product-creation logic (and category/product_images handling) has not been implemented yet.

### Route mounting (`backend/index.js`)

`/` → customer routes, `/admin` → admin routes (currently only `/admin/user`), `/products` → product
routes, plus `listRoutes` (debug route listing, gated behind `SHOW_ROUTES=true` env var, only meaningful
outside production).