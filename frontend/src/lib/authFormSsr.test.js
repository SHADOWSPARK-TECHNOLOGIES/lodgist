// /login and /register must server-render their forms: the page is a server
// component that reads ?next itself (through safeNextPath) and passes it to a
// client form, so there is no empty Suspense fallback in the server HTML.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = (p) => fs.readFileSync(path.join(__dirname, "..", "app", p), "utf8");

for (const [dir, form] of [["login", "LoginForm"], ["register", "RegisterForm"]]) {
  test(`${dir}/page.tsx is a server component that resolves ?next safely`, () => {
    const page = read(`${dir}/page.tsx`);
    assert.doesNotMatch(page, /['"]use client['"]/);
    assert.doesNotMatch(page, /Suspense|useSearchParams/);
    assert.match(page, /await searchParams/);
    assert.match(page, /safeNextPath\(/);
    assert.match(page, new RegExp(`<${form} nextPath=\\{nextPath\\} />`));
  });

  test(`${dir}/${form}.tsx is the client form, takes nextPath as a prop, posts without JS`, () => {
    const src = read(`${dir}/${form}.tsx`);
    assert.match(src, /^['"]use client['"]/);
    assert.doesNotMatch(src, /useSearchParams/);
    assert.match(src, /nextPath: string \| null/);
    // Without JS a GET submit would put the password in the URL.
    assert.match(src, /<form[^>]*method="post"/);
  });
}
