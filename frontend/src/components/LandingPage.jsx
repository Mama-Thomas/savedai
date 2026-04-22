import { useMemo, useState } from 'react'

// ---------------------------------------------------------------------------
// Seed data for the interactive demo card. Kept in-file because the landing
// page should load snappily and never make a backend call (visitor might not
// even have an account yet).
// ---------------------------------------------------------------------------

const DEMO_BOOKMARKS = [
  {
    id: 'd1',
    title: 'How to ship product faster without sacrificing quality',
    url: 'https://youtube.com/watch?v=demo1',
    domain: 'youtube.com',
    source: 'youtube',
    summary:
      'A short talk on cutting scope early, deferring decisions, and using fake doors to validate demand. Explains why weekly releases beat monthly ones.',
    tags: ['productivity', 'shipping', 'startups'],
    transcriptSnippet:
      'The real unlock was shipping weekly. Instead of big quarterly releases we cut scope and let real usage tell us what to build.',
  },
  {
    id: 'd2',
    title: "What's new in TypeScript 5.4",
    url: 'https://devblogs.microsoft.com/typescript/5-4',
    domain: 'devblogs.microsoft.com',
    source: 'article',
    summary:
      'Type narrowing now survives through closures, NoInfer is finally in, plus quality-of-life improvements to --noErrorTruncation and editor tooling.',
    tags: ['typescript', 'programming', 'javascript'],
    transcriptSnippet:
      'Type narrowing now survives into closures, so callbacks see the same narrowed type the enclosing function saw.',
  },
  {
    id: 'd3',
    title: '15-minute creamy garlic pasta',
    url: 'https://tiktok.com/@chef/demo3',
    domain: 'tiktok.com',
    source: 'caption',
    summary:
      'Fast weeknight dinner: butter, garlic, cream, parmesan, a squeeze of lemon. The trick is finishing the pasta in the sauce for 60 seconds.',
    tags: ['food', 'recipes', 'pasta'],
  },
  {
    id: 'd4',
    title: 'Design systems that scale past 100 designers',
    url: 'https://medium.com/design/systems-at-scale',
    domain: 'medium.com',
    source: 'article',
    summary:
      'Governance, tokens, and contribution flows matter more than component count. Case studies from Figma, Shopify, and Atlassian.',
    tags: ['design', 'systems', 'figma'],
    transcriptSnippet:
      'Once a system crosses 50 contributors, governance beats component count. You need a contribution flow or everything forks.',
  },
  {
    id: 'd5',
    title: 'Mastering Postgres indexes',
    url: 'https://youtube.com/watch?v=demo5',
    domain: 'youtube.com',
    source: 'youtube',
    summary:
      'B-tree vs GIN vs BRIN, when partial indexes win, why covering indexes help read-heavy workloads, and a live EXPLAIN walkthrough.',
    tags: ['databases', 'postgres', 'performance'],
    transcriptSnippet:
      'A partial index on only the hot rows can be 10x smaller and 5x faster than the full index, as long as your query matches the predicate.',
  },
  {
    id: 'd6',
    title: 'Remote work in 2026: what actually works',
    url: 'https://example.com/remote-2026',
    domain: 'example.com',
    source: 'article',
    summary:
      'Async-first docs, tight written feedback loops, and in-person offsites every quarter are now table stakes. Slack is not a document.',
    tags: ['remote', 'work', 'culture'],
  },
]

const SOURCE_LABEL = {
  youtube: 'Transcript',
  article: 'Article',
  caption: 'Caption',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'to', 'of', 'for', 'in', 'on', 'with',
  'how', 'what', 'is', 'are', 'it', 'this', 'that',
])

function matchesQuery(bm, terms) {
  if (!terms.length) return true
  const haystack = [
    bm.title,
    bm.summary,
    bm.transcriptSnippet || '',
    (bm.tags || []).join(' '),
  ]
    .join(' ')
    .toLowerCase()
  return terms.every((t) => haystack.includes(t))
}

function Highlighted({ text, terms }) {
  if (!text) return null
  const cleaned = (terms || []).filter(Boolean)
  if (!cleaned.length) return text
  const escaped = cleaned
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .sort((a, b) => b.length - a.length)
  const pattern = new RegExp(`(${escaped.join('|')})`, 'gi')
  const parts = text.split(pattern)
  return parts.map((part, i) =>
    pattern.test(part) ? (
      <mark key={i} className="bg-yellow-100 text-slate-800 rounded px-0.5">
        {part}
      </mark>
    ) : (
      <span key={i}>{part}</span>
    )
  )
}

// ---------------------------------------------------------------------------
// Demo card
// ---------------------------------------------------------------------------

