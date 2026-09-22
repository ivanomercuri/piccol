# Project Context: "PICCOL" (E-Commerce Backend Portfolio)

This file is the **SINGLE SOURCE OF TRUTH** for AI Agents working on this project.
The goal is to showcase Senior-Level Node.js skills using a strict Layered Architecture.

## 1. Tech Stack
- **Runtime:** Node.js 24.9+ (required: NestJS 12 packages are ESM-only, and Jest can load them only on 24.9+ with `--experimental-vm-modules`)
- **Framework:** NestJS 12 on Express (`@nestjs/platform-express`). Migrated from plain Express in phases F0–F5 (see `backend/docs/MIGRAZIONE-NESTJS.md`); no Express router is left, every route is a NestJS controller.
- **Database:** PostgreSQL (v16 via Docker)
- **ORM:** Prisma 7 (schema in `backend/prisma/schema.prisma`)
- **Testing:** Jest
- **Architecture:** Controller-Service-Repository pattern
- **Environment:** Docker & Docker Compose

## 2. Directory Structure & Rules (STRICT)
All backend code is located in `/backend`.

### Core Layers
- `/backend/modules/<domain>`: **NestJS domain modules** — `*.module.ts`, `*.controller.ts`, `*.service.ts`, `dto/`.
  Domains: `customer`, `user`, `product` (with `upload/` for the image upload pipeline); `auth` holds the security
  logic shared by both identities (`CredentialsService`, `JwtUserStrategy`, `AuthUserGuard`, `@CurrentUser()`).
    - **Controllers — HTTP layer only.** Declare route, guards, DTOs and status code; return the data and let
      exceptions propagate. NO business logic, no try/catch to translate errors.
    - **Services — business logic layer.** All complex logic (calculations, database transactions) goes here.
      Database access through the injected `PrismaClient`.
- `/backend/prisma`: **Data Layer.**
    - `schema.prisma` is the single source of truth for the data model; the typed
      client is generated from it. There is no `models/` directory anymore, and no
      hand-written model classes: add or change a model in the schema, then create a
      migration (`npx prisma migrate dev --name <name>`).
    - `client.ts` exports the shared `prisma` instance; `prisma.module.ts` provides it under the `PrismaClient`
      injection token. NestJS code injects `PrismaClient` in the constructor; only code outside the container
      (seeds, `*.model.test.ts`) imports `client.ts`. Never instantiate a second `PrismaClient`.

### Support Structures
- `/backend/common`: NestJS cross-cutting infrastructure — `filters/` (`AllExceptionsFilter`, the single error
  handler), `interceptors/`, `decorators/`, `logger/`, `validation/`, and `middleware/` for the one Express-level
  middleware (`json-syntax-error.middleware.ts`: a 4-argument Express error handler, which a NestJS middleware
  cannot be). Files follow the Nest naming convention (`*.filter.ts`, `*.interceptor.ts`, `*.middleware.ts`).
- `/backend/config`: environment validation (`env.validation.ts`), database URL, Winston logger, image limits.
- `/backend/services`: only `emailNormalizer.ts`, a pure function shared by the identity services.
- `/backend/types`: ambient type augmentation (`req.user`).
- Root of `/backend`: `main.ts` (bootstrap), `app.module.ts`, `app.setup.ts` (Express middleware shared by
  `main.ts` and the e2e tests), `health.controller.ts`.
- `/backend/__tests__`: All Jest test files reside here.

## 3. Environment & Networking
- **Configuration Source:** REFER to `docker-compose.yml` for service names/ports.
- **DB Connection:**
    - Hostname inside Docker: `db`
    - Hostname from Host Machine: `localhost`
    - Port: `5432`
- **Backend Port:** Internal `5000`, Exposed `5001`.

