# Borrow Hub configuration

This file is the setup checklist for local development and deployment. Copy the
environment templates before starting the application:

```powershell
Copy-Item backend\.env.example backend\.env
Copy-Item frontend\.env.example frontend\.env
```

Never commit either `.env` file. The root `.gitignore` already excludes them.

## Backend values

Edit [backend/.env](backend/.env) with:

| Variable | Required | What to provide |
|---|---:|---|
| `PORT` | No | API port; use `4000` locally. |
| `JWT_SECRET` | Yes outside local demo | A long random signing secret. Do not reuse the development fallback. |
| `CORS_ORIGIN` | Recommended | The exact frontend origin, such as `http://localhost:5173`. |
| `MONGODB_URI` | When MongoDB is enabled | MongoDB Atlas connection string and database name. The current development adapter still uses `backend/data/borrow-hub.json`. |
| `RAZORPAY_KEY_ID` | When payments are enabled | Razorpay test/live key ID from the Razorpay dashboard. |
| `RAZORPAY_KEY_SECRET` | When payments are enabled | Razorpay server secret. Keep this backend-only. |
| `RAZORPAY_WEBHOOK_SECRET` | When payments are enabled | Secret configured for Razorpay webhooks. |
| `CLOUDINARY_CLOUD_NAME` | When image uploads are enabled | Cloudinary cloud name. |
| `CLOUDINARY_API_KEY` | When image uploads are enabled | Cloudinary API key. |
| `CLOUDINARY_API_SECRET` | When image uploads are enabled | Cloudinary API secret. Keep this backend-only. |
| `SMTP_HOST` | When email is enabled | SMTP provider hostname. |
| `SMTP_PORT` | When email is enabled | Usually `587` for STARTTLS. |
| `SMTP_USER` | When email is enabled | SMTP username or provider account. |
| `SMTP_PASSWORD` | When email is enabled | SMTP password or app password. |
| `SMTP_FROM` | When email is enabled | Verified sender address. |
| `APP_BASE_URL` | Recommended | Public backend URL used in links and webhooks. |

Use test credentials for Razorpay during development. Do not put payment
secrets, Cloudinary secrets, SMTP passwords, or database credentials in React
code or `frontend/.env`.

## Frontend values

Edit [frontend/.env](frontend/.env) with:

| Variable | Required | What to provide |
|---|---:|---|
| `VITE_API_URL` | No | Backend API base URL; defaults to `http://localhost:4000/api`. |
| `VITE_MAP_PROVIDER` | No | `openstreetmap` for the current link-based map behavior, or a future provider name. |
| `VITE_MAP_PUBLIC_KEY` | Only for a keyed map provider | Public browser key only; never use a server secret here. |
| `VITE_APP_NAME` | No | Display name, normally `Borrow Hub`. |

Vite exposes every `VITE_*` value to the browser. Only publish values that are
safe for anyone to see.

## Accounts and platform setup

1. **MongoDB Atlas:** create a database user, restrict network access, copy the
   application connection string, and set `MONGODB_URI`.
2. **Razorpay:** create a test account, obtain API keys, configure a webhook
   endpoint at `<backend-url>/api/payments/webhook`, and set the three Razorpay
   variables. Payment verification must remain server-side.
3. **Cloudinary:** create a cloud, restrict upload settings, and set the three
   backend Cloudinary variables. Prefer signed server-generated uploads.
4. **Email provider:** create an SMTP credential or app password, verify the
   sender domain/address, and set the SMTP variables.
5. **Maps:** the current app uses browser geolocation and privacy-safe
   OpenStreetMap links, so no map key is needed. Add a public key only when a
   full map SDK is implemented.
6. **Deployment:** set backend variables in the backend host and frontend
   variables in the frontend host separately. Set `CORS_ORIGIN` to the deployed
   frontend URL.

## Current local commands

```powershell
npm install
npm --prefix backend install
npm --prefix frontend install
npm run server
npm run dev
```

The local JSON store makes the current vertical slice runnable without external
accounts. External services are intentionally documented but not treated as
configured until their integrations are implemented and tested.
