# Finish setup on Netlify

AI Business City is already build-validated and its Neon schema is already initialized.

## Required private values

Netlify will ask for two private runtime values:

1. `DATABASE_URL`
   - Open Neon project `lively-lab-44120606`.
   - Copy the **pooled** PostgreSQL connection string.
   - Paste it directly into Netlify. Do not commit it to GitHub.

2. `APP_OWNER_TOKEN`
   - Create a long random private value.
   - This token unlocks the owner control panel.
   - Store it in your password manager and enter it directly into Netlify.

## After deploy

1. Open `/api/health` on the Netlify site.
2. Open the main site.
3. Enter your owner token in the control bar.
4. Run one low-risk test command.
5. Confirm the worker updates jobs and events in Neon.

Optional integrations such as OpenAI, Zoho, Google, Etsy, Retell, and Meta can be activated afterward without changing the hosting architecture.
