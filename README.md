# Stockroom — MERN inventory management

An inventory management app built with **MongoDB, Express, React and Node.js**. The backend follows MVC: Mongoose models store data, controllers handle business logic, routers expose the API, and React provides the view layer.

## Features

- JWT authentication in HttpOnly cookies, bcrypt password hashing, registration and logout.
- Admin, manager and viewer permissions enforced by the backend and interface.
- Product creation/editing, detail views and admin-only archiving.
- Stock in/out adjustments with reason, actor, timestamp and resulting balance.
- Version checks prevent concurrent edits from overwriting stock. Negative quantities are rejected.
- Dashboard metrics, seven-day movement chart, low-stock alerts, product search, filters, sorting, pagination and CSV exports.
- Supplier directory and creation; admin user list and role management.
- Responsive interface with accessible forms, dialogs, loading states and error feedback.
- Starts with an empty database. Add your own accounts, products and suppliers.

## Structure

```text
.
├── backend/
│   ├── .env.example
│   ├── src/
│   │   ├── config/          # Environment validation and MongoDB connection
│   │   ├── models/          # User, Product with stock history, Supplier
│   │   ├── controllers/     # Authentication and inventory business logic
│   │   ├── routes/          # REST endpoints and permissions
│   │   ├── middleware/      # JWT authentication, RBAC, validation, errors
│   │   ├── scripts/promoteAdmin.js  # Explicit admin setup for your own account
│   │   ├── utils/
│   │   ├── app.js
│   │   └── server.js
│   └── test/integration.test.js
├── frontend/
│   ├── .env.example
│   ├── src/
│   │   ├── main.jsx         # React workspace, pages and forms
│   │   ├── api.js           # API client and CSV export
│   │   └── styles.css
│   └── vite.config.js       # Development /api proxy
└── package.json             # npm workspaces and shared commands
```

## Setup

Requires **Node.js 20.19+** and a running MongoDB server (local or Atlas).

