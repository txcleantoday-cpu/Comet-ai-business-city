# AI Business City

AI Business City is a multi-business AI operations control plane backed by Neon PostgreSQL.

## One-click free deployment

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/txcleantoday-cpu/Comet-ai-business-city&fullConfiguration=true)

During setup, Netlify will privately request:

- `DATABASE_URL` — use the **pooled** connection string from Neon project `lively-lab-44120606`.
- `APP_OWNER_TOKEN` — create a long private value. This is the password-like token used by the control panel.

Do **not** add either secret to this repository.

## Included

- Next.js Business City control center
- 8 factories and 34 seeded AI workers
- Neon-backed job and event state
- approval gates
- Solutions Cleaning workflow
- ACES Autos workflow
- Creator Media → Etsy workflow
- deterministic quote engine
- scheduled Netlify worker every five minutes
- Zoho, Google, Etsy, Retell, Meta and OpenAI adapters

## Current database

The production schema and seed are already initialized in Neon project:

`lively-lab-44120606`

After Netlify deploys the site, open `/api/health` first, then the main control center.
