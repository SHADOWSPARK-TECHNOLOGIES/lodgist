const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const frontend = path.join(__dirname, "..", "..");
const css = fs.readFileSync(path.join(frontend, "src/app/globals.css"), "utf8");

// Check the shared CSS contract; these tests do not claim browser layout coverage.
function declarations(selector) {
  const rules = [...css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g)];
  const matching = rules.filter(([, selectors]) => selectors.split(",").some((s) => s.trim() === selector));
  assert.ok(matching.length, `Missing CSS rule ${selector}`);
  return Object.fromEntries(matching.flatMap(([, , body]) => body.split(";").flatMap((entry) => {
    const colon = entry.indexOf(":");
    return colon < 0 ? [] : [[entry.slice(0, colon).trim(), entry.slice(colon + 1).trim()]];
  })));
}

function resolveColor(value) {
  assert.ok(value, "Expected an explicit color");
  const variable = /^var\((--[\w-]+)\)$/.exec(value);
  if (variable) {
    const escaped = variable[1].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const token = new RegExp(`${escaped}\\s*:\\s*([^;]+);`).exec(css);
    assert.ok(token, `Missing color token ${variable[1]}`);
    return resolveColor(token[1].trim());
  }
  assert.match(value, /^#[\da-f]{3}(?:[\da-f]{3})?$/i, `Unsupported opaque color ${value}`);
  const hex = value.slice(1);
  const full = hex.length === 3 ? [...hex].map((c) => c + c).join("") : hex;
  return [0, 2, 4].map((offset) => parseInt(full.slice(offset, offset + 2), 16) / 255);
}

function luminance(rgb) {
  const linear = rgb.map((c) => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

for (const hover of [false, true]) {
  test(`primary button ${hover ? "hover" : "normal"} text contrast is at least 4.5:1`, () => {
    const base = declarations(".btn-primary");
    const style = hover ? { ...base, ...declarations(".btn-primary:hover") } : base;
    const foreground = luminance(resolveColor(style.color));
    const background = luminance(resolveColor(style["background-color"] || style.background));
    const contrast = (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
    assert.ok(contrast >= 4.5, `Actual contrast ${contrast.toFixed(2)}:1 is below 4.5:1`);
  });
}

function renderCheckIntake() {
  const ts = require("typescript");
  const React = require("react");
  const { renderToStaticMarkup } = require("react-dom/server");
  const filename = path.join(frontend, "src/components/rental/CheckIntake.tsx");
  const source = fs.readFileSync(filename, "utf8");
  const compiled = ts.transpileModule(source, {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const localModule = { exports: {} };
  // Render the actual component. Boundary stubs prevent navigation or payment API calls.
  const forbidden = () => { throw new Error("Rendering must not navigate or submit a rental case"); };
  const load = (name) => {
    if (name === "next/navigation") return { useRouter: () => ({ push: forbidden }) };
    if (name === "@/lib/api") return { ApiError: class ApiError extends Error {}, rentalChecksApi: { create: forbidden } };
    if (name === "@/lib/rentalCheck") return { formatNaira: () => "₦5,000", RENTAL_PRICE_NGN: 5000 };
    return require(name);
  };
  vm.runInNewContext(compiled, { require: load, module: localModule, exports: localModule.exports }, { filename });
  return renderToStaticMarkup(React.createElement(localModule.exports.default));
}

test("payment evidence inputs server-render persistent labels linked to unique input ids", () => {
  const html = renderCheckIntake();
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  const labels = [...html.matchAll(/<label\b([^>]*)>([\s\S]*?)<\/label>/g)];
  for (const [id, expectedText] of [
    ["rental-bank-name", /bank name/i],
    ["rental-account-name", /account name/i],
    ["rental-account-number", /account number/i],
  ]) {
    assert.equal(ids.filter((value) => value === id).length, 1, `Expected unique input id ${id}`);
    assert.match(html, new RegExp(`<input\\b[^>]*\\bid="${id}"[^>]*>`));
    const label = labels.find(([, attributes]) => new RegExp(`\\bfor="${id}"`).test(attributes));
    assert.ok(label, `Missing persistent label for ${id}`);
    const visibleText = label[2].replace(/<[^>]*>/g, "").trim();
    assert.match(visibleText, expectedText, `Label must identify ${id} without relying on a placeholder`);
  }
});

test("personal autocomplete belongs only to the customer's phone and name", () => {
  const html = renderCheckIntake();
  const labels = [...html.matchAll(/<label\b[^>]*>([\s\S]*?)<\/label>/g)].map((match) => match[1]);
  function inputFor(text) {
    const label = labels.find((content) => text.test(content.replace(/<[^>]*>/g, "").trim()));
    assert.ok(label, `Missing visible customer label ${text}`);
    const input = label.match(/<input\b[^>]*>/);
    assert.ok(input, `Missing customer input ${text}`);
    return input[0];
  }
  const phone = inputFor(/^Your WhatsApp number$/i);
  const name = inputFor(/^Your name \(optional\)$/i);
  assert.match(phone, /\bautoComplete="tel"/i);
  assert.match(name, /\bautoComplete="name"/i);

  const personallyAutofilled = [...html.matchAll(/<input\b[^>]*>/g)].map((match) => match[0]).filter((input) => {
    const autocomplete = input.match(/\bautoComplete="([^"]*)"/i)?.[1] || "";
    return autocomplete.toLowerCase().split(/\s+/).some((token) => token === "tel" || token === "name");
  });
  assert.deepEqual(personallyAutofilled.sort(), [phone, name].sort(),
    "Personal name/phone autofill must not fill landlord, agent or payment evidence fields");
});

test("shared form inputs use a font size of at least 1rem", () => {
  const size = declarations(".input")["font-size"];
  assert.match(size || "", /^\d+(?:\.\d+)?rem$/, "Shared input font size must use scalable rem units");
  assert.ok(parseFloat(size) >= 1, `Input font size ${size} is below 1rem`);
});

test("shared buttons allow wrapping and stay within their container", () => {
  const style = declarations(".btn");
  assert.ok(["normal", "pre-wrap", "break-spaces"].includes(style["white-space"]), "Button labels must wrap");
  assert.equal(style["max-width"] || style["max-inline-size"], "100%", "Buttons must not exceed their container width");
});
