# 📝 NOTED — AI-Powered Notion Clone

A full-featured workspace app with rich text editing, nested pages, and an AI Agent sidebar powered by Gemini 2.0.

---

## ✨ Features

- 📄 **Rich text editor** (BlockNote — slash commands, headings, lists, code, etc.)
- 🗂️ **Nested pages** with collapsible sidebar tree
- 🤖 **AI Agent sidebar** with agentic actions (create pages, search, summarize, draft)
- 🔍 **⌘K search** across all pages
- ⭐ **Favorites** and recent pages
- 🎨 **Page covers** (gradients) and emoji icons
- 🌙 **Dark / Light mode**
- 🔐 **Auth** (email + Google OAuth)
- ☁️ **Supabase backend** (database, auth, storage, RLS)

---

## 🛠️ Tech Stack

| Layer       | Tool                        |
|-------------|------------------------------|
| Framework   | Next.js 14 (App Router)      |
| Styling     | Tailwind CSS                 |
| Database    | Supabase (PostgreSQL)        |
| Auth        | Supabase Auth                |
| AI          | Groq (Llama 3.3 70B)         |
| Editor      | BlockNote                    |
| State       | Zustand                      |
| Animations  | Framer Motion                |
| Deployment  | Vercel                       |

---

## 🚀 Setup Instructions

### Step 1 — Prerequisites

Make sure you have installed:
- **Node.js 18+** → https://nodejs.org
- **Git** → https://git-scm.com

---

### Step 2 — Get Your Free API Keys

#### 2A. Supabase (Database + Auth)
1. Go to → https://supabase.com
2. Click **Start your project** → Sign up free
3. Create a **New Project** (any name, any region, set a DB password)
4. Wait ~2 minutes for it to spin up
5. Go to **Project Settings → API**
6. Copy:
   - `Project URL` → this is your `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → this is your `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → this is your `SUPABASE_SERVICE_ROLE_KEY`

#### 2B. Google Gemini AI
1. Go to → https://aistudio.google.com
2. Sign in with Google
3. Click **Get API key** → **Create API key**
4. Copy the key → this is your `GEMINI_API_KEY`
5. Free tier: **1,500 requests/day, 1M tokens/minute** ✅

#### 2C. Google OAuth (for "Sign in with Google" button)
1. Go to → https://console.cloud.google.com
2. Create a new project (or use existing)
3. Go to **APIs & Services → OAuth consent screen**
   - User type: External → Fill basic info → Save
4. Go to **APIs & Services → Credentials**
   - Click **Create Credentials → OAuth 2.0 Client ID**
   - Application type: **Web application**
   - Authorized redirect URIs: add `https://YOUR_SUPABASE_PROJECT_REF.supabase.co/auth/v1/callback`
   - Click **Create** → copy **Client ID** and **Client Secret**
5. In Supabase → **Authentication → Providers → Google**
   - Enable Google, paste Client ID + Client Secret → Save

---

### Step 3 — Set Up the Database

1. In your Supabase project, click **SQL Editor** (left sidebar)
2. Click **New query**
3. Open the file `supabase/schema.sql` from this project
4. Paste the entire contents into the SQL Editor
5. Click **Run** ▶️
6. You should see success messages — all tables, policies, and triggers are created

---

### Step 4 — Install & Configure the App

```bash
# 1. Clone / download this project into a folder called "noted"
cd noted

# 2. Install dependencies
npm install

# 3. Create your environment file
cp .env.example .env.local
```

Now open `.env.local` in any text editor and fill in your values:

```env
NEXT_PUBLIC_SUPABASE_URL=https://basvyfrxydmfyhmqchot.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...  # already filled in .env.local
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...       # already filled in .env.local
GROQ_API_KEY=gsk_...                      # already filled in .env.local
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

### Step 5 — Run the App

```bash
npm run dev
```

Open → **http://localhost:3000**

You'll be redirected to `/login`. Create an account and your workspace is automatically set up! 🎉

---

### Step 6 — Deploy to Vercel (Optional, Free)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Follow the prompts, then add your env vars:
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add GEMINI_API_KEY
vercel env add NEXT_PUBLIC_APP_URL  # set to your vercel URL

# Redeploy
vercel --prod
```

