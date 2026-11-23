# DineFlow POS

DineFlow POS is a full-stack restaurant point-of-sale and billing application. The React client uses an Express API, MongoDB persistence through Mongoose, and server-enforced role permissions.

## Features

- Sign up for Admin or Cashier accounts, username or email sign-in, bcrypt password hashes, JWT sessions in HttpOnly cookies, logout, and protected routes. Admin/Cashier permissions are assigned and checked by the server.
- Menu management: create, edit, delete, search, category filters, vegetarian/non-vegetarian indicators, and availability controls.
- Table and order management: T1–T10, free/running states, dine-in and takeaway orders, cart quantity changes, and persisted order item/price snapshots.
- Billing: unique bill numbers, saved itemized invoices, percentage or fixed discounts, CGST 2.5%, SGST 2.5%, nearest-rupee rounding, and print/Save as PDF.
- Payments: Cash, UPI, Card, and split entries. Payments are records only; no payment gateway is connected.
- Bill History: search, date and payment-mode filters, pagination, invoice details, payment information, and Admin cancellation with audit fields. Bills are retained; cancellation does not delete a bill or payment entries.
- Reports: date-filtered sales, bills, orders, discounts, cancellations, payment totals, item quantities/revenue, charts, CSV download, print, and a day-end summary. Reports exclude cancelled bills from sales, payment, and item totals.
- Responsive desktop and tablet layouts, loading/error/empty states, and toast notifications.

## Stack and requirements

- Node.js 20.19+ or 22.12+, npm 10+
- React, TypeScript, Vite, Tailwind CSS v4, React Router, Axios, Recharts, Lucide React, React Hot Toast
- Node.js, Express, Mongoose, MongoDB Atlas, Zod, bcryptjs, JWT

Tailwind CSS v4 is integrated through `@tailwindcss/vite` and `@import "tailwindcss"` in the client stylesheet.

## Installation and setup

Run commands from the repository root.

1. Install workspace dependencies:

   ```sh
   npm install
   ```

2. Create local environment files from the examples:

   ```sh
   # macOS / Linux
   cp server/.env.example server/.env
   cp client/.env.example client/.env
   ```

   ```powershell
   # Windows PowerShell
   Copy-Item server/.env.example server/.env
   Copy-Item client/.env.example client/.env
   ```

3. Edit `server/.env`:
   - Set `MONGODB_URI` to the application’s MongoDB Atlas connection string. Include a database name such as `/dineflow` and URL-encode special characters in the database password.
   - Set `JWT_SECRET` to a private random value of at least 32 characters. Generate one with:

     ```sh
     node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
     ```

4. Review `client/.env`. `VITE_API_BASE_URL=/api` uses Vite’s development proxy to the local API. No account credentials belong in the client environment.

5. Seed the configured MongoDB database:

   ```sh
   npm run seed
   ```

   Seeding inserts T1–T10 and 24 sample menu items across six categories. It never creates users or resets passwords. Create your first account on the sign-up page.