function DemoCard() {
  const [query, setQuery] = useState('')

  const terms = useMemo(() => {
    return query
      .toLowerCase()
      .split(/\s+/)
      .map((t) => t.trim())
      .filter((t) => t && !STOPWORDS.has(t))
  }, [query])

  const results = useMemo(() => {
    const hits = DEMO_BOOKMARKS.filter((bm) => matchesQuery(bm, terms))
    // When the user types, bubble results that matched in the transcript
    // snippet first. This is the magic we want visitors to feel.
    return hits.sort((a, b) => {
      const aHit =
        a.transcriptSnippet &&
        terms.some((t) => a.transcriptSnippet.toLowerCase().includes(t))
      const bHit =
        b.transcriptSnippet &&
        terms.some((t) => b.transcriptSnippet.toLowerCase().includes(t))
      return (bHit ? 1 : 0) - (aHit ? 1 : 0)
    })
  }, [terms])

  return (
    <div className="w-full bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
      {/* Window chrome */}
      <div className="flex items-center gap-1.5 px-4 py-3 bg-slate-50 border-b border-slate-100">
        <span className="h-2.5 w-2.5 rounded-full bg-rose-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
        <span className="ml-3 text-[11px] text-slate-400 truncate">
          savedai.app / library
        </span>
      </div>

      {/* Search bar */}
      <div className="p-3 sm:p-4 bg-white border-b border-slate-100">
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
            />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Try: pasta, postgres, design systems, shipping..."
            className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-slate-200
                       focus:outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100 bg-white"
          />
        </div>
      </div>

      {/* Results */}
      <div className="p-3 sm:p-4 bg-slate-50 max-h-[360px] sm:max-h-[420px] overflow-y-auto">
        {results.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-400">
            No results. Try a different word.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {results.map((bm) => (
              <article
                key={bm.id}
                className="bg-white rounded-xl border border-slate-100 p-3 shadow-sm"
              >
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-1">
                  <span className="truncate">{bm.domain}</span>
                </div>
                <h3 className="text-sm font-semibold text-slate-800 leading-snug line-clamp-2">
                  <Highlighted text={bm.title} terms={terms} />
                </h3>
                {bm.source && SOURCE_LABEL[bm.source] && (
                  <span className="inline-block mt-1.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
                    {SOURCE_LABEL[bm.source]}
                  </span>
                )}
                {bm.transcriptSnippet &&
                  terms.some((t) =>
                    bm.transcriptSnippet.toLowerCase().includes(t)
                  ) && (
                    <p className="mt-2 text-[11px] text-slate-500 italic leading-relaxed border-l-2 border-yellow-200 pl-2">
                      <Highlighted text={bm.transcriptSnippet} terms={terms} />
                    </p>
                  )}
                <p className="mt-2 text-xs text-slate-500 leading-relaxed line-clamp-3">
                  <Highlighted text={bm.summary} terms={terms} />
                </p>
                {bm.tags?.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {bm.tags.map((t) => (
                      <span
                        key={t}
                        className="text-[10px] px-1.5 py-0.5 bg-sky-50 text-sky-600 rounded-full border border-sky-100"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Feature grid
// ---------------------------------------------------------------------------

function Feature({ icon, title, body }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6">
      <div className="h-10 w-10 rounded-xl bg-sky-50 text-sky-500 flex items-center justify-center mb-3">
        {icon}
      </div>
      <h3 className="font-semibold text-slate-800 text-sm sm:text-base mb-1">{title}</h3>
      <p className="text-sm text-slate-500 leading-relaxed">{body}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-sky-50/40 to-white">
      {/* Nav */}
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <a href="/" className="flex items-center gap-2 cursor-pointer">
            <div className="h-8 w-8 rounded-lg bg-sky-500 flex items-center justify-center shadow-sm">
              <svg
                className="h-4 w-4 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                />
              </svg>
            </div>
            <span className="font-bold text-slate-800 text-lg tracking-tight">SavedAI</span>
          </a>
          <nav className="hidden sm:flex items-center gap-5 ml-6 text-sm text-slate-500">
            <a href="#features" className="hover:text-slate-800 transition">Features</a>
            <a href="#demo" className="hover:text-slate-800 transition">Demo</a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <a
              href="/auth"
              className="text-sm text-slate-600 hover:text-slate-900 font-medium px-3 py-1.5 rounded-lg"
            >
              Sign in
            </a>
            <a
              href="/auth?mode=signup"
              className="text-sm bg-sky-500 hover:bg-sky-600 text-white font-semibold px-3 py-1.5 rounded-lg shadow-sm transition"
            >
              Get started
            </a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-12 sm:pt-20 pb-10 sm:pb-14 text-center">
        <span className="inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-semibold text-sky-600 bg-sky-50 border border-sky-100 px-3 py-1 rounded-full uppercase tracking-wide">
          <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
          AI-powered bookmarks
        </span>
        <h1 className="mt-5 text-3xl sm:text-5xl md:text-6xl font-bold text-slate-900 tracking-tight leading-[1.08]">
          Save every link.{' '}
          <span className="text-sky-500">Actually remember</span> them.
        </h1>
        <p className="mt-4 sm:mt-5 text-base sm:text-lg text-slate-500 max-w-2xl mx-auto leading-relaxed">
          SavedAI reads the articles and videos you save, writes a clean summary,
          tags them automatically, and lets you search what was actually said,
          not just the title.
        </p>
        <div className="mt-7 sm:mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <a
            href="/auth?mode=signup"
            className="w-full sm:w-auto bg-sky-500 hover:bg-sky-600 text-white font-semibold text-sm sm:text-base px-6 py-3 rounded-xl shadow-sm transition"
          >
            Start saving for free
          </a>
          <a
            href="#demo"
            className="w-full sm:w-auto bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold text-sm sm:text-base px-6 py-3 rounded-xl transition"
          >
            Try the demo
          </a>
        </div>
        <p className="mt-4 text-xs text-slate-400">
          No card. No browser extension required.
        </p>
      </section>

      {/* Demo */}
      <section id="demo" className="max-w-5xl mx-auto px-4 sm:px-6 pb-12 sm:pb-20">
        <div className="text-center mb-6 sm:mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
            Search what was said, not just the title
          </h2>
          <p className="mt-2 text-sm sm:text-base text-slate-500 max-w-xl mx-auto">
            Type a word. Watch videos, articles, and social posts filter based on
            what's actually inside them.
          </p>
        </div>
        <DemoCard />
      </section>

      {/* Features */}
      <section
        id="features"
        className="bg-white border-y border-slate-100 py-12 sm:py-20"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
              Your bookmarks, finally useful
            </h2>
            <p className="mt-2 text-sm sm:text-base text-slate-500 max-w-xl mx-auto">
              Every feature exists for one reason: so you actually come back to
              what you save.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            <Feature
              icon={
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              }
              title="AI summaries, instantly"
              body="Paste a URL. SavedAI reads the article or watches the video, writes a clean 2-3 sentence summary, and auto-tags it."
            />
            <Feature
              icon={
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                </svg>
              }
              title="Transcript-aware search"
              body="Finds bookmarks by what was said in a YouTube talk or written deep inside an article, not just by title."
            />
            <Feature
              icon={
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M3 7a2 2 0 012-2h4l2 2h7a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                </svg>
              }
              title="Collections that organize themselves"
              body="Save a link and SavedAI suggests the right collection. It even flags mismatches when you drop something in the wrong bucket."
            />
            <Feature
              icon={
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.97-4.03 9-9 9a9 9 0 01-7-3.35L3 21l1.35-2A9 9 0 0121 12z" />
                </svg>
              }
              title="Ask your bookmarks"
              body="Type a question. SavedAI answers using only what's in your library, and cites the exact bookmarks it used."
            />
            <Feature
              icon={
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 12v7a2 2 0 002 2h12a2 2 0 002-2v-7M16 6l-4-4m0 0L8 6m4-4v13" />
                </svg>
              }
              title="Share a collection, keep the rest private"
              body="One click turns any collection into a public read-only page. Your other bookmarks stay hidden."
            />
            <Feature
              icon={
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 10v6m0 0l-3-3m3 3l3-3M4 6h16M4 18h16" />
                </svg>
              }
              title="Export anywhere, forever"
              body="JSON, CSV, Markdown, PDF, or Netscape HTML you can import straight into Chrome, Firefox, or Safari. Your data stays yours."
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-14 sm:py-20 text-center">
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
          Start saving smarter today
        </h2>
        <p className="mt-2 text-sm sm:text-base text-slate-500">
          It's free to get started. No credit card. No browser extension required.
        </p>
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          <a
            href="/auth?mode=signup"
            className="w-full sm:w-auto bg-sky-500 hover:bg-sky-600 text-white font-semibold text-sm sm:text-base px-6 py-3 rounded-xl shadow-sm transition"
          >
            Create my library
          </a>
          <a
            href="/auth"
            className="w-full sm:w-auto bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold text-sm sm:text-base px-6 py-3 rounded-xl transition"
          >
            I already have an account
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 rounded-md bg-sky-500 flex items-center justify-center">
              <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                  d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
            </div>
            <span>SavedAI, save smarter with AI</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="/auth" className="hover:text-slate-700 transition">Sign in</a>
            <a href="/auth?mode=signup" className="hover:text-slate-700 transition">Get started</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
