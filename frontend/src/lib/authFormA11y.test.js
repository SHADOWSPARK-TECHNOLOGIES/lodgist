// /login and /register: labels linked to inputs, name + autocomplete for
// password managers, and a submit button that is named and aria-busy while loading.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = (p) => fs.readFileSync(path.join(__dirname, "..", "app", p), "utf8");

function fields(src) {
  const labels = [...src.matchAll(/<label[^>]*htmlFor="([^"]+)"/g)].map((m) => m[1]);
  const inputs = [...src.matchAll(/<input\b[\s\S]*?\/>/g)].map((m) => m[0]);
  return { labels, inputs };
}

const expected = {
  "login/page.tsx": { "login-email": ["email", "email"], "login-password": ["password", "current-password"] },
  "register/page.tsx": {
    "register-name": ["name", "name"],
    "register-email": ["email", "email"],
    "register-phone": ["phone", "tel"],
    "register-password": ["password", "new-password"],
  },
};

for (const [file, ids] of Object.entries(expected)) {
  test(`${file}: every label targets an input with matching id, name and autocomplete`, () => {
    const src = read(file);
    const { labels, inputs } = fields(src);
    assert.deepEqual(labels.sort(), Object.keys(ids).sort());
    assert.equal(inputs.length, labels.length);
    for (const [id, [name, autocomplete]] of Object.entries(ids)) {
      const input = inputs.find((i) => i.includes(`id="${id}"`));
      assert.ok(input, `no input with id ${id}`);
      assert.match(input, new RegExp(`name="${name}"`));
      assert.match(input, new RegExp(`autoComplete="${autocomplete}"`));
    }
  });

  test(`${file}: submit is aria-busy and the spinner has text`, () => {
    const src = read(file);
    assert.match(src, /aria-busy=\{loading\}/);
    assert.match(src, /<span className="spinner" aria-hidden="true" \/>/);
    assert.match(src, /<span className="sr-only">\{auth\.(signingIn|creatingAccount)\}<\/span>/);
  });
}
