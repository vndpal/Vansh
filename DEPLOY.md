# Deploying Vansh - The family tree

Vansh is a Next.js app that stores the whole tree as one JSON document in
Upstash Redis (key `family-tree`) and protects everything behind a shared 6-digit PIN.

You need: a GitHub account, a Vercel account, Node.js 20.9 or newer, and git.

## 1. Push the project to a new GitHub repo

1. Go to https://github.com/new, name the repo (for example `family-tree`),
   choose **Private**, and leave "Add a README", ".gitignore" and "license" unticked.
   Click **Create repository**.
2. In the project folder, run:

   ```bash
   git init            # skip if the folder is already a git repository
   git add -A
   git commit -m "Family Tree app"
   git branch -M main
   git remote add origin https://github.com/<your-username>/family-tree.git
   git push -u origin main
   ```

   If you use the GitHub CLI, `gh repo create family-tree --private --source=. --push`
   does all of step 1 in one command (after the `git add` and `git commit`).

`.env*` files are in `.gitignore`, so your secrets are never committed.

## 2. Import it in Vercel

1. Go to https://vercel.com/new and click **Import** next to the `family-tree` repo
   (click **Adjust GitHub App Permissions** if it is not listed).
2. Vercel detects **Next.js** automatically. Leave the build settings as they are.
3. Click **Deploy**. The build succeeds, but the site cannot log in or load data
   until the next steps are done.

## 3. Add Upstash Redis from the Vercel Marketplace

1. Open the project in Vercel and go to the **Storage** tab.
2. Click **Create Database**, pick **Upstash** (Upstash for Redis) under Marketplace
   Database Providers, and click **Continue**.
3. Choose the **Free** plan and a primary region close to your project's function
   region (the default function region is Washington, D.C., `iad1`, so pick a US East region).
   Give it a name and click **Create**.
4. When asked to connect it, select the `family-tree` project and tick
   **Development**, **Preview** and **Production**. Click **Connect**.

This adds `KV_REST_API_URL` and `KV_REST_API_TOKEN` (plus a few others) to the project.
The app reads `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` first and falls back to
the `KV_REST_API_*` names, so nothing else is needed. You can confirm under
**Settings > Environment Variables**.

## 4. Add FAMILY_PIN and SESSION_SECRET

Go to **Settings > Environment Variables** and add two variables:

| Name             | Value                                                                       |
| ---------------- | --------------------------------------------------------------------------- |
| `FAMILY_PIN`     | Exactly 6 digits. Avoid easy ones like `123456` or a birthday.              |
| `SESSION_SECRET` | A long random string, at least 32 characters. Generate one with the command below. |

```bash
openssl rand -base64 32
# or, without openssl:
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Tick **Production** and **Preview**. Also tick **Development** if you want
`vercel env pull` to download them for local use. (Variables marked **Sensitive**
cannot be used in Development; if you mark them sensitive, put the values in your
local `.env.local` by hand instead.)

Changing `FAMILY_PIN` or `SESSION_SECRET` later signs everyone out.

## 5. Redeploy and test the login

Environment variables only apply to new deployments, so:

1. Open the **Deployments** tab, click the **...** menu on the latest deployment,
   and choose **Redeploy**.
2. Open the site URL. You should land on the PIN page.
3. Enter the PIN. You should see an empty tree with an **Add the first person** button.
4. Add a person, reload the page, and open the site on your phone: the person
   should be there on both.
5. Optional: check the brute-force protection. After 5 wrong PINs from the same IP,
   the login page says "Too many wrong attempts" and blocks that IP for 15 minutes.
   (Try it from your phone on mobile data so your main connection is not blocked.)

### Loading the sample family (optional)

`npm run seed` writes a 26-person sample family over 5 generations to whatever Redis
database your `.env.local` points to (see the next section). It refuses if the tree
already has people; `npm run seed -- --force` replaces the existing tree.

## Running locally

```bash
npm install
npm install -g vercel     # or prefix the commands below with npx
vercel login
vercel link               # choose the family-tree project
vercel env pull           # writes .env.local with the project's Development variables
npm run dev               # http://localhost:3000
```

If Upstash is connected to the Development environment, local runs use the **same
database** as the live site, so local edits change the real tree. To keep them apart,
create a second Upstash database, connect it to Development only, and connect the first
one to Preview and Production only.

Without the Vercel CLI, copy `.env.example` to `.env.local` and fill in the values
from the Upstash console (REST URL and token) plus your PIN and secret.

The login cookie is marked `Secure`. Chrome, Edge and Firefox accept it on
`http://localhost`. If you log in locally and get sent back to the PIN page, your
browser is rejecting the cookie over plain http; use one of those browsers.

## Useful commands

```bash
npm test          # unit tests for the relationship finder and tree validation
npm run build     # production build
npm run seed      # load the sample family (needs .env.local)
```
