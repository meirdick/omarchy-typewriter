// Behaviour of bin/omarchy-typewriter, asserted by shelling out to the real
// script through its hidden seams. No model and no network are involved, so
// these run anywhere.
//
//   node --test test/*.test.js

const { test } = require("node:test");
const assert = require("node:assert");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const TOOL = path.join(__dirname, "..", "bin", "omarchy-typewriter");

// Keep the tests out of the real session's runtime directory. Without this a
// test that exercises a failure leaves that failure sitting in the user's bar.
const RUNTIME = fs.mkdtempSync(path.join(require("node:os").tmpdir(), "tw-test-"));

function run(args, env = {}) {
  return execFileSync(TOOL, args, {
    encoding: "utf8",
    // Never raise a desktop notification from a test run. Isolating
    // XDG_RUNTIME_DIR is not enough - notify-send reaches the session daemon
    // whatever the environment says.
    env: { ...process.env, XDG_RUNTIME_DIR: RUNTIME, TYPEWRITER_NOTIFY: "0", ...env },
  });
}

function runFail(args, env = {}) {
  try {
    run(args, env);
    return null;
  } catch (e) {
    return (e.stderr || "") + (e.stdout || "");
  }
}

// A preset name becomes a file path, so it has to be validated before it
// reaches the filesystem.
test("rejects a preset name that escapes the prompt directory", () => {
  assert.match(
    runFail(["../../../etc/passwd", "--text", "x", "--print"]),
    /invalid preset name/
  );
});

test("rejects a preset name with a slash", () => {
  assert.match(runFail(["sub/dir", "--text", "x", "--print"]), /invalid preset name/);
});

test("reports an unknown preset by name", () => {
  assert.match(runFail(["nosuchpreset", "--text", "x", "--print"]), /no prompt named/);
});

// The <text> wrapper and the repeated trailing instruction are what stop a
// short, question-like selection being answered instead of transformed. They
// have no other test, and they are easy to break with a careless edit.
test("wraps the selection in text tags", () => {
  const out = run(["proof", "--text", "hello there", "--render-prompt"]);
  assert.match(out, /<text>\nhello there\n<\/text>/);
});

test("repeats the instruction after the text", () => {
  const payload = run(["proof", "--text", "hello", "--render-prompt"]).split("===PAYLOAD===")[1];
  assert.match(payload, /Transform the text above and output only the result\./);
});

test("tells the model the selection is data, not a question", () => {
  const system = run(["proof", "--text", "is this working?", "--render-prompt"])
    .split("===PAYLOAD===")[0];
  assert.match(system, /never a question for you/);
  assert.match(system, /not a conversational assistant/);
});

test("carries the preset's own instruction into the system prompt", () => {
  const system = run(["bullets", "--text", "a", "--render-prompt"]).split("===PAYLOAD===")[0];
  assert.match(system, /bulleted list/i);
});

test("a one-off instruction needs no prompt file", () => {
  const system = run(["--text", "hola", "--render-prompt", "--", "translate to french"])
    .split("===PAYLOAD===")[0];
  assert.match(system, /translate to french/);
});

// Backend order: local first, then pi, then cloudflare, then anthropic.
const OFFLINE = { TYPEWRITER_OLLAMA_URL: "http://127.0.0.1:1" };

test("auto prefers pi over cloudflare when no local model is present", () => {
  const out = run(["proof", "--text", "x", "--select-backend"], {
    ...OFFLINE,
    TYPEWRITER_BACKEND: "auto",
    TYPEWRITER_PI_MODEL: "anthropic/claude-haiku-4-5",
    TYPEWRITER_CF_ACCOUNT: "abc",
  });
  assert.strictEqual(out.trim(), "pi");
});

test("auto falls through to cloudflare when pi has no model", () => {
  const out = run(["proof", "--text", "x", "--select-backend"], {
    ...OFFLINE,
    TYPEWRITER_BACKEND: "auto",
    TYPEWRITER_PI_MODEL: "",
    TYPEWRITER_CF_ACCOUNT: "abc",
  });
  assert.strictEqual(out.trim(), "cloudflare");
});

test("'local' is accepted as a name for the ollama backend", () => {
  const out = run(["proof", "--text", "x", "--select-backend"], {
    TYPEWRITER_BACKEND: "local",
  });
  assert.strictEqual(out.trim(), "ollama");
});

test("says what to run when nothing is configured", () => {
  const err = runFail(["proof", "--text", "x", "--print"], {
    ...OFFLINE,
    TYPEWRITER_BACKEND: "auto",
    TYPEWRITER_PI_MODEL: "",
    TYPEWRITER_CF_ACCOUNT: "",
    TYPEWRITER_CF_TOKEN_FILE: "/nonexistent",
    ANTHROPIC_API_KEY: "",
  });
  assert.match(err, /no backend configured - run omarchy-typewriter-setup/);
});

// pi ships read, bash, edit and write tools. This tool feeds it text the user
// did not write, so running it without --no-tools would hand a prompt-injected
// selection a shell. This is a security control, not a tuning flag.
test("the pi backend disables tools and sessions", () => {
  const src = fs.readFileSync(TOOL, "utf8");
  const call = src.slice(src.indexOf("  pi)"), src.indexOf('  *) die "unknown backend'));
  assert.match(call, /--no-tools/, "pi must never run with its tools enabled");
  assert.match(call, /--no-session/, "pi must not persist every refined sentence");
  assert.doesNotMatch(call, /\s--\s/, "passing -- to pi hangs until killed");
});

test("a bad scope is refused", () => {
  assert.match(runFail(["proof", "--scope", "sideways", "--copy"]), /unknown scope/);
});

test("the words scope needs a number", () => {
  assert.match(runFail(["proof", "--scope", "words:many", "--copy"]), /needs a number/);
});