```bash
npm install
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Paste the generated value into `JWT_SECRET` in `backend/.env`. Add your MongoDB connection string to `MONGO_URI` in the same file. Both fields are required. Keep backend secrets out of `VITE_` variables.

Use your Atlas connection string, or start a local MongoDB service. No records are created automatically.

```bash
npm run dev
```

Open **http://localhost:5173**. The API runs on **http://localhost:5000**. Create your account through **Create an account**. New accounts have viewer access.

To make your own registered account the first admin, run this command with your email:

```bash
npm run promote-admin -- you@your-company.com
```

Sign in again after promotion. You can then add your inventory and assign other users' roles in **Team & access**. The command requires database access and an existing account; it creates no users or inventory. There are no default accounts, credentials or seeded records.

Start each workspace separately if preferred:

```bash
npm run dev --workspace backend
npm run dev --workspace frontend
```

## Roles

| Action | Viewer | Manager | Admin |
| --- | --- | --- | --- |
| Read inventory, suppliers, dashboard and history | Yes | Yes | Yes |
| Export inventory and activity CSVs | Yes | Yes | Yes |
| Create/edit products and adjust stock | — | Yes | Yes |
| Add suppliers | — | Yes | Yes |
| Archive products | — | — | Yes |
| List users and assign roles | — | — | Yes |

Registration always creates a viewer; an injected `role` field is rejected. Protected requests check the current role and token version in MongoDB. Logout and role changes invalidate existing JWTs. Admins cannot change their own roles, and existing admin accounts cannot be demoted through this interface, preventing lockout. Choose admin promotions deliberately.

## Environment

| Backend variable | Purpose |
| --- | --- |
| `NODE_ENV` | `development`, `test` or `production`; production enables Secure cookies |
| `PORT` | API port, default `5000` |
| `MONGO_URI` | MongoDB connection URI |
| `JWT_SECRET` | Unique random secret, at least 32 characters |
| `JWT_EXPIRES_IN` | JWT lifetime, default `8h` |
| `CLIENT_URL` | Exact browser origin allowed for CORS and mutations |

The frontend's optional `VITE_API_URL` sets the API base, including `/api`. Leave it empty for the development proxy and same-origin production hosting. If you change the API port, also update the proxy in `frontend/vite.config.js`.

## API

Inventory routes require the `access_token` cookie returned by login/registration. Browser requests must include `credentials: 'include'`. Mutations accept JSON. Errors use `{ "message": "..." }`.

| Method | Endpoint | Access / body |
| --- | --- | --- |
| GET | `/api/health` | Public health check |
| POST | `/api/auth/register` | `{ name, email, password }`; password 10–128 characters |
| POST | `/api/auth/login` | `{ email, password }` |
| GET | `/api/auth/me` | Current authenticated user |
| POST | `/api/auth/logout` | Revoke sessions and clear cookie |
| GET | `/api/products` | All active products |
| POST | `/api/products` | Admin/manager; product fields plus `quantity` |
| PUT | `/api/products/:id` | Admin/manager; product fields plus `version` |
| POST | `/api/products/:id/stock` | Admin/manager; `{ delta, reason, version }` |
| DELETE | `/api/products/:id` | Admin; `{ version }` — archive product |
| GET | `/api/products/activity` | Latest 100 stock movements, including archived products |
| GET | `/api/suppliers` | All suppliers |
| POST | `/api/suppliers` | Admin/manager; `{ name, email, phone?, location? }` |
| GET | `/api/users` | Admin only |
| PATCH | `/api/users/:id/role` | Admin; `{ role: "admin" \| "manager" \| "viewer" }` |

Product fields: `name`, `sku`, `category`, `price`, `reorderLevel`, optional `description` and `supplier` (MongoDB ID or null). Use the product's returned `__v` as `version` for editing, stock adjustments and archiving. A stale version returns `409`; reload inventory before retrying. Quantities are nonnegative integers. Unit prices use USD and support two decimal places. Product edits cannot set quantity directly.

```json
{
  "name": "Wireless keyboard",
  "sku": "EL-KB-001",
  "category": "Electronics",
  "price": 79,
  "quantity": 50,
  "reorderLevel": 10,
  "supplier": null,
  "description": "Compact wireless keyboard"
}
```

## Verification

```bash
npm run build
npm test
```

Integration tests require MongoDB at `127.0.0.1:27017`, or set `TEST_MONGO_URI` to a URI whose database name ends in `_test`. Each run appends a random suffix, creates an isolated database and drops only that database afterward. Tests cover registration privilege escalation, JWT failures/revocation, role restrictions, untrusted origins, invalid input, concurrent stock edits, negative stock, stale versions and archive history.

```bash
TEST_MONGO_URI=mongodb://127.0.0.1:27018/stockroom_test npm test
```

## Production

```bash
npm run build
# Set NODE_ENV=production and CLIENT_URL=https://your-app.example in backend/.env
npm start
```

Express serves `frontend/dist` and `/api` together. Put an HTTPS reverse proxy in front of `127.0.0.1:5000`. Use one public origin; SameSite=Lax cookies deliberately block cross-site authentication. Use a same-origin API proxy if hosting the frontend separately. Set `CLIENT_URL` to that exact public origin. The included rate limiter stores counters in memory; multi-instance deployments need a shared store and explicitly configured trusted proxy handling.

History retains the latest **100 movements per product**. The activity view and chart use the latest 100 movements across all products, so the chart shows recent activity rather than a complete reporting ledger. Archiving retains those records and reserves the SKU. Supplier editing/deletion and restoring archived products are outside this app's scope. Filtering and pagination run in the frontend; add server-side pagination for large inventories.

Security implementation follows [Express security guidance](https://expressjs.com/advanced/best-practice-security/); concurrency checks use [Mongoose atomic updates](https://mongoosejs.com/docs/tutorials/findoneandupdate.html).
