/**
 * Privacy policy page served at /privacy.
 *
 * The Chrome Web Store listing requires a public privacy policy URL. The
 * extension and the web app collect the same data and use the same backend,
 * so one document covers both. Plain prose, no client-side state, no auth.
 */
export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl border border-slate-100 shadow-sm p-6 sm:p-10">
        <a href="/" className="inline-flex items-center gap-2 mb-6 cursor-pointer">
          <div className="h-8 w-8 rounded-lg bg-sky-500 flex items-center justify-center shadow-sm">
            <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          </div>
          <span className="font-bold text-slate-800 text-lg tracking-tight">SavedAI</span>
        </a>

        <h1 className="text-2xl font-bold text-slate-800 mb-2">Privacy Policy</h1>
        <p className="text-xs text-slate-400 mb-8">Last updated: April 26, 2026</p>

        <div className="prose prose-slate max-w-none text-sm text-slate-700 leading-relaxed space-y-5">
          <p>
            SavedAI is a personal bookmark manager that uses AI to summarize, tag, and
            organize the links you save. This policy explains what we collect, how we use it,
            and what you control. It applies to both the SavedAI website (savedai.dev) and
            the SavedAI Chrome extension.
          </p>

          <h2 className="text-base font-semibold text-slate-800 mt-6">What we collect</h2>
          <p>
            <span className="font-semibold">Account data:</span> your email address and a
            hashed password. Passwords are hashed with bcrypt and never stored in plain text.
          </p>
          <p>
            <span className="font-semibold">Bookmark data:</span> the URLs you choose to save,
            along with the page title, description, thumbnail, and (where available) a
            transcript or extracted body text. We also store the AI-generated summary and
            tags for each bookmark, plus the collection you assign it to.
          </p>
          <p>
            <span className="font-semibold">Authentication tokens:</span> when you sign in,
            we issue a JWT that the web app and extension store locally to keep you signed
            in. The token expires after 60 minutes of idle.
          </p>
          <p>
            We do not collect your browsing history, the contents of pages you view, your
            keystrokes, or any analytics about how you use the product. The extension only
            reads the URL of the current tab when you explicitly click Save or use the
            keyboard shortcut.
          </p>

          <h2 className="text-base font-semibold text-slate-800 mt-6">How we use it</h2>
          <p>
            Saved URLs are fetched on our backend so we can extract title, description, and
            thumbnail. URLs and the extracted content are sent to OpenAI to generate a
            short summary and tags, and to compute embeddings used for semantic search and
            for the AI collection classifier. OpenAI does not use API inputs to train its
            models (per their published API policy).
          </p>
          <p>
            Your email is used to send password-reset emails when you request one. Reset
            emails are sent via Resend.
          </p>

          <h2 className="text-base font-semibold text-slate-800 mt-6">Who else sees it</h2>
          <p>We use the following third-party services to run SavedAI:</p>
          <ul className="list-disc ml-5 space-y-1">
            <li>OpenAI: AI summaries, tags, and embeddings</li>
            <li>Neon: managed PostgreSQL database</li>
            <li>Render: backend application hosting</li>
            <li>Cloudflare: frontend hosting and DNS</li>
            <li>Resend: transactional email (password reset)</li>
          </ul>
          <p>
            We do not sell your data. We do not share your data with advertisers. We do not
            run analytics or tracking scripts on the website or in the extension.
          </p>

          <h2 className="text-base font-semibold text-slate-800 mt-6">Public sharing</h2>
          <p>
            You can choose to make a specific collection publicly viewable by generating a
            share link. Anyone with that link can view the bookmarks in that collection until
            you turn sharing off. No other collections are exposed by a share link.
          </p>

          <h2 className="text-base font-semibold text-slate-800 mt-6">Your controls</h2>
          <p>
            You can delete any bookmark or any collection at any time from the web app. You
            can export everything you've saved at any time as JSON, CSV, Markdown, HTML, TXT,
            or PDF from the Export menu. If you want your account and all associated data
            permanently deleted, email us at the address below and we will remove it within
            7 days.
          </p>

          <h2 className="text-base font-semibold text-slate-800 mt-6">Security</h2>
          <p>
            Passwords are hashed with bcrypt. All traffic between your browser, the
            extension, and our backend is encrypted with HTTPS. Authentication tokens are
            stored in browser local storage (web app) or chrome.storage.local (extension)
            and expire after 60 minutes. The backend rejects requests to internal or
            private network addresses to prevent the URL fetcher from being abused.
          </p>

          <h2 className="text-base font-semibold text-slate-800 mt-6">Changes</h2>
          <p>
            If we make a meaningful change to this policy, we will update the "Last updated"
            date at the top.
          </p>

          <h2 className="text-base font-semibold text-slate-800 mt-6">Contact</h2>
          <p>
            Questions, concerns, or deletion requests:{' '}
            <a href="mailto:tmama8324@gmail.com" className="text-sky-600 hover:underline">
              tmama8324@gmail.com
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