6. Start both development servers:

   ```sh
   npm run dev
   ```

   Open [http://localhost:5173](http://localhost:5173). The API listens on port 5000 by default and the client proxies `/api` requests to it. The server waits for MongoDB before it starts listening.

### Account setup and roles

Use **Create account** on the login screen to register with your name, email, username, and a password of at least 12 characters. Select Admin or Cashier. Cashier signup is available anytime. An Admin can be registered only while the database has no Admin account; an Admin signup attempt is rejected once one exists. Additional Admin provisioning is not exposed in the current UI. The chosen role is checked by the API and does not itself grant permissions. Existing users sign in with their username/email, password, and matching role tab. There are no demo credentials.

## Environment variables

### Server (`server/.env`)

| Variable | Required | Description |
| --- | --- | --- |
| `MONGODB_URI` | Yes | MongoDB Atlas URI for application data. |
| `JWT_SECRET` | Yes | Private signing key, at least 32 characters; do not use the example placeholder. |
| `PORT` | No | API port; defaults to `5000`. |
| `CLIENT_ORIGIN` | No | Allowed credentialed browser origin; defaults to `http://localhost:5173`. |
| `NODE_ENV` | No | `development`, `test`, or `production`; defaults to `development`. |
| `JWT_EXPIRES_IN` | No | JWT lifetime accepted by `jsonwebtoken`; defaults to `1d`. |
| `BCRYPT_ROUNDS` | No | Password hash cost from 10 to 14; defaults to `12`. |
| `MONGODB_TEST_URI` | For integration tests | URI for a separate, disposable MongoDB test database. Never point this at application data. |

### Client (`client/.env`)

| Variable | Required | Description |
| --- | --- | --- |
| `VITE_API_BASE_URL` | No | API base URL; defaults to `/api`. |
Variables prefixed with `VITE_` are bundled into browser code. Use them only for public client configuration, never for secrets.

## Running and checks

```sh
npm run dev             # Client and API in development
npm run dev:client      # Vite client only
npm run dev:server      # Express API only
npm run build           # Type-check and production-build client
npm start               # Start API in production mode
npm run seed            # Seed configured MongoDB database
npm run test:server     # Run API smoke and Mongo integration tests
```

Database integration tests are skipped while `MONGODB_TEST_URI` is blank. To run them, set it to a separate test database before running `npm run test:server`. The suite creates and removes test records and restores any existing T1–T10 statuses; the URI must not point to application data. The tests do not drop the database themselves.

Health check: `GET /api/health` (no authentication required). If Vite reports `ECONNREFUSED` for `/api/*`, start the backend and verify that MongoDB connects. Keep `.env` files private; `.gitignore` excludes them.

## Roles

- **Admin:** Dashboard and Reports, menu changes, table access/administration, order cancellation, bill cancellation, and payment history. Admins can also use POS, Billing, Bill History, and payment entry.
- **Cashier:** POS/orders, table lookup, bill creation/history/details, and payment entry. Cashiers cannot change menu/table administration, cancel orders or bills, or access Dashboard, Reports, or payment history.

The UI hides restricted navigation, and the API independently enforces these roles.

## API routes

All endpoints are under `/api`. Private routes require the HttpOnly `dineflow_token` session cookie (or an accepted Bearer JWT). Request bodies and query parameters are validated; IDs use MongoDB ObjectId format. Unless stated otherwise, private routes are available to Admin and Cashier.

| Method | Route | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/health` | Public | API health status. |
| `POST` | `/auth/login` | Public | Sign in with `{ "identity", "password", "role" }`; identity may be username or email and role must match the account. |
| `POST` | `/auth/register` | Public, rate limited | Create an account with `{ "name", "email", "username", "password", "role" }`; password must be at least 12 characters. Cashier signup is always available; Admin signup is rejected after the first Admin exists. |
| `GET` | `/auth/session` | Public | Resolve the current cookie session; returns `{ user: null }` when signed out. |
| `GET` | `/auth/me` | Signed in | Return current user profile. |
| `POST` | `/auth/logout` | Public | Clear the session cookie. |
| `GET` | `/dashboard` | Admin | Current-day dashboard totals, payments, sales trend, and top items. |
| `GET` | `/menu` | Admin, Cashier | List menu items; supports `page`, `limit`, `search`, `category`, and `available`. |
| `POST` | `/menu` | Admin | Create a menu item. |
| `PATCH` | `/menu/:id` | Admin | Update menu item fields. |
| `DELETE` | `/menu/:id` | Admin | Delete a menu entry. Historical order/bill snapshots remain stored. |
| `GET` | `/tables` | Admin, Cashier | List T1–T10 and current table order state. |
| `PATCH` | `/tables/:id` | Admin | Set table state, subject to active-order integrity checks. |
| `GET` | `/orders` | Admin, Cashier | List orders; supports `page`, `limit`, and `status`. |
| `POST` | `/orders` | Admin, Cashier | Create a Dine-In or Takeaway order. |
| `GET` | `/orders/:id` | Admin, Cashier | Get an order and its saved item snapshots. |
| `PATCH` | `/orders/:id` | Admin, Cashier | Edit an open order. Existing item prices remain snapshotted. |
| `POST` | `/orders/:id/cancel` | Admin | Cancel an open order. |
| `GET` | `/bills` | Admin, Cashier | Search/filter paginated bill history; supports `search`, `date` or `from`/`to`, `paymentMode`, and `cancelled`. |
| `POST` | `/bills` | Admin, Cashier | Generate one bill for an open order; accepts `order`, `discountType` (`PERCENT` or `AMOUNT`), and `discountValue`. |
| `GET` | `/bills/:id` | Admin, Cashier | Get bill, order/table, cashier, payments, and cancellation audit details. |
| `POST` | `/bills/:id/cancel` | Admin | Mark bill cancelled and preserve its financial record and payment entries. |
| `POST` | `/payments` | Admin, Cashier | Record a single incremental payment or a `payments` array for a balanced split settlement. Modes: `CASH`, `UPI`, `CARD`. |
| `GET` | `/payments` | Admin | List recorded payment entries. |
| `GET` | `/reports` | Admin | Current-day dashboard report. |
| `GET` | `/reports/daily` | Admin | Sales/payment/item/day-end report; accepts `date=YYYY-MM-DD` or `from` and `to` date strings. |

Reports and date-filtered bill queries use Asia/Kolkata day boundaries (start inclusive, next-day start exclusive). Report sales and item/payment totals exclude cancelled bills; cancelled bill count is reported separately. Payment totals represent recorded payments, not unpaid bill balances.

## Project layout

```text
client/                 React/Vite frontend
  src/components/       Shared layout and UI components
  src/context/          Authentication context
  src/pages/            Login, Dashboard, POS, Menu, Tables, Billing, History, Reports
  src/services/         Axios API client
  src/types/            Shared frontend types
server/                 Express/Mongoose API
  src/config/           Environment and database configuration
  src/controllers/      Request handlers and business rules
  src/middleware/       Authentication, roles, validation, errors
  src/models/           Mongoose schemas
  src/routes/           REST route definitions
  src/scripts/          Database seed script
  src/utils/            Validation schemas, date/money helpers, sequences
  tests/                API smoke and Mongo integration tests
```

See [AGENTS.md](./AGENTS.md) for repository implementation rules.

## Out of scope

There is no payment gateway, inventory/recipe tracking, customer loyalty, staff scheduling, or multi-restaurant tenancy. Cash, UPI, and Card are manually recorded payment modes only.
