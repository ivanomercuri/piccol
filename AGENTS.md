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