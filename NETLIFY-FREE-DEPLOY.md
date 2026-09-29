# AI Business City — $0 Netlify + Neon deployment

This build removes the Vercel team requirement. It uses Netlify for the Next.js UI/API and scheduled worker, while keeping Neon as the production PostgreSQL database.

## 1. Create a free Netlify project

Create a Netlify Free account/project and deploy this repository. Netlify supports Next.js through its OpenNext adapter.

Build command:

    npm run build

Do not set a custom publish directory for the Next.js app unless Netlify specifically requests one; let its Next.js adapter configure the output.

## 2. Add environment variables in Netlify

In Project configuration -> Environment variables, add the following server-side values. Never commit secret values to Git.

Required for the live core:

    DATABASE_URL
    APP_OWNER_TOKEN
    PUBLIC_BASE_URL
    WEB_WORKER_BATCH=4
    PG_POOL_MAX=2

Use the pooled Neon connection string as DATABASE_URL. The database schema is already initialized in Neon project `lively-lab-44120606`.

For PUBLIC_BASE_URL, use the Netlify production URL after the first deployment, for example:

    https://your-site-name.netlify.app

Optional integrations can be added later:

    OPENAI_API_KEY
    OPENAI_MODEL
    ZOHO_ACCESS_TOKEN
    ZOHO_REFRESH_TOKEN
    ZOHO_CLIENT_ID
    ZOHO_CLIENT_SECRET
    GOOGLE_CLIENT_ID
    GOOGLE_CLIENT_SECRET
    GOOGLE_REFRESH_TOKEN
    ETSY_KEYSTRING
    ETSY_SHARED_SECRET
    ETSY_ACCESS_TOKEN
    ETSY_REFRESH_TOKEN
    ETSY_SHOP_ID
    RETELL_API_KEY
    RETELL_FROM_NUMBER
    RETELL_AGENT_ID
    META_ACCESS_TOKEN
    META_PAGE_ID
    META_IG_USER_ID

## 3. Worker behavior

`netlify/functions/worker-tick.mjs` runs every 5 minutes and processes queued database-backed job steps. The existing `/api/worker/tick` route remains available for an owner-authorized manual tick.

Approval-required steps still pause in `waiting_approval`; the hosting migration does not bypass approval gates.

## 4. Verify after deploy

Open:

    /api/health

Then open the main page. The dashboard should load the seeded factories and agents from Neon.

Create one low-risk test command, verify the job appears, and either invoke the manual worker tick or wait for the scheduled worker. Confirm events and job state update in Neon.

## 5. Cost guardrail

Keep the Netlify account on the Free plan. Do not enable paid auto-recharge. If the free monthly allowance is exhausted, the free site pauses rather than automatically creating paid overage charges.

## Architecture

    Browser
       |
       v
    Netlify Next.js app/API
       |
       +----> Neon PostgreSQL (lively-lab-44120606)
       |
       +----> Netlify scheduled worker (every 5 minutes)
       |
       +----> Zoho / Gmail / Calendar / AI / other integrations as credentials are added