Or: push to GitHub and connect the repo at https://vercel.com/new — add env vars in the dashboard.

**Important for production:** In Supabase → **Authentication → URL Configuration**:
- Site URL: `https://your-app.vercel.app`
- Redirect URLs: add `https://your-app.vercel.app/auth/callback`

---

## 📁 Project Structure

```
noted/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx          # Login page
│   │   └── signup/page.tsx         # Signup page
│   ├── (app)/workspace/[workspaceId]/
│   │   ├── layout.tsx              # Main app layout (sidebar + AI panel)
│   │   ├── page.tsx                # Workspace home
│   │   └── page/[pageId]/page.tsx  # Individual page editor
│   ├── api/
│   │   ├── ai/route.ts             # Gemini AI endpoint
│   │   └── pages/route.ts          # Pages CRUD API
│   ├── auth/callback/route.ts      # OAuth callback
│   └── layout.tsx                  # Root layout
├── components/
│   ├── sidebar/sidebar.tsx         # Left sidebar navigation
│   ├── editor/
│   │   ├── page-editor.tsx         # Page editor wrapper
│   │   └── blocknote-editor.tsx    # Rich text editor
│   ├── ai-agent/ai-agent-sidebar.tsx  # AI Agent panel
│   ├── ui/search-dialog.tsx        # ⌘K search
│   └── workspace-home.tsx          # Home dashboard
├── lib/
│   ├── store.ts                    # Zustand global state
│   ├── supabase.ts                 # Supabase client
│   ├── gemini.ts                   # Gemini AI + tools
│   └── utils.ts                    # Utilities
├── supabase/
│   └── schema.sql                  # Full database schema
├── styles/globals.css              # Global styles + design system
└── types/index.ts                  # TypeScript types
```

---

## 🤖 AI Agent Capabilities

The AI sidebar (click **AI Agent** in sidebar or the 🤖 icon) can:

| Command | Example |
|---------|---------|
| Create a page | "Create a page called Project Roadmap" |
| Search pages | "Find my notes about design" |
| List all pages | "Show me all my pages" |
| Draft content | "Draft a weekly standup template" |
| Summarize | "Summarize the current page" |
| Rename page | "Rename this page to Meeting Notes" |

The AI operates in **agentic mode** — it actually performs actions (creates real pages, searches real data) using Gemini function calling.

---

## 🎨 Editor Slash Commands

In the editor, type `/` to see all available blocks:

- `/heading` — H1, H2, H3
- `/bullet` — Bullet list
- `/numbered` — Numbered list
- `/todo` — Checkbox list
- `/code` — Code block
- `/quote` — Block quote
- `/image` — Image embed
- `/table` — Table

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `⌘K` | Open search |
| `⌘/` | Toggle sidebar |
| `Enter` (in editor) | New paragraph |
| `/` (in editor) | Command menu |
| `**text**` | Bold |
| `_text_` | Italic |
| `` `code` `` | Inline code |

---

## 🔧 Troubleshooting

**"Failed to sign in"** — Double-check your Supabase URL and anon key in `.env.local`

**AI not responding** — Check your `GEMINI_API_KEY` is valid at https://aistudio.google.com

**Pages not saving** — Run the SQL schema again in Supabase SQL Editor, make sure RLS policies exist

**Google OAuth not working** — Make sure the redirect URI in Google Console matches exactly: `https://YOUR_REF.supabase.co/auth/v1/callback`

**Editor not loading** — This is a hydration issue; try `npm run build && npm start` instead of dev mode

---

## 📄 License

MIT — free to use and modify.
