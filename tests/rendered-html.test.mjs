import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the ManFix production landing page", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>ManFix Platform<\/title>/i);
  assert.match(html, /One backend\. One login\. Separate portals/);
  assert.match(html, /Live SaaS Platform/);
  assert.match(html, /user_roles/);
  assert.match(html, /Every portal shares live Supabase data/);
  assert.match(html, /Supplier Web Portal/);
  assert.match(html, /Workshop Owner Dashboard/);
  assert.match(html, /Technician Operations/);
  assert.match(html, /Admin Dashboard/);
  assert.doesNotMatch(html, /Codex is working|taking shape|customer app work is paused/i);
});

test("keeps the single-login and role portal links in the server output", async () => {
  const response = await render();
  const html = await response.text();

  assert.match(html, /Open Single Login/);
  assert.match(html, /manhub-auth\.onrender\.com\/login/);
  assert.match(html, /manhub-workshop\.onrender\.com/);
  assert.match(html, /manfix-tech\.onrender\.com/);
  assert.match(html, /Supabase Auth, PostgreSQL, Row Level Security, storage, and API access are shared/);
});
