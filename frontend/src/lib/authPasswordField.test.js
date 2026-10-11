// Password field: visible rule hint tied to the field (register), error id kept
// in aria-describedby, and a 44px show/hide toggle with aria-pressed (both forms).
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = (p) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");

test("register shows the password rule as visible text linked to the field", () => {
  const src = read("app/register/RegisterForm.tsx");
  assert.match(src, /<p id="register-password-hint"[^>]*>\{auth\.passwordRule\}<\/p>/);
  const input = src.match(/<input id="register-password"[\s\S]*?\/>/)[0];
  assert.match(input, /aria-describedby=\{passwordDescribedBy\}/);
  assert.match(src, /const passwordDescribedBy = \[\s*'register-password-hint',\s*error \? errorId : null,?\s*\]/);
  assert.match(read("lib/copy.ts"), /passwordRule: "At least 8 characters\."/);
});

for (const [file, id] of [["app/login/LoginForm.tsx", "login-password"], ["app/register/RegisterForm.tsx", "register-password"]]) {
  test(`${file}: show/hide toggle`, () => {
    const src = read(file);
    assert.match(src, /<PasswordToggle /);
    assert.match(src, new RegExp(`controls="${id}"`));
    const input = src.match(new RegExp(`<input id="${id}"[\\s\\S]*?\\/>`))[0];
    assert.match(input, /type=\{showPassword \? 'text' : 'password'\}/);
  });
}

test("PasswordToggle is a 44px button with aria-pressed and a fixed name", () => {
  const src = read("components/ui/PasswordToggle.tsx");
  assert.match(src, /type="button"/);
  assert.match(src, /aria-pressed=\{shown\}/);
  assert.match(src, /aria-controls=\{controls\}/);
  assert.match(src, /aria-label=\{auth\.showPassword\}/);
  assert.match(src, /minWidth: 44/);
  assert.match(src, /minHeight: 44/);
});
