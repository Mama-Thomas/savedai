# SavedAI

**AI-powered smart bookmark manager** — paste any URL, get an automatic summary and tags, and search your collection by meaning. Now with user accounts, JWT authentication, and rate limiting.

![SavedAI screenshot placeholder](https://placehold.co/900x400?text=SavedAI)

---

## What it does

| Feature | Details |
|---|---|
| **Save any URL** | TikTok, YouTube, Instagram, X, articles, GitHub repos — anything |
| **Auto metadata** | Fetches the page title, description, and thumbnail via Open Graph tags |
| **AI summary** | OpenAI `gpt-4o-mini` generates a clean 2-sentence summary |
| **Auto tags** | AI produces 3–5 relevant tags per bookmark |
| **Smart search** | Semantic search via FAISS + OpenAI embeddings (falls back to keyword matching) |
| **User accounts** | Register/login with email + password; each user only sees their own bookmarks |
| **Rate limiting** | 20 bookmarks per hour per user (via slowapi) |
| **Input validation** | URL format check, 2048-char max, password min-length enforced before hitting OpenAI |
| **Delete** | Remove bookmarks with one click |
| **Modern UI** | React + Tailwind CSS v4, responsive card grid, login/register page |

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS v4, Axios |
| Backend | FastAPI, SQLAlchemy 2, Uvicorn |
| Database | PostgreSQL |
| AI | OpenAI API (`gpt-4o-mini` + `text-embedding-3-small`) |
| Search | FAISS (semantic) with keyword fallback |
| Auth | JWT (`python-jose`), bcrypt (`passlib`) |
| Rate limiting | slowapi (20 bookmarks/hour per user) |
| Config | pydantic-settings / python-dotenv |

---

## Project structure

```
savedai/
├── backend/
│   ├── app/
│   │   ├── main.py        # FastAPI app, all routes, rate limiting
│   │   ├── auth.py        # JWT creation/verification, bcrypt, get_current_user
│   │   ├── models.py      # SQLAlchemy ORM: User + Bookmark (with FK)
│   │   ├── schemas.py     # Pydantic schemas with URL + password validation
│   │   ├── database.py    # DB engine + session
│   │   ├── config.py      # Settings (DB, OpenAI, JWT)
│   │   ├── metadata.py    # URL scraping (BeautifulSoup)
│   │   ├── ai.py          # OpenAI summary + tags
│   │   └── search.py      # FAISS / keyword search (user-scoped)
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   ├── auth.js        # register / login / getMe API calls
│   │   │   └── bookmarks.js   # Axios client with auto JWT header
│   │   ├── contexts/
│   │   │   └── AuthContext.jsx  # Auth state, token storage, logout
│   │   ├── components/
│   │   │   ├── AuthPage.jsx     # Login + Register page (togglable)
│   │   │   ├── AddBookmark.jsx
│   │   │   ├── BookmarkCard.jsx
│   │   │   └── SearchBar.jsx
│   │   ├── App.jsx        # Main app (guards unauthenticated state)
│   │   ├── main.jsx       # Mounts AuthProvider
│   │   └── index.css
│   ├── vite.config.js
│   └── package.json
├── .env.example
├── .gitignore
└── README.md
```

---

## Running locally

### Prerequisites

- Python 3.10+
- Node.js 18+
- PostgreSQL 14+ running locally (or via Docker)
- An [OpenAI API key](https://platform.openai.com/api-keys)

---

### 1. Clone the repo

```bash
git clone https://github.com/YOUR_USERNAME/savedai.git
cd savedai
```

---

### 2. Set up PostgreSQL

```bash
psql -U postgres -c "CREATE DATABASE savedai;"
```

Or via Docker:

```bash
docker run -d \
  --name savedai-db \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=savedai \
  -p 5432:5432 \
  postgres:16
```

---

### 3. Configure the backend

```bash
cd backend
cp .env.example .env
```

Edit `.env`:

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/savedai
OPENAI_API_KEY=sk-...your-real-key...
JWT_SECRET_KEY=your-random-256-bit-secret   # see note below
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=10080
APP_ENV=development
```

> **Generate a strong JWT secret:**
> ```bash
> python -c "import secrets; print(secrets.token_hex(32))"
> ```

---

### 4. Install backend dependencies & start the server

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

The API will be live at **http://localhost:8000**.
Interactive docs: **http://localhost:8000/docs**

> Tables (`users`, `bookmarks`) are created automatically on first startup.

---

### 5. Install frontend dependencies & start the dev server

```bash
cd frontend
npm install
npm run dev
```

The app will be live at **http://localhost:3000**.

---

## Authentication flow

```
POST /auth/register   { email, password }  →  { access_token, token_type }
POST /auth/login      { email, password }  →  { access_token, token_type }
GET  /auth/me         (Bearer token)       →  { id, email, created_at }
```

1. **Register** — password is hashed with bcrypt before storage. Returns a JWT.
2. **Login** — verifies the bcrypt hash, returns a JWT on success.
3. **Token storage** — the frontend stores the JWT in `localStorage` under `savedai_token`.
4. **Request injection** — an Axios request interceptor automatically attaches `Authorization: Bearer <token>` to every API call.
5. **Server validation** — every protected endpoint uses the `get_current_user` FastAPI dependency, which decodes and verifies the JWT and loads the user from the database.
6. **Logout** — removes the token from `localStorage` and clears client-side user state. No server round-trip needed since JWTs are stateless.
7. **Expiry** — tokens expire after 7 days (configurable via `JWT_EXPIRE_MINUTES`). On expiry, the frontend detects the 401 and redirects to the login page on next load.

### Bookmark ownership

Every bookmark row has a `user_id` foreign key. All list, search, and delete operations filter by the authenticated user's ID, so users can never access each other's data.

---

## Rate limiting

`POST /bookmarks` is limited to **20 requests per hour** per user using [slowapi](https://github.com/laurentS/slowapi).

- **Authenticated requests** — keyed by JWT `sub` claim (user ID), so the limit is per account regardless of IP.
- **Unauthenticated requests** — keyed by IP address as fallback.
- Exceeding the limit returns `HTTP 429 Too Many Requests`.

---

## Input validation

| Rule | Where enforced |
|---|---|
| URL must start with `http://` or `https://` | `BookmarkCreate` Pydantic validator |
| URL max length 2048 characters | `BookmarkCreate` Pydantic validator |
| Password minimum 8 characters | `UserCreate` Pydantic validator |
| Email must be valid format | `EmailStr` Pydantic type |

Validation errors return `HTTP 422 Unprocessable Entity` with a descriptive message before any DB or OpenAI call is made.

---

## API endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | — | Health check |
| `POST` | `/auth/register` | — | Create account, returns JWT |
| `POST` | `/auth/login` | — | Sign in, returns JWT |
| `GET` | `/auth/me` | Bearer | Get current user info |
| `GET` | `/bookmarks` | Bearer | List user's bookmarks |
| `POST` | `/bookmarks` | Bearer | Save a new bookmark (rate limited) |
| `DELETE` | `/bookmarks/{id}` | Bearer | Delete a bookmark |
| `GET` | `/search?q=...` | Bearer | Search user's bookmarks |

---

## Environment variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `OPENAI_API_KEY` | Your OpenAI API key |
| `JWT_SECRET_KEY` | Secret for signing JWTs — keep this private |
| `JWT_ALGORITHM` | JWT algorithm, default `HS256` |
| `JWT_EXPIRE_MINUTES` | Token lifetime in minutes, default `10080` (7 days) |
| `APP_ENV` | `development` or `production` |

---

## How search works

1. **FAISS semantic search** (default when `faiss-cpu` is installed): the user's bookmarks are embedded using `text-embedding-3-small` and queried with cosine similarity via an in-memory FAISS index.
2. **Keyword fallback**: if FAISS is unavailable or returns no results, a token overlap search against titles, summaries, tags, and URLs is used instead.

Both paths are scoped to the authenticated user's bookmarks only.

---

## License

MIT
