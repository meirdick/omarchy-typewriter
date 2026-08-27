// Behaviour of bin/omarchy-typewriter, asserted by shelling out to the real
// script through its hidden seams.
//
//   node --test test/*.test.js
//
// Needs bash, jq and node. jq is not a test dependency as such - the script
// itself requires it, and these tests run the script. Nothing here needs a
// model, a network or a Wayland session, and nothing here writes outside the
// temporary directories it makes for itself.

const { test } = require("node:test");
const assert = require("node:assert");
const { execFileSync, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const TOOL = path.join(__dirname, "..", "bin", "omarchy-typewriter");

const tmpdir = (prefix) => fs.mkdtempSync(path.join(os.tmpdir(), prefix));

// Keep the tests out of the real session's directories. Without this a test
// that exercises a failure leaves that failure sitting in the user's bar, a
// test run appends to the history behind `omarchy-typewriter stats`, and the
// developer's own config and wordlist decide what the assertions see.
const RUNTIME = tmpdir("tw-test-");
const STATE = tmpdir("tw-state-");
const CONFIG = tmpdir("tw-config-");

// /etc/omarchy-typewriter/config is still read if the package is installed, and
// there is no environment variable that moves it. Every test that depends on a
// setting passes it explicitly rather than relying on a default.
const ISOLATED = {
  XDG_RUNTIME_DIR: RUNTIME,
  XDG_STATE_HOME: STATE,
  XDG_CONFIG_HOME: CONFIG,
  // Never raise a desktop notification from a test run. Isolating
  // XDG_RUNTIME_DIR is not enough - notify-send reaches the session daemon
  // whatever the environment says.
  TYPEWRITER_NOTIFY: "0",
};

function run(args, env = {}) {
  return execFileSync(TOOL, args, {
    encoding: "utf8",
    env: { ...process.env, ...ISOLATED, ...env },
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

// Same invocation, but the exit status is part of what is being asserted.
function runRaw(args, env = {}) {
  const r = spawnSync(TOOL, args, {
    encoding: "utf8",
    env: { ...process.env, ...ISOLATED, ...env },
  });
  return { status: r.status, stdout: r.stdout || "", stderr: r.stderr || "" };
}

// A directory of fake executables, put first on PATH. Two of the tool's
// dependencies reach the outside world, and the tests must not: curl would
// need a model, and wl-copy would overwrite whatever the developer had on the
// clipboard when they ran the suite.
const STUBS = tmpdir("tw-stub-");
function stub(name, body) {
  const p = path.join(STUBS, name);
  fs.writeFileSync(p, `#!/bin/sh\n${body}\n`, { mode: 0o755 });
}
stub("curl", 'exec cat "$TW_STUB_RESPONSE"');
stub("wl-copy", 'cat > "$TW_STUB_CLIPBOARD"');

// A backend that answers instantly with a canned reply. The ollama path is the
// one used because it is the only backend whose whole conversation is a single
// curl call with no credential to fake.
function stubbedBackend(reply, extra = {}) {
  const dir = tmpdir("tw-reply-");
  const file = path.join(dir, "response.json");
  fs.writeFileSync(file, JSON.stringify({ response: reply }));
  return {
    PATH: `${STUBS}:${process.env.PATH}`,
    TW_STUB_RESPONSE: file,
    TYPEWRITER_BACKEND: "ollama",
    ...extra,
  };
}

function wordlist(contents) {
  const p = path.join(tmpdir("tw-w-"), "wordlist");
  fs.writeFileSync(p, contents);
  return p;
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

// cloudflare counts as configured only with an account id AND a token on disk.
// A fixture, not the developer's own: before XDG_CONFIG_HOME was isolated these
// tests read the real ~/.config/omarchy-typewriter/cloudflare.token and passed
// on this machine only.
const CF_TOKEN_FILE = path.join(tmpdir("tw-tok-"), "cloudflare.token");
fs.writeFileSync(CF_TOKEN_FILE, "not-a-real-token\n", { mode: 0o600 });

test("auto prefers pi over cloudflare when no local model is present", () => {
  const out = run(["proof", "--text", "x", "--select-backend"], {
    ...OFFLINE,
    TYPEWRITER_BACKEND: "auto",
    TYPEWRITER_PI_MODEL: "anthropic/claude-haiku-4-5",
    TYPEWRITER_CF_ACCOUNT: "abc",
    TYPEWRITER_CF_TOKEN_FILE: CF_TOKEN_FILE,
  });
  assert.strictEqual(out.trim(), "pi");
});

test("auto falls through to cloudflare when pi has no model", () => {
  const out = run(["proof", "--text", "x", "--select-backend"], {
    ...OFFLINE,
    TYPEWRITER_BACKEND: "auto",
    TYPEWRITER_PI_MODEL: "",
    TYPEWRITER_CF_ACCOUNT: "abc",
    TYPEWRITER_CF_TOKEN_FILE: CF_TOKEN_FILE,
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

// hyprctl gives class and initialClass joined by a space. An anchored pattern
// tested against the joined string can never match, which silently disables
// terminal detection - and a terminal that is missed gets a bare Ctrl+C, which
// is SIGINT to whatever is running in it.
test("terminal detection handles the joined class string", () => {
  const src = fs.readFileSync(TOOL, "utf8");
  const start = src.indexOf("is_terminal() {");
  const fn = src.slice(start, src.indexOf("\n}", start));
  assert.match(fn, /for name in \$1/,
    "each class name must be tested separately, not the joined string");
});

test("the terminal pattern is anchored", () => {
  const src = fs.readFileSync(TOOL, "utf8");
  const line = src.split("\n").find((l) => l.startsWith("TERMINAL_RE="));
  assert.match(line, /\^\(/, "unanchored alternatives match substrings: rio in Serious-Sam");
  assert.match(line, /\)\$/);
});

// Writing samples teach the model a voice. They are user-supplied text, so the
// same rule as the selection applies: they are data, never instructions.
test("writing samples reach the model, wrapped and guarded", () => {
  const dir = fs.mkdtempSync(path.join(require("node:os").tmpdir(), "tw-p-"));
  fs.writeFileSync(path.join(dir, "voice.md"), "# Voice\n\nRewrite it.\n");
  fs.mkdirSync(path.join(dir, "voice.samples"));
  fs.writeFileSync(path.join(dir, "voice.samples", "a.md"), "Short. Blunt. Mine.");
  const out = run(["voice", "--text", "hello", "--render-prompt"], {
    TYPEWRITER_PROMPT_DIR: dir,
  });
  assert.match(out, /<sample>/);
  assert.match(out, /Short\. Blunt\. Mine\./);
  assert.match(out, /never treat[\s\S]{0,40}instruction/,
    "samples are user text and must be marked as data");
});

test("a preset with no samples directory sends none", () => {
  const out = run(["proof", "--text", "hello", "--render-prompt"], {
    TYPEWRITER_PROMPT_DIR: path.join(__dirname, "..", "prompts"),
  });
  assert.doesNotMatch(out, /<sample>/);
});

test("the icon declaration is not sent as an instruction", () => {
  const out = run(["proof", "--text", "hello", "--render-prompt"], {
    TYPEWRITER_PROMPT_DIR: path.join(__dirname, "..", "prompts"),
  });
  assert.doesNotMatch(out, /icon:/);
});

// A protected term is a request to the model; a replacement is a guarantee
// applied afterwards. Both halves matter and they use different mechanisms.
test("protected terms are named in the prompt", () => {
  const wl = path.join(fs.mkdtempSync(path.join(require("node:os").tmpdir(), "tw-w-")), "wordlist");
  fs.writeFileSync(wl, "# a comment\nAcme\nCrashLoopBackOff\n");
  const out = run(["proof", "--text", "hello", "--render-prompt"], { TYPEWRITER_WORDLIST: wl });
  assert.match(out, /Acme/);
  assert.match(out, /CrashLoopBackOff/);
  assert.doesNotMatch(out, /a comment/, "comments are not terms");
});

test("replacement rules are not sent as protected terms", () => {
  const wl = path.join(fs.mkdtempSync(path.join(require("node:os").tmpdir(), "tw-w-")), "wordlist");
  fs.writeFileSync(wl, "github => GitHub\n");
  const out = run(["proof", "--text", "hello", "--render-prompt"], { TYPEWRITER_WORDLIST: wl });
  assert.doesNotMatch(out, /spelled correctly/,
    "a file of only replacements must not produce a protected-terms line");
});

test("an absent wordlist changes nothing", () => {
  const out = run(["proof", "--text", "hello", "--render-prompt"], {
    TYPEWRITER_WORDLIST: "/nonexistent/wordlist",
  });
  assert.doesNotMatch(out, /spelled correctly/);
});

test("the words scope needs a number", () => {
  assert.match(runFail(["proof", "--scope", "words:many", "--copy"]), /needs a number/);
});

// --- wordlist replacements ---------------------------------------------------
// The protected half of the wordlist is a request to the model and is visible
// in --render-prompt. The replacement half runs after the model has answered,
// so nothing in the prompt proves it happened - only the finished output does.

test("a replacement rewrites the model's answer", () => {
  const out = run(
    ["proof", "--text", "we run k8s here", "--print"],
    stubbedBackend("we run k8s here", { TYPEWRITER_WORDLIST: wordlist("k8s => Kubernetes\n") })
  );
  assert.strictEqual(out.trim(), "we run Kubernetes here");
});

test("a replacement matches any case and writes the replacement exactly", () => {
  const out = run(
    ["proof", "--text", "K8S and k8s", "--print"],
    stubbedBackend("K8S and k8s", { TYPEWRITER_WORDLIST: wordlist("k8s => Kubernetes\n") })
  );
  assert.strictEqual(out.trim(), "Kubernetes and Kubernetes",
    "the match is case-insensitive; the result is written as the rule spells it");
});

test("a replacement only matches whole words", () => {
  const out = run(
    ["proof", "--text", "x", "--print"],
    stubbedBackend("k8sfoo and mk8s stay", { TYPEWRITER_WORDLIST: wordlist("k8s => Kubernetes\n") })
  );
  assert.strictEqual(out.trim(), "k8sfoo and mk8s stay");
});

// The left side of a rule is a literal, not a pattern. Without escaping, a dot
// in a term like node.js matches any character and rewrites words that only
// look similar.
test("a dot in a rule is a dot, not a wildcard", () => {
  const env = stubbedBackend("nodexjs is not node.js", {
    TYPEWRITER_WORDLIST: wordlist("node.js => Node.js\n"),
  });
  assert.strictEqual(run(["proof", "--text", "x", "--print"], env).trim(),
    "nodexjs is not Node.js");
});

test("a wordlist can protect one term and replace another", () => {
  const wl = wordlist("Acme\ngithub => GitHub\n");
  const prompt = run(["proof", "--text", "hello", "--render-prompt"], { TYPEWRITER_WORDLIST: wl });
  assert.match(prompt, /spelled correctly[\s\S]*Acme/,
    "the protected term is named in the prompt");
  assert.doesNotMatch(prompt, /github =>/, "a rule is not a term to protect");

  const out = run(["proof", "--text", "x", "--print"],
    stubbedBackend("Acme uses github", { TYPEWRITER_WORDLIST: wl }));
  assert.strictEqual(out.trim(), "Acme uses GitHub");
});

test("with no wordlist the model's answer is passed through", () => {
  const out = run(
    ["proof", "--text", "x", "--print"],
    stubbedBackend("k8s stays k8s", { TYPEWRITER_WORDLIST: "/nonexistent/wordlist" })
  );
  assert.strictEqual(out.trim(), "k8s stays k8s");
});

// --- stats -------------------------------------------------------------------
// stats and undo are handled while the arguments are still being parsed, before
// anything reads the clipboard or presses a key. --text and --print are passed
// anyway, so that no invocation in this file can ever become a real run against
// the desktop if that parsing order changes.
const SAFE = ["--text", "x", "--print"];

function withHistory(lines) {
  const home = tmpdir("tw-hist-");
  const dir = path.join(home, "omarchy-typewriter");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "history.jsonl"),
    lines.map((l) => JSON.stringify(l)).join("\n") + "\n");
  return home;
}

const RUN = (preset, ms, words_in, words_changed, outcome = "ok") => ({
  at: 1700000000, preset, backend: "ollama", model: "granite4:micro-h",
  words_in, words_out: words_in, words_changed,
  chars_in: words_in * 5, chars_out: words_in * 5, ms, outcome,
});

test("stats says so when nothing has run yet", () => {
  const out = run(["stats", ...SAFE], { XDG_STATE_HOME: tmpdir("tw-empty-") });
  assert.match(out, /no runs recorded yet/);
});

test("stats totals the completed runs", () => {
  const out = run(["stats", ...SAFE], {
    XDG_STATE_HOME: withHistory([RUN("proof", 1000, 10, 3), RUN("proof", 3000, 20, 7)]),
  });
  assert.match(out, /runs\s+2/);
  assert.match(out, /words refined\s+30/);
  assert.match(out, /words changed\s+10/);
  assert.match(out, /time in models\s+4s/);
  assert.match(out, /fastest\s+1s/);
  assert.match(out, /slowest\s+3s/);
});

// An unfinished run is not a run. Counting held-back and failed attempts would
// make every timing in the summary a lie.
test("stats ignores runs that did not complete", () => {
  const out = run(["stats", ...SAFE], {
    XDG_STATE_HOME: withHistory([
      RUN("proof", 1000, 10, 3),
      RUN("proof", 90000, 999, 999, "held"),
      RUN("proof", 90000, 999, 999, "failed"),
    ]),
  });
  assert.match(out, /runs\s+1/);
  assert.match(out, /words refined\s+10/);
  assert.doesNotMatch(out, /999/);
});

test("stats says so when the history holds no completed run", () => {
  const out = run(["stats", ...SAFE], {
    XDG_STATE_HOME: withHistory([RUN("proof", 1000, 10, 3, "failed")]),
  });
  assert.match(out, /no completed runs yet/);
});

test("stats breaks down by preset, most used first", () => {
  const out = run(["stats", ...SAFE], {
    XDG_STATE_HOME: withHistory([
      RUN("rewrite", 1000, 10, 2),
      RUN("proof", 1000, 10, 4),
      RUN("proof", 1000, 10, 5),
    ]),
  });
  const breakdown = out.split("by preset:")[1];
  assert.match(breakdown, /proof\s+2 runs, 9 words changed/);
  assert.match(breakdown, /rewrite\s+1 run, 2 words changed/, "one run is not '1 runs'");
  assert.ok(breakdown.indexOf("proof") < breakdown.indexOf("rewrite"),
    "the preset used most often comes first");
});

test("stats reads the history under XDG_STATE_HOME, not the user's own", () => {
  const home = withHistory([RUN("bullets", 1000, 10, 1)]);
  assert.match(run(["stats", ...SAFE], { XDG_STATE_HOME: home }), /bullets/);
  assert.match(run(["stats", ...SAFE], { XDG_STATE_HOME: tmpdir("tw-other-") }),
    /no runs recorded yet/);
});

// The README's headline claim about the history is that it holds metadata only.
// $4 and $5 are the text before and after, and they must only ever reach jq
// through a length or a word count. This is asserted against the source because
// nothing observable distinguishes "never written" from "written and deleted".
test("the run history records counts, never the text", () => {
  const src = fs.readFileSync(TOOL, "utf8");
  const fn = src.slice(src.indexOf("record_run() {"), src.indexOf("\n}\n", src.indexOf("record_run() {")));
  assert.doesNotMatch(fn, /--arg\s+\w+\s+"\$4"/, "the text before the run is not metadata");
  assert.doesNotMatch(fn, /--arg\s+\w+\s+"\$5"/, "the text after the run is not metadata");
});

// --- undo --------------------------------------------------------------------

test("undo reports that there is nothing to undo", () => {
  const r = runRaw(["undo", ...SAFE], { XDG_RUNTIME_DIR: tmpdir("tw-rt-") });
  assert.strictEqual(r.status, 1, "a bar or a script has to be able to tell");
  assert.match(r.stderr, /nothing to undo in this session/);
});

test("undo puts the text from before the last run on the clipboard", () => {
  const rt = tmpdir("tw-rt-");
  fs.mkdirSync(path.join(rt, "omarchy-typewriter"));
  fs.writeFileSync(path.join(rt, "omarchy-typewriter", "undo"), "the origenal sentance");
  const clip = path.join(tmpdir("tw-clip-"), "clipboard");

  const r = runRaw(["undo", ...SAFE], {
    XDG_RUNTIME_DIR: rt,
    PATH: `${STUBS}:${process.env.PATH}`,
    TW_STUB_CLIPBOARD: clip,
  });
  assert.strictEqual(r.status, 0);
  assert.match(r.stdout, /on your clipboard/);
  assert.strictEqual(fs.readFileSync(clip, "utf8"), "the origenal sentance",
    "byte for byte: this is the text the user is getting back");
});

// The saved copy lives in the runtime directory, which the session owns and
// tmpfiles clears at logout. An undo that survived a reboot would be a copy of
// the user's text sitting on disk indefinitely.
test("undo does not reach outside the runtime directory", () => {
  const rt = tmpdir("tw-rt-");
  fs.mkdirSync(path.join(rt, "omarchy-typewriter"));
  fs.writeFileSync(path.join(rt, "omarchy-typewriter", "undo"), "kept");
  assert.strictEqual(runRaw(["undo", ...SAFE], { XDG_RUNTIME_DIR: tmpdir("tw-rt2-") }).status, 1,
    "a different session sees no undo");
});

// --- the hold-back -----------------------------------------------------------
// A result far shorter than the input usually means the model answered the text
// instead of transforming it, so it goes to the clipboard rather than over the
// document.

test("a scripted run is never held back", () => {
  const long = "a".repeat(200);
  const out = run(["proof", "--text", long, "--print"], stubbedBackend("No."));
  assert.strictEqual(out.trim(), "No.",
    "--print and --copy report what the model said; there is no document to protect");
});

// The hold-back itself only happens on a run that would paste, and there is no
// flag that reaches that decision without also driving the keyboard, so this
// half is asserted against the source. See the note in README.md.
test("the hold-back threshold is a percentage of the input, with a floor", () => {
  const src = fs.readFileSync(TOOL, "utf8");
  assert.match(src, /"\$\{#text\}"\s+-gt\s+80/,
    "short inputs are exempt: a two-word selection legitimately gets shorter");
  assert.match(src, /\$\{#out\}\s*\*\s*100\s*\/\s*\$\{#text\}[\s\S]{0,12}-lt\s+"\$MIN_RATIO"/,
    "the ratio is out/in as a percentage, compared against MIN_RATIO");
});

test("MIN_RATIO comes from the configuration, not from a literal", () => {
  const src = fs.readFileSync(TOOL, "utf8");
  assert.match(src, /^MIN_RATIO="\$\{TYPEWRITER_MIN_RATIO:-\d+\}"$/m);
});

// A terminal cannot replace a selection from outside: the selection belongs to
// the emulator, not the program, so a paste inserts at the cursor and appends.
// The tool must hold the result on the clipboard instead of pasting.
test("a terminal never reaches the paste unless opted in", () => {
  const src = fs.readFileSync(TOOL, "utf8");
  const block = src.slice(src.indexOf("hold_back=0"), src.indexOf("wtype -M ctrl -k v"));
  assert.match(block, /TERMINAL_PASTE/, "the terminal opt-in must gate the paste");
  assert.match(block, /is_terminal/, "the terminal case must be decided before pasting");
});

// The model call takes seconds; if the user switches windows the result would
// otherwise be pasted into whatever is now focused.
test("the focused window is rechecked after the model call", () => {
  const src = fs.readFileSync(TOOL, "utf8");
  const block = src.slice(src.indexOf("hold_back=0"), src.indexOf("wtype -M ctrl -k v"));
  assert.match(block, /address|activewin/, "the window identity must be refetched");
});