## 4. Coding Standards (Interview Quality)
- **Service Pattern:** Never write business logic inside a Controller. Always create or extend a Service.
- **Async/Await:** Mandatory. Avoid callback hell or raw Promise chains.
- **Error Handling:**
    - Throw NestJS `HttpException`s (`BadRequestException`, `ConflictException`, ...) from services, guards
      and pipes, with an Italian message; `AllExceptionsFilter` formats them.
    - Let unexpected errors propagate: the filter answers 500 with a generic message and logs the details.
    - **NEVER** use `console.log` for errors in production code.
- **Language:**
    - **Code/Comments:** English.
    - **User-facing Strings:** Italian (e.g., error messages returned to the client).

## 5. Existing Utilities (Reuse these!)
Do not reinvent the wheel. The project already contains:
- Response format: return the data from a controller (`ResponseEnvelopeInterceptor` wraps it) and throw `HttpException`s (`AllExceptionsFilter` formats them). Success messages: `@ResponseMessage()`.
- Validation: DTOs with class-validator; error shape from `common/validation/validation-exception.factory.ts`.
- Authentication: `@UseGuards(AuthUserGuard)` + `@CurrentUser()` from `modules/auth/`.
- Transactions: a nested write (`create` with `images: { create: ... }`) is already atomic; use an interactive
  `prisma.$transaction(async (tx) => ...)` only when application code or a lock sits between the writes, and
  then run **every** query through `tx`. Examples: `ProductService.create` (advisory lock + duplicate check),
  `UserAuthService.register` / `CustomerAuthService.register` (the token needs the new id).
- Image uploads: `ProductImageUploadInterceptor`, `ProductImageValidator` and `NewProductFormPipe` in `modules/product/upload/`; everything about the `uploads/` folder (public URL, deleting files) is in `uploaded-files.ts`. Read image dimensions ONLY through `readImageDimensions` (`image-inspection.ts`), never by calling `image-size` directly: it has unpatched DoS vulnerabilities in parsers the magic-byte check keeps out.

## 6. Frontend Context (Status: ON HOLD)
The frontend is located in `/frontend` but is currently **NOT the focus**.
However, keep these integration rules in mind while building the Backend:
- **Stack:** React + Vite.
- **Role:** Single Page Application (SPA) consuming the Backend REST API.
- **Communication:**
    - The Backend must serve **pure JSON** (No Server-Side Rendering).
    - **CORS:** The backend must allow requests from `http://localhost:3000`.

## 7. Data Design & Trade-off Protocol

Before creating or modifying a Prisma model, or writing any Service method
that touches shared/mutable data, check these 5 categories. If one applies,
STOP and present 2 options with pros/cons in the response — do NOT implement
a solution directly without an explicit decision from the developer.

1. **Time** — Could this field be referenced elsewhere as if it were fixed,
   while actually changing later? (e.g. product price referenced by past
   orders → snapshot vs live reference)
2. **Deletion** — What breaks elsewhere if this row is deleted? (e.g. a
   deleted address referenced by an order → copy fields, don't rely on FK only)
3. **Concurrency** — What happens if two requests touch this data at the
   same instant? (e.g. last item in stock → use an interactive Prisma
   transaction, `prisma.$transaction(async (tx) => ...)`, with an explicit
   row lock via raw SQL `SELECT ... FOR UPDATE` where needed)
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
  **Superseded by the Prisma migration** (see the entry below): the runtime
  check was removed along with `authContract.ts`, because both of the reasons
  that justified it — `.js` call sites and the `any`-typed model dictionary —
  disappeared with the Sequelize model loader.
- Auth abstraction after the Sequelize -> Prisma migration: the generic
  `authenticate(entityModel, ...)` was replaced by explicit
  `authenticateUser`/`authenticateCustomer` (and the same for registration).
  The shared logic was NOT duplicated — what changed is *what* is shared: no
  longer the generic model, but the already-fetched entity
  (`completeAuthentication`, `issueTokenFor`), leaving only the query specific
  to each entity. Rejected alternatives: a structural generic over Prisma
  delegates (would keep a generic that costs more than it returns, since each
  delegate is already precisely typed), and keeping a runtime contract check via
  Prisma's DMMF (would require passing the model name by hand alongside the
  delegate, creating a new way to get it wrong that did not exist before).
