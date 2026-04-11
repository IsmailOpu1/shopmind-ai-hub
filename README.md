# ShopMind AI

An AI-powered shopping assistant dashboard for e-commerce businesses. Upload your product catalog, customize your chatbot, and embed an AI shopping assistant on your store.

## Tech Stack

- **Frontend:** React 18, TypeScript, Vite 5
- **Styling:** Tailwind CSS v3, shadcn/ui
- **Backend:** Supabase (Auth, PostgreSQL, Row Level Security)
- **State:** TanStack React Query
- **File Parsing:** PapaParse (CSV), SheetJS (XLSX)

## Features

- 🔐 Email/password authentication with Supabase Auth
- 📦 Bulk product upload via CSV/XLSX drag-and-drop
- 🤖 Customizable AI chatbot widget (name, greeting, color, position)
- 📊 Dashboard with stats overview
- 🌙 Dark theme UI
- 📱 Fully responsive (mobile, tablet, desktop)

## Local Setup

### Prerequisites

- Node.js 18+ or Bun
- A Supabase project

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd <project-directory>

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
# Edit .env with your Supabase project credentials

# Start development server
npm run dev
```

### Supabase Setup

1. Create a new project at [supabase.com](https://supabase.com)
2. Copy your project URL and anon key into `.env`
3. Run the migrations in `supabase/migrations/` against your database
4. Enable email auth in Supabase Authentication settings

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |

## Project Structure

```
src/
├── components/       # Reusable UI components
│   ├── ui/           # shadcn/ui primitives
│   ├── AppSidebar    # Navigation sidebar
│   ├── ChatWidget    # AI chat overlay
│   ├── ErrorBoundary # Crash recovery
│   └── ...
├── hooks/            # Custom React hooks (useAuth, etc.)
├── integrations/     # Supabase client & types
├── pages/            # Route pages
└── lib/              # Utilities
```

## License

Private — all rights reserved.
