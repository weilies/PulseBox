import Link from "next/link";
import { APP_NAME } from "@/lib/constants";

const SUPABASE_URL = "https://<project-ref>.supabase.co";
const ANON_KEY = "<your-supabase-anon-key>";

const NAV_ITEMS = [
  { id: "auth-app",   label: "App Credentials" },
  { id: "auth-user",  label: "User Token" },
  { id: "endpoints",  label: "Endpoint Reference" },
  { id: "headers",    label: "Required Headers" },
  { id: "i18n",       label: "Multi-Language" },
  { id: "examples",   label: "Examples" },
  { id: "webhooks",   label: "Webhooks & Events" },
  { id: "rate-limits",label: "Rate Limits" },
  { id: "errors",     label: "Error Codes" },
  { id: "privacy",    label: "Privacy & Isolation" },
];

// ---------------------------------------------------------------------------
// Code block component
// ---------------------------------------------------------------------------
function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg border border-blue-500/25 bg-white p-4 text-xs leading-relaxed text-[#a8c4ff] font-mono whitespace-pre">
      {children}
    </pre>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="space-y-3 scroll-mt-20">
      <h2 className="text-base font-bold text-gray-900 border-b border-gray-200 pb-2"
        style={{ fontFamily: "var(--font-geist-sans), sans-serif" }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Badge({ children, color = "cyan" }: { children: string; color?: "cyan" | "purple" | "green" | "yellow" | "red" }) {
  const colors = {
    cyan:   "bg-blue-500/15 text-blue-600 border-gray-300",
    purple: "bg-purple-500/15 text-purple-400 border-gray-300",
    green:  "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    yellow: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
    red:    "bg-red-500/15 text-red-400 border-red-500/30",
  };
  return (
    <span className={`inline-block rounded border px-1.5 py-0.5 text-xs font-mono font-bold ${colors[color]}`}>
      {children}
    </span>
  );
}

function EndpointRow({ method, path, desc }: { method: string; color?: string; path: string; desc: string }) {
  const methodColor: Record<string, string> = {
    GET:    "text-emerald-400",
    POST:   "text-blue-600",
    PUT:    "text-yellow-400",
    PATCH:  "text-orange-400",
    DELETE: "text-red-400",
  };
  return (
    <div className="flex items-start gap-3 py-2 border-b border-gray-100 last:border-0">
      <span className={`w-14 shrink-0 text-xs font-bold font-mono ${methodColor[method] ?? "text-gray-900"}`}>
        {method}
      </span>
      <span className="font-mono text-xs text-gray-900 min-w-0 break-all">{path}</span>
      <span className="text-xs text-gray-500 ml-auto shrink-0 hidden sm:block">{desc}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function DeveloperPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-xs text-gray-500 hover:text-blue-600 transition-colors">
              ← Back to login
            </Link>
            <span className="text-blue-500/30">|</span>
            <span className="text-sm font-bold text-gray-900" style={{ fontFamily: "var(--font-geist-sans), sans-serif" }}>
              {APP_NAME} API
            </span>
          </div>
          <span className="rounded border border-gray-300 bg-gray-100 px-2 py-0.5 text-xs font-mono text-blue-600">
            v1
          </span>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-6 py-10 flex gap-10">

        {/* Sticky left nav */}
        <nav className="hidden lg:block w-44 shrink-0">
          <div className="sticky top-20 space-y-0.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">On this page</p>
            {NAV_ITEMS.map(item => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="block text-xs text-gray-500 hover:text-blue-600 py-1.5 border-l-2 border-transparent hover:border-blue-500 pl-3 transition-colors"
              >
                {item.label}
              </a>
            ))}
          </div>
        </nav>

        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-10">

          {/* Intro */}
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "var(--font-geist-sans), sans-serif" }}>
              Developer Docs
            </h1>
            <p className="text-sm text-gray-500 max-w-2xl">
              {APP_NAME} exposes a REST API for reading and writing tenant-scoped collection data.
              Two authentication methods are supported: <strong className="text-gray-900">App Credentials</strong> for
              server-to-server integrations, and <strong className="text-gray-900">User Tokens</strong> for user-facing apps.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Badge color="cyan">Bearer Token Auth</Badge>
              <Badge color="purple">Tenant-Isolated</Badge>
              <Badge color="green">100 req / min</Badge>
            </div>
          </div>

          {/* Auth Method A — App Credentials (recommended) */}
          <Section id="auth-app" title="Auth Method A — App Credentials (Recommended)">
            <p className="text-sm text-gray-500">
              Best for <strong className="text-gray-900">server-to-server integrations</strong>, cron jobs, ETL pipelines, and
              any automated system. Tenant is embedded in the token — no <code className="text-blue-600 font-mono text-xs">X-Tenant-Id</code> header needed.
            </p>

            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider pt-1">1. Create an App</p>
            <div className="rounded-lg border border-gray-200 bg-white p-3 text-xs text-gray-500 space-y-1">
              <p>
                Go to <strong className="text-gray-900">Security → API Apps</strong> in the {APP_NAME} dashboard.
                Click <strong className="text-gray-900">Create App</strong> and copy the <code className="text-blue-600 font-mono">app_id</code> and <code className="text-blue-600 font-mono">app_secret</code>.
              </p>
              <p className="text-yellow-600">
                The secret is only shown once — store it securely.
              </p>
            </div>

            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider pt-2">2. Exchange for a Token</p>
            <Code>{`curl -X POST "$BASE/auth/token" \\
  -H "Content-Type: application/json" \\
  -d '{"app_id":"pb_app_a1b2c3d4e5f6g7h8","app_secret":"pb_sec_..."}'

# Response:
# { "access_token": "eyJ...", "token_type": "Bearer", "expires_in": 3600 }`}</Code>

            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider pt-2">3. Use the Token</p>
            <Code>{`TOKEN="eyJ..."   # access_token from step 2
BASE="https://your-domain.com/api"

# No X-Tenant-Id needed — tenant is embedded in the token
curl "$BASE/collections?type=all" \\
  -H "Authorization: Bearer $TOKEN"`}</Code>

            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700 space-y-1">
              <p><strong>Security benefits:</strong></p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>Tenant ID is never exposed to integrators</li>
                <li>Secrets can be rotated instantly via the dashboard</li>
                <li>Apps can be deactivated or deleted to revoke access</li>
                <li>Optional expiry date for time-limited integrations</li>
              </ul>
            </div>
          </Section>

          {/* Auth Method B — User Token */}
          <Section id="auth-user" title="Auth Method B — User Token">
            <p className="text-sm text-gray-500">
              Best for <strong className="text-gray-900">mobile apps, employee portals</strong>, and user-facing features
              where individual identity and per-user permissions matter.
            </p>

            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider pt-1">1. Get an Access Token</p>
            <Code>{`curl -s -X POST "${SUPABASE_URL}/auth/v1/token?grant_type=password" \\
  -H "apikey: ${ANON_KEY}" \\
  -H "Content-Type: application/json" \\
  -d '{"email":"you@company.com","password":"••••••••"}' \\
  | jq -r '.access_token'`}</Code>
            <div className="rounded-lg border border-gray-200 bg-white p-3 text-xs text-gray-500 space-y-1">
              <p>Replace the placeholders above with your project values:</p>
              <ul className="list-disc list-inside space-y-0.5 text-gray-500">
                <li><code className="text-blue-600 font-mono">&lt;project-ref&gt;</code> — your Supabase project reference ID</li>
                <li><code className="text-blue-600 font-mono">&lt;your-supabase-anon-key&gt;</code> — the <strong className="text-gray-900">anon / public</strong> key (not service_role)</li>
              </ul>
            </div>

            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider pt-2">2. Set Your Variables</p>
            <Code>{`TOKEN="eyJ..."          # access_token from step 1
TENANT="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"  # your tenant UUID
BASE="https://your-domain.com/api"

# User tokens require X-Tenant-Id header
curl "$BASE/collections?type=all" \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "X-Tenant-Id: $TENANT"`}</Code>
          </Section>

          {/* Endpoint reference */}
          <Section id="endpoints" title="Endpoint Reference">
            <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-0.5">
              <EndpointRow method="POST"   path="/api/auth/token"                        desc="Exchange app credentials for JWT" />
              <div className="border-b border-gray-200 my-1" />
              <EndpointRow method="GET"    path="/api/collections"                       desc="List collections" />
              <EndpointRow method="POST"   path="/api/collections"                       desc="Create collection" />
              <EndpointRow method="GET"    path="/api/collections/:slug"                 desc="Get schema + fields" />
              <EndpointRow method="PUT"    path="/api/collections/:slug"                 desc="Update collection" />
              <EndpointRow method="DELETE" path="/api/collections/:slug"                 desc="Delete collection" />
              <EndpointRow method="GET"    path="/api/collections/:slug/items"           desc="List items (paginated)" />
              <EndpointRow method="POST"   path="/api/collections/:slug/items"           desc="Create item" />
              <EndpointRow method="GET"    path="/api/collections/:slug/items/:id"       desc="Get single item" />
              <EndpointRow method="PUT"    path="/api/collections/:slug/items/:id"       desc="Update item" />
              <EndpointRow method="DELETE" path="/api/collections/:slug/items/:id"       desc="Delete item" />
              <EndpointRow method="GET"    path="/api/collections/:slug/items/:id/translations"    desc="Get item translations" />
              <EndpointRow method="PATCH"  path="/api/collections/:slug/items/:id/translations"    desc="Upsert translations" />
              <EndpointRow method="DELETE" path="/api/collections/:slug/items/:id/translations"    desc="Delete translations" />
              <EndpointRow method="GET"    path="/api/collections/:slug/export"          desc="Export CSV / JSON" />
              <EndpointRow method="POST"   path="/api/collections/:slug/import"          desc="Bulk import" />
              <EndpointRow method="GET"    path="/api/content-catalogs"                  desc="List catalogs" />
              <EndpointRow method="GET"    path="/api/content-catalogs/:slug"            desc="Catalog items" />
            </div>
          </Section>

          {/* Required headers */}
          <Section id="headers" title="Required Headers">
            <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3 text-sm">
              <div className="flex gap-4">
                <code className="w-56 shrink-0 text-xs font-mono text-blue-600">Authorization</code>
                <span className="text-xs text-gray-500">
                  <code className="text-gray-900">Bearer &lt;access_token&gt;</code> — from app credentials or user login
                </span>
              </div>
              <div className="flex gap-4">
                <code className="w-56 shrink-0 text-xs font-mono text-blue-600">X-Tenant-Id</code>
                <span className="text-xs text-gray-500">
                  <code className="text-gray-900">&lt;tenant-uuid&gt;</code> — <strong className="text-gray-700">only required for user-token auth</strong> (not needed with app credentials)
                </span>
              </div>
              <div className="flex gap-4">
                <code className="w-56 shrink-0 text-xs font-mono text-blue-600">Content-Type</code>
                <span className="text-xs text-gray-500">
                  <code className="text-gray-900">application/json</code> — required for POST / PUT / PATCH
                </span>
              </div>
            </div>
          </Section>

          {/* Multi-language */}
          <Section id="i18n" title="Multi-Language (i18n)">
            <p className="text-sm text-gray-500">
              Fields marked as <code className="text-blue-600 font-mono text-xs">translatable</code> in the schema
              can store per-locale values. Canonical data lives in the item&apos;s <code className="text-blue-600 font-mono text-xs">data</code> column (default language);
              translations are stored separately and resolved via a fallback chain.
            </p>
            <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3 text-xs">
              <div className="flex gap-4">
                <code className="w-56 shrink-0 font-mono text-blue-600">?locale=zh-CN</code>
                <span className="text-gray-500">
                  Merge translated values into <code className="text-gray-900">data</code>. Fallback: <code className="text-gray-900">zh-CN → zh → canonical</code>
                </span>
              </div>
              <div className="flex gap-4">
                <code className="w-56 shrink-0 font-mono text-blue-600">?locale=*</code>
                <span className="text-gray-500">
                  Attach <code className="text-gray-900">_translations</code> object with all locale values to each item
                </span>
              </div>
              <div className="flex gap-4">
                <code className="w-56 shrink-0 font-mono text-blue-600">(omitted)</code>
                <span className="text-gray-500">
                  Returns canonical data only — backwards compatible
                </span>
              </div>
            </div>
            <p className="text-xs text-gray-500">
              The <code className="text-blue-600 font-mono">locale</code> param works on both list and single-item GET endpoints.
              To write translations, use the <code className="text-blue-600 font-mono">translations</code> field on POST/PUT
              or the dedicated <code className="text-blue-600 font-mono">PATCH .../translations</code> endpoint.
            </p>
          </Section>

          {/* Curl examples */}
          <Section id="examples" title="Examples">

            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">List collections</p>
            <Code>{`curl "$BASE/collections?type=all" \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "X-Tenant-Id: $TENANT"`}</Code>

            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider pt-2">Get collection schema</p>
            <Code>{`curl "$BASE/collections/{collection-slug}" \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "X-Tenant-Id: $TENANT"`}</Code>

            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider pt-2">List items — with pagination</p>
            <Code>{`curl "$BASE/collections/{collection-slug}/items?page=1&limit=20&sort=created_at&order=desc" \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "X-Tenant-Id: $TENANT"`}</Code>
            <p className="text-xs text-gray-500">
              Response includes <code className="text-blue-600 font-mono">meta.total</code>,{" "}
              <code className="text-blue-600 font-mono">meta.totalPages</code>, and the{" "}
              <code className="text-blue-600 font-mono">data</code> array.
            </p>

            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider pt-2">List items — translated (single locale)</p>
            <Code>{`# Translated values merged into data (fallback: zh-CN → zh → default)
curl "$BASE/collections/{collection-slug}/items?locale=zh-CN" \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "X-Tenant-Id: $TENANT"

# Response:
# { "data": [{ "id":"...", "data": {"code":"HR", "name":"人力资源"} }],
#   "meta": { "locale":"zh-CN", "page":1, "total":5, ... } }`}</Code>

            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider pt-2">List items — all translations</p>
            <Code>{`# Attach _translations object to each item
curl "$BASE/collections/{collection-slug}/items?locale=*" \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "X-Tenant-Id: $TENANT"

# Response:
# { "data": [{ "id":"...", "data":{"code":"HR","name":"Human Resources"},
#     "_translations": {"zh-CN":{"name":"人力资源"}, "ms":{"name":"Sumber Manusia"}} }] }`}</Code>

            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider pt-2">Create an item</p>
            <Code>{`curl -X POST "$BASE/collections/{collection-slug}/items" \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "X-Tenant-Id: $TENANT" \\
  -H "Content-Type: application/json" \\
  -d '{"data":{"field_slug":"value","another_field":"value"}}'`}</Code>
            <p className="text-xs text-gray-500">
              Replace <code className="text-blue-600 font-mono">field_slug</code> with your collection&apos;s actual field slugs —
              visible in the schema endpoint or the Studio UI.
            </p>

            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider pt-2">Create an item — with translations</p>
            <Code>{`curl -X POST "$BASE/collections/{collection-slug}/items" \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "X-Tenant-Id: $TENANT" \\
  -H "Content-Type: application/json" \\
  -d '{
    "data": {"code": "HR", "name": "Human Resources"},
    "translations": {
      "zh-CN": {"name": "人力资源"},
      "ms":    {"name": "Sumber Manusia"}
    }
  }'`}</Code>
            <p className="text-xs text-gray-500">
              The <code className="text-blue-600 font-mono">translations</code> field is optional. Only fields marked
              as <code className="text-blue-600 font-mono">translatable</code> in the schema can be translated.
            </p>

            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider pt-2">Update an item</p>
            <Code>{`curl -X PUT "$BASE/collections/{collection-slug}/items/{item-id}" \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "X-Tenant-Id: $TENANT" \\
  -H "Content-Type: application/json" \\
  -d '{"data":{"field_slug":"updated-value"}}'`}</Code>

            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider pt-2">Delete an item</p>
            <Code>{`curl -X DELETE "$BASE/collections/{collection-slug}/items/{item-id}" \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "X-Tenant-Id: $TENANT"`}</Code>
            <p className="text-xs text-gray-500">Returns <code className="text-blue-600 font-mono">204 No Content</code> on success.</p>

            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider pt-2">Export as CSV</p>
            <Code>{`curl "$BASE/collections/{collection-slug}/export?format=csv" \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "X-Tenant-Id: $TENANT" \\
  -o export.csv`}</Code>

            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider pt-2">Bulk import</p>
            <Code>{`curl -X POST "$BASE/collections/{collection-slug}/import" \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "X-Tenant-Id: $TENANT" \\
  -H "Content-Type: application/json" \\
  -d '{
    "rows": [
      {"Name": "Alice", "Department": "Engineering"},
      {"Name": "Bob",   "Department": "Design"}
    ],
    "fieldMapping": {
      "Name":       "name",
      "Department": "department"
    }
  }'`}</Code>
            <p className="text-xs text-gray-500">
              <code className="text-blue-600 font-mono">fieldMapping</code> maps your CSV column names to collection field slugs.
              On validation failure the response is <code className="text-blue-600 font-mono">422</code> with a
              per-row <code className="text-blue-600 font-mono">validationErrors</code> array.
            </p>

            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider pt-2">Upsert translations (PATCH)</p>
            <Code>{`# Update translations without touching canonical data
curl -X PATCH "$BASE/collections/{collection-slug}/items/{item-id}/translations" \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "X-Tenant-Id: $TENANT" \\
  -H "Content-Type: application/json" \\
  -d '{
    "zh-CN": {"name": "人力资源部"},
    "th":    {"name": "ทรัพยากรบุคคล"}
  }'`}</Code>
            <p className="text-xs text-gray-500">
              Returns <code className="text-blue-600 font-mono">422</code> if you attempt to translate non-translatable fields.
            </p>

            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider pt-2">Get translations for an item</p>
            <Code>{`curl "$BASE/collections/{collection-slug}/items/{item-id}/translations" \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "X-Tenant-Id: $TENANT"

# Response:
# { "data": { "zh-CN": {"name":"人力资源"}, "ms": {"name":"Sumber Manusia"} } }`}</Code>

            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider pt-2">Delete translations</p>
            <Code>{`# Delete ALL translations for an item
curl -X DELETE "$BASE/collections/{collection-slug}/items/{item-id}/translations" \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "X-Tenant-Id: $TENANT"

# Delete only a specific locale
curl -X DELETE "$BASE/collections/{collection-slug}/items/{item-id}/translations?locale=zh-CN" \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "X-Tenant-Id: $TENANT"`}</Code>

            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider pt-2">List content catalogs</p>
            <Code>{`curl "$BASE/content-catalogs" \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "X-Tenant-Id: $TENANT"

# Get items for a specific catalog (e.g. gender, country, marital-status)
curl "$BASE/content-catalogs/{catalog-slug}" \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "X-Tenant-Id: $TENANT"`}</Code>
          </Section>

          {/* Webhooks & Events */}
          <Section id="webhooks" title="Webhooks & Events">
            <p className="text-sm text-gray-500">
              PulseBoard fires outbound HTTP webhooks after item mutations, and supports two additional
              server-side hook points: <strong className="text-gray-900">onPreSave</strong> (blocking — can reject writes)
              and per-field <strong className="text-gray-900">validation hooks</strong> (server-side — works without JS).
              All hooks are configured in Studio → Collection → <code className="text-blue-600 font-mono text-xs">Webhooks</code>.
            </p>

            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider pt-1">Event Types</p>
            <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-2 text-xs">
              {[
                ["item.created", "green",  "Fired after POST /items — item successfully inserted"],
                ["item.updated", "yellow", "Fired after PUT /items/:id — item data updated"],
                ["item.deleted", "red",    "Fired after DELETE /items/:id — item removed"],
                ["item.pre_save","purple", "onPreSave hook — fired before insert/update, can block"],
              ].map(([ev, color, desc]) => (
                <div key={ev} className="flex items-start gap-3">
                  <Badge color={color as "green" | "yellow" | "red" | "purple"}>{ev}</Badge>
                  <span className="text-gray-500">{desc}</span>
                </div>
              ))}
            </div>

            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider pt-2">Webhook Payload</p>
            <Code>{`// POST to your endpoint
// Headers:
//   Content-Type: application/json
//   X-PulseBoard-Event: item.created
//   X-PulseBoard-Collection: employees
//   X-PulseBoard-Signature: sha256=<hmac-sha256-hex>  (if secret configured)
//   User-Agent: PulseBoard-Webhooks/1.0

{
  "event":      "item.created",
  "collection": "employees",
  "tenant_id":  "uuid",
  "timestamp":  "2026-03-20T10:30:00.000Z",
  "data": {
    "id":         "uuid",
    "data":       { "name": "Alice", "department": "Engineering" },
    "created_at": "2026-03-20T10:30:00.000Z",
    "updated_at": "2026-03-20T10:30:00.000Z"
  }
}`}</Code>

            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider pt-2">Signature Verification</p>
            <Code>{`// Node.js example
const crypto = require("crypto");

function verifySignature(secret, rawBody, signatureHeader) {
  const expected = "sha256=" + crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(signatureHeader)
  );
}

// Express example
app.post("/webhook", express.raw({ type: "application/json" }), (req, res) => {
  const sig = req.headers["x-pulseboard-signature"];
  if (!verifySignature(process.env.WEBHOOK_SECRET, req.body, sig)) {
    return res.status(401).send("Invalid signature");
  }
  const event = JSON.parse(req.body);
  // handle event...
  res.status(200).send("ok");
});`}</Code>

            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider pt-2">onPreSave Hook</p>
            <p className="text-xs text-gray-500">
              Configured in Studio. Called before every item insert or update.
              Return <code className="text-blue-600 font-mono">2xx</code> to allow,
              or <code className="text-red-400 font-mono">4xx</code> to block with a custom error.
              The error message or <code className="text-blue-600 font-mono">errors</code> array from your response
              is forwarded to the caller as a <code className="text-blue-600 font-mono">422</code>.
            </p>
            <Code>{`// Your onPreSave endpoint receives:
{
  "event":      "item.pre_save",
  "collection": "employees",
  "tenant_id":  "uuid",
  "action":     "create",          // "create" | "update"
  "data":       { "name": "Alice", ... },
  "item_id":    "uuid"             // only on "update"
}

// To allow: return 200
// To block with message:
{ "message": "Employee name already exists in payroll system" }

// To block with field-level errors (shown inline in the form):
{
  "errors": [
    { "field": "employee_id", "message": "ID already registered" },
    { "field": "start_date",  "message": "Cannot backdate more than 90 days" }
  ]
}`}</Code>

            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider pt-2">Field-Level Validation Rules</p>
            <p className="text-xs text-gray-500">
              Add a <code className="text-blue-600 font-mono">validation</code> key to any field&apos;s{" "}
              <code className="text-blue-600 font-mono">options</code> JSONB in the schema.
              Evaluated server-side before every write — no JavaScript required.
            </p>
            <Code>{`// collection_fields.options (per field, set via Studio or API)
{
  // Built-in rules (evaluated by PulseBoard):
  "validation": {
    "min":           0,               // number fields
    "max":           100,             // number fields
    "pattern":       "^[A-Z]{3}$",   // text fields (regex)
    "error_message": "Must be 3 uppercase letters",

    // External validation webhook (per field, fail-open by default):
    "webhook_url":        "https://your-api.com/validate/employee-id",
    "webhook_timeout_ms": 3000
  }
}

// Your field webhook_url receives:
{ "field": "employee_id", "value": "EMP001", "data": { ...full item data... } }

// Return 200 to pass, 4xx to fail:
{ "message": "Employee ID already exists" }`}</Code>

            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-700 space-y-1">
              <p><strong>Delivery guarantees:</strong></p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>Outbound webhooks fire after the response is sent (non-blocking)</li>
                <li>Delivery attempts are logged — view in Studio → Collection → Webhooks</li>
                <li>No automatic retry (planned for a future release)</li>
                <li>Timeout: 8 seconds per webhook endpoint</li>
                <li>onPreSave hooks timeout at your configured value (default: 5 seconds), fail-open unless <code className="font-mono">fail_strict: true</code></li>
              </ul>
            </div>
          </Section>

          {/* Rate limits */}
          <Section id="rate-limits" title="Rate Limits">
            <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm space-y-2">
              <p className="text-gray-500 text-xs">100 requests per 60 seconds per access token. Response headers:</p>
              <Code>{`X-RateLimit-Limit:     100
X-RateLimit-Remaining: 97
X-RateLimit-Reset:     1710000000   # Unix timestamp`}</Code>
              <p className="text-xs text-gray-500">
                Exceeding the limit returns <code className="text-red-400 font-mono">429 Too Many Requests</code>.
                Wait until <code className="text-blue-600 font-mono">X-RateLimit-Reset</code> before retrying.
              </p>
            </div>
          </Section>

          {/* Error codes */}
          <Section id="errors" title="Error Codes">
            <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-2 text-xs">
              {[
                ["400", "yellow", "Bad request — missing or invalid parameters"],
                ["401", "red",    "Missing, invalid, or expired access token"],
                ["403", "red",    "Token is valid but user is not a member of the requested tenant"],
                ["404", "yellow", "Collection or item not found (also returned for tenant isolation mismatches)"],
                ["422", "yellow", "Validation failed — errors array (field-level) or import validationErrors"],
                ["429", "red",    "Rate limit exceeded"],
                ["500", "red",    "Internal server error — check the message field"],
              ].map(([code, color, desc]) => (
                <div key={code} className="flex items-start gap-3">
                  <Badge color={color as "yellow" | "red"}>{code}</Badge>
                  <span className="text-gray-500">{desc}</span>
                </div>
              ))}
            </div>
          </Section>

          {/* Privacy note */}
          <Section id="privacy" title="Privacy & Tenant Isolation">
            <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-4 text-xs text-gray-500 space-y-2">
              <p>
                All tenant collection data is strictly isolated. A valid token will never return data
                belonging to another tenant — even if the resource ID is guessed correctly.
              </p>
              <p>
                System collections (maintained by the platform) are read-accessible to all authenticated tenants.
                Write access to system collections requires super-admin role.
              </p>
              <p className="text-yellow-600">
                Keep your <code className="font-mono">app_secret</code> and <code className="font-mono">access_token</code> confidential.
                Tokens expire after 1 hour. If an app secret is compromised, rotate it immediately
                from <strong>Security → API Apps</strong>.
              </p>
            </div>
          </Section>

          {/* Footer */}
          <div className="border-t border-gray-200 pt-6 text-center text-xs text-gray-500">
            <p>
              {APP_NAME} Platform API · Questions? Contact your platform administrator.
            </p>
            <Link href="/login" className="mt-2 inline-block text-blue-400 hover:text-blue-600 transition-colors">
              ← Back to {APP_NAME}
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
}