- Soft delete (`deletedAt` on `Category` and `ProductImage`) is **not
  implemented** after dropping Sequelize's `paranoid: true`. Prisma has no
  native equivalent, and no application code deletes those rows today —
  verified. The columns stay in the schema, documented as unmanaged, and the
  decision is deferred to when a real delete feature exists. Rejected
  alternatives: manual `deletedAt: null` filters everywhere (must be remembered
  in every future query, for a case that does not exist yet) and a Prisma Client
  Extension (the hidden state this project deliberately rejected for email
  normalization, and delicate to write correctly for every operation).
- `SequelizeMeta` was dropped and migrations moved to Prisma Migrate (baseline
  `0_init`, marked as already applied since the database already had the
  schema and the data). Keeping both migration systems in the repo would have
  left it ambiguous which one was authoritative; the old migration history
  remains readable in git.
- Email case-sensitivity (MySQL -> PostgreSQL migration): emails are
  normalized to lowercase **in the application layer**
  (`services/emailNormalizer.ts`), applied explicitly at every read and write
  site, while `Category.name` and `Product.sku` stay case-sensitive — a
  per-column decision rather than a uniform one, because only emails are
  semantically case-insensitive by nature. Rejected alternatives: a blanket
  lowercase on all four unique columns (would flatten a category's display
  casing and SKU codes, which are conventionally exact identifiers), and
  PostgreSQL's `citext` type (keeps the DB as the single enforcement point,
  but is dialect-specific, has no native Sequelize `DataTypes` mapping, and
  would make the model definition stop reflecting the real column type).
  An explicit function was preferred over a Sequelize `beforeSave` hook: the
  hook would not cover the login's `findOne`, and it would turn the rule into
  hidden state in a project that uses no hooks anywhere else.
- Duplicate email on registration and profile update (User and Customer,
  NestJS migration F3): the unique-constraint violation (Prisma P2002) is
  translated into `409 Email già registrata` by `rejectDuplicateEmail`,
  instead of a generic 500. The error is caught **after** the write rather
  than checked with a `findUnique` beforehand: a pre-check is racy (two
  concurrent registrations would both see the email as free), so the database
  constraint stays the only arbiter. Only the error code is checked, because
  with the Prisma 7 `pg` driver adapter `meta.target` is absent. Rejected: the
  generic 500 (a normal, expected case reported as an unexpected failure and
  logged as one).
- Failed login (both identities, F3): a single `401 Credenziali non valide`
  for unknown email and wrong password, and bcrypt runs against a dummy hash
  when the account does not exist, so neither the message nor the response
  time reveals which emails are registered. Accepted trade-off: registration
  still reveals it through the 409 above; the login endpoint is the one
  targeted by credential stuffing, where knowing valid accounts helps most.
