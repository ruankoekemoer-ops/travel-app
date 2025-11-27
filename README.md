## Travel Request App

React + TypeScript frontend with approval flow and ticket management, plus a Cloudflare D1-backed API.

### Features

- **Create travel request**: travel dates, flights, accommodation, airport transport, notes.
- **Approval flow**: approver view for approving/rejecting requests.
- **Manage tickets**: view approved requests to action bookings.

### Local development (no Cloudflare)

1. **Install dependencies**

```bash
cd "Travel App"
npm install
```

2. **Run frontend + simple Node API (in-memory)**

```bash
npm run dev:all
```

- Frontend: `http://localhost:5173`
- API: `http://localhost:4000`

### Cloudflare D1 database

1. **Create D1 database**

Make sure you have `wrangler` installed and are logged in:

```bash
npm install -g wrangler
wrangler login
```

Create the database:

```bash
wrangler d1 create travel_requests_db
```

Copy the resulting `database_id` into `wrangler.toml`:

```toml
[[d1_databases]]
binding = "TRAVEL_DB"
database_name = "travel_requests_db"
database_id = "YOUR_DATABASE_ID_HERE"
```

2. **Apply schema**

```bash
wrangler d1 execute travel_requests_db --file=./db/schema.sql
```

### Cloudflare Worker API with D1

This repo includes a Worker in `worker/src/index.ts` that exposes:

- `GET /api/requests` — list all travel requests
- `POST /api/requests` — create a request
- `PATCH /api/requests/:id/status` — update request status

To run it with wrangler:

```bash
cd "Travel App"
wrangler dev --config=wrangler.toml
```

Update the frontend `fetch` URLs to point at your Worker URL when deployed (e.g. `https://your-worker.your-account.workers.dev/api/requests`).

### Email Notifications (Optional)

The app sends email notifications when travel requests are submitted. It uses [Resend](https://resend.com) (free tier: 100 emails/day).

1. **Sign up for Resend** (free): https://resend.com/signup

2. **Get your API key** from the Resend dashboard

3. **Set the secret in Cloudflare**:

```bash
wrangler secret put RESEND_API_KEY
```

When prompted, paste your Resend API key.

4. **Verify email domain** (for production):
   - In Resend dashboard, add and verify your sending domain
   - Update the `from` address in `worker/src/index.ts` to use your verified domain

Emails are sent to `ruankoekemoer@outlook.com` when a new travel request is submitted. The email includes all request details (employee, dates, route, services, notes).

### Microsoft Teams Approval Integration (Optional)

The app can send approval requests to Microsoft Teams with **Approve** and **Reject** buttons that appear as interactive cards.

1. **Create a Teams Incoming Webhook**:
   - Open Microsoft Teams
   - Go to the channel where you want approval notifications (or create a dedicated "Travel Approvals" channel)
   - Click the **⋯** (three dots) next to the channel name
   - Select **Connectors**
   - Search for **Incoming Webhook** and click **Configure**
   - Give it a name (e.g., "Travel Request Approvals")
   - Click **Create**
   - **Copy the webhook URL** (you'll need this)

2. **Set the webhook URL as a Cloudflare secret**:

```bash
wrangler secret put TEAMS_WEBHOOK_URL
```

When prompted, paste your Teams webhook URL.

3. **How it works**:
   - When a travel request is submitted, a rich Adaptive Card appears in your Teams channel
   - The card shows all request details (employee, dates, route, services, notes)
   - **Approve** and **Reject** buttons are included in the card
   - Clicking a button sends a message back (you can set up a Power Automate flow or bot to process these)
   - The approval cards will appear in the Teams Approvals app if you have it installed

**Note:** To fully automate the approval workflow, you may want to:
- Set up a Power Automate flow that listens for the approval button clicks
- Or create a Teams bot that processes the approval actions and updates the database
- The current implementation sends the approval card; processing the button clicks requires additional setup

Both email and Teams notifications can be enabled simultaneously.

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