- Password change invalidates the current token (F3): new password hash and
  `current_token = null` are written in the same `update`, so a failure cannot
  leave the password changed with the old token still valid. The client must
  log in again. Rejected: keeping the old token valid (a stolen token would
  survive the victim's password change) and returning a freshly issued token
  (changes the response shape from `data: {}` to a token).
- User email format (F3): `@IsEmail` on User registration and profile update,
  as already on Customer registration. Login DTOs still do not validate the
  format, so a malformed email keeps producing the uniform 401.
- `GET /products` pagination (NestJS migration F4, user's choice): offset pagination with metadata inside
  `data` (`{ items, page, limit, total, totalPages }`), default 20, max 100, ordered by `createdAt` then `id`
  descending so rows created in the same instant keep a deterministic order. Rejected: keeping `data` as an
  array with metadata in response headers (body contract unchanged, but metadata less discoverable and to be
  exposed through CORS). Page and total are two parallel queries, not a transaction: `total` may be off by one
  under concurrent writes, accepted for an admin list.
- Image dimensions are read only through `readImageDimensions` (F4): magic-byte check for JPEG/PNG before
  calling `image-size`, plus `disableTypes` for every other format in the library. `image-size` has unpatched
  DoS vulnerabilities in its ICNS/HEIF/JXL parsers and, when the first byte does not confirm a format, its
  detector tries all 20 formats; the client-provided Content-Type cannot be trusted to keep files out of them.
  The two defences are independent on purpose. Rejected: replacing the library (larger change, and the
  mitigation fully covers the only two formats accepted).
- JSON body parser kept explicit after the last Express router was removed (NestJS migration F5):
  `bodyParser: false` plus `express.json()` and `json-syntax-error.middleware.ts` in `app.setup.ts`. NestJS
  registers its own parser inside `init()`, after every `app.use()`, so the translation middleware would sit
  before the parser and never see its errors, and NestJS's own handler turns the `SyntaxError` into a plain
  400, losing the `errore json: ...` contract. The built-in parser would also start accepting
  `application/x-www-form-urlencoded` bodies. Pinned by a test in `errorHandling.test.ts`, verified to fail
  with the built-in parser on. Rejected: going back to the built-in parser and recognising malformed JSON in
  `AllExceptionsFilter` by the text of the error message (fragile, it depends on `JSON.parse` wording).
- Duplicate product submissions (F6, protocol category *Duplication*; user's choice). A second
  `POST /products/new` from the same user with the same name, description, price and quantity within 10 seconds
  returns the product already created (200, same id) and the duplicate's uploaded file is deleted. The user
  proposed identifying the sender by IP address and user agent; the route is authenticated, so `user.id` from
  the token is used instead (IP changes between retries and is shared behind NAT, the user agent is identical
  across users, both are client-controlled). Check and insert are serialized per user with
  `pg_advisory_xact_lock(1, userId)` inside the transaction: without it, simultaneous requests all see "no
  duplicate" (verified: 2-4 products out of 10 simultaneous requests). It relies on READ COMMITTED; under
  REPEATABLE READ the waiting request would not see the committed product. Accepted trade-off: two identical
  products wanted by the same admin must be created more than 10 seconds apart. Rejected: accepting duplicates
  (no protection from double clicks), an `Idempotency-Key` header (exact, but needs a new table with expiry
  and a cooperating client; better suited to orders), a unique constraint on `(createdBy, name)` (blocks
  legitimate same-name products).
- Product price and quantity rules (F6, user's choice): price ≥ 0 (zero allowed for free items), at most 2
  decimals, at most 99999999.99; quantity an integer from 1 to 2147483647; name at most 255 characters. All
  rejected with a per-field 400. Before, `DECIMAL(10,2)` silently rounded `12.345` to `12.35` and out-of-range
  values made the INSERT fail with a 500. The price stays a string down to Prisma, never a float. Rejected:
  only the anti-overflow limits (keeps silent rounding and negative prices), strictly positive price.
- `POST /products/new` returns the created product with its images (F6, user's choice), instead of the stub's
  `data: {}`: the client gets the id without a second request. Rejected: only the id, and `{}`.
- Registration is atomic (F6, user's choice): entity creation and token storage run in one interactive
  transaction, for both identities. Before, a failure after the INSERT left an account without a token, and
  the retry got a 409 for an account the client believed it had not created.
- Uploaded images are not moved or renamed after the product is saved (F6): `image_url` is
  `/uploads/<multer name>`. A move after the commit could leave the database pointing to a missing file; a move
  before it could leave an orphan file if the commit failed. Page and total of `GET /products` stay outside a
  transaction (F4 entry above): a batched `$transaction([...])` would not help under READ COMMITTED, since each
  statement takes its own snapshot.
