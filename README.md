# omarchy-typewriter

Select text anywhere, press a key, and the selection is replaced by a proofread
or rewritten version. No window to switch to, no paste, no round trip through a
chat app.

Built for Wayland. Developed on Omarchy 4 with Hyprland.

## Install

```bash
yay -S omarchy-typewriter      # once it is on the AUR
omarchy-typewriter-setup
```

Building from a checkout instead — see `BUILDING.md`, which covers the
release and AUR steps.

The wizard asks before every step, prints the exact command for anything
needing sudo, and `--dry-run` prints the whole plan while changing nothing.

## Backends

Pick one at setup. They all transform the same way; they differ in speed,
privacy, and how much setup they need.

| Backend | Paragraph | What it costs you |
|---|---|---|
| `pi` | ~1.5s | Nothing. Uses providers you already authenticated |
| `cloudflare` | ~1.5s | An account id and a Workers AI token |
| `local` | ~4.9s | About 2 GB, and one sudo step for GPU access |
| `anthropic` | ~1.5s | `ANTHROPIC_API_KEY` in the environment |

`local` runs entirely on your machine. The other three send the selected text
to a third party. `TYPEWRITER_BACKEND` also accepts `ollama` as another name
for `local`, and `auto` to pick the first one that is ready.

Times are medians measured on one laptop — an Intel Arc B390 iGPU — on a
327-character paragraph. The wizard finishes by running a sample and reporting
your own number, which is better evidence than mine.

### On pi

[pi](https://github.com/earendil-works/pi) is one of Omarchy's default agents,
so on an Omarchy box this is usually the shortest path to a working install: no
sudo, no download, no token.

Two things the tool does on your behalf, both deliberate. It always passes
`--no-tools`, because pi ships read, bash, edit and write tools and this tool
routinely feeds it text you did not write. And it always passes `--no-session`,
so the sentences you proofread do not accumulate on disk.

Pin a model. pi's own default provider took 15.5s on a paragraph that
`anthropic/claude-haiku-4-5` did in 1.5s.

### On the local backend

Two things have to be right, and only one of them is obvious.

`ollama-vulkan` gives an Intel or AMD integrated GPU a backend. It is additive —
it does not replace `ollama`.

`OLLAMA_IGPU_ENABLE=1` has to reach the *service*, which runs under its own user
with `ProtectHome=yes`. A shell export does nothing. Without it ollama silently
skips the integrated GPU and runs on the CPU at roughly half the speed, and
nothing tells you. The wizard writes a drop-in, then runs one generate and reads
`/api/ps` to check `size_vram > 0` — that check is the only way to catch this.

## Presets

Each preset is a markdown file whose first heading becomes the on-screen label.
Six ship: `proof`, `rewrite`, `concise`, `formal`, `bullets`, `plain`.

Add your own in `~/.config/omarchy-typewriter/prompts/`. Files there win over
the shipped ones, so upgrades never overwrite your edits — and for the same
reason, do not edit the copies under `/usr/share`.

There is also a one-off form that needs no file:

```bash
omarchy-typewriter -- "translate to spanish"
```

## Stats

```
$ omarchy-typewriter stats
runs            5
words refined   97
words changed   45
time in models  8.1s
median run      1.08s
```

Plus a per-preset breakdown, so you can see which typewriters you actually use.
The history holds **metadata only** — counts and timings, never the text. Text
is what would make a log like this a liability.

`omarchy-typewriter undo` puts the text from before the last run back on your
clipboard. That one copy lives in the runtime directory and dies with your
session, so it is available exactly when you need it and never persists.

## Teaching it your voice

Any preset can carry writing samples. Put `.md` or `.txt` files in a directory
named after the preset, beside the prompt:

```
~/.config/omarchy-typewriter/prompts/
├── rewrite.md
└── rewrite.samples/
    └── voice.md
```

They are appended to the instruction as style references — sentence length,
vocabulary, how formal you are — and explicitly marked as data, never
instructions. Up to five by default (`TYPEWRITER_MAX_SAMPLES`).

How much difference this makes depends on the model. Measured on the same
sentence:

| | Output |
|---|---|
| no samples | *"I think we should consider rolling back the deploy since staging is still throwing 502 errors and it might be related to something we changed."* |
| samples, `llama-4-scout` | *"I think we should consider rolling back the deploy, as staging is still throwing those 502 errors, which might be related to our recent changes."* |
| samples, `claude-haiku-4-5` | *"I think we should roll back the deploy. Staging is still throwing 502 errors and it's likely related to something we changed."* |

The sample voice was short and declarative. Haiku adopted it; scout barely did.
If voice matters to you, this is a reason to use a stronger backend.

## Wordlist

`~/.config/omarchy-typewriter/wordlist`, one rule per line:

```
# Terms to protect - never "corrected", whatever they look like
Acme Robotics
CrashLoopBackOff
psql

# Always written this way
github => GitHub
k8s => Kubernetes
```

The two halves use different mechanisms on purpose. **Protected terms go into
the prompt**, because only the model can tell whether a word is being used as
that term. **Replacements are applied after the model**, deterministically,
because a prompt is a request and a substitution is a guarantee — and the reason
a word ends up in this file is that you are tired of it coming back wrong.

Worth the two minutes. Without it, on the sentence *"we shipped the acme hub
update"*:

| | |
|---|---|
| no wordlist | "we shipped the **migrate** hub update" |
| `Acme Robotics` protected | "we shipped the **Acme Robotics** hub update" |

It silently renamed the company. Proper nouns a model has never seen are exactly
what it will confidently "fix".

## At a shell prompt

The clipboard route cannot work in a terminal, so the shell prompt gets its own
mechanism. Add to your `~/.bashrc`:

```bash
source /usr/share/omarchy-typewriter/shell/typewriter.bash
```

`Ctrl-x Ctrl-t` then rewrites the line you are typing, in place:

```
git comit -m "fixs teh bug in teh parser"     →
git commit -m "fixes the bug in the parser"
```

There is a `typewriter.zsh` beside it doing the same through ZLE. Set
`TYPEWRITER_SHELL_PRESET` to use something other than `proof`.

This works where the clipboard cannot because readline hands the line over and
takes a new one back — no clipboard, no synthetic keystrokes, no selection. It
covers the shell prompt only. A full-screen TUI in a terminal, like an editor or
Claude Code, has neither readline nor a visible selection, and remains a
clipboard-and-paste job.

## Scopes

With text highlighted, that selection is used.

With nothing highlighted, `auto` takes everything before the cursor in the
focused input. `Ctrl+Shift+Home` stops at the input boundary, so a Gmail compose
box or a Slack message is taken whole without the quoted thread below it. In a
code editor that means everything above the cursor, so set
`TYPEWRITER_AUTO_FALLBACK=line` there.

`--scope auto|selection|line|words|words:N|all` overrides per run. A bare
`words` means `words:1`.

**In a terminal, select with the mouse.** There is no way to make a selection
from outside: `Shift+Home` either scrolls the scrollback or is forwarded to the
program, and a TUI text input — a shell prompt, an editor, Claude Code's own
input — has no selection model the compositor can drive. So the no-selection
scopes are disabled there, and the tool says so rather than pressing keys that
would do something unpredictable.

## How it captures text

It writes a sentinel to the clipboard, sends the copy keystroke, and waits for
the clipboard to change. If it never changes, nothing was selected and the run
stops rather than pasting something wrong.

Reading the PRIMARY selection would have been simpler, but PRIMARY survives
after you click away, so a stale highlight silently becomes the input and the
paste lands at the caret instead of over a selection. Copying explicitly proves
the text is there *now*, and leaves it selected so the paste replaces it.

## Settings

`~/.config/omarchy-typewriter/config`, with `/etc/omarchy-typewriter/config` as
the system default and `TYPEWRITER_*` environment variables overriding both.
`config/config.example` is the annotated list.

The Cloudflare token is never in that file. It lives in
`~/.config/omarchy-typewriter/cloudflare.token` at mode 0600, written by
`omarchy-typewriter-setup --set-cf-token`, which reads it from the terminal
rather than from a command line — `/proc/*/cmdline` is world-readable.

## What setup can touch outside its own directories

The package installs only to `/usr` and `/etc`. The wizard is a separate program
you run yourself, and it can touch these, each only after you say yes:

- `/etc/systemd/system/ollama.service.d/omarchy-typewriter-igpu.conf`
- `~/.config/hypr/bindings.lua`, backed up first to `bindings.lua.bak.<epoch>`
- `~/.config/omarchy-typewriter/`
- pacman packages you approved by name

`omarchy-typewriter-setup --uninstall` reverses each of them, and asks
separately before deleting a downloaded model.

## Keybindings

**The wizard's keybinding step is Omarchy-specific.** `o.bind` and `hl.unbind`
are Omarchy 4's Lua config API, not Hyprland's — plain Hyprland reads
`hyprland.conf` and has no Lua layer. On Omarchy, setup offers to append a
delimited block to your own `bindings.lua`; the default is one key,
`SUPER+ALT+R`, which unbinds nothing.

Anywhere else, bind it yourself. Plain Hyprland:

```
bind = SUPER ALT, R, exec, omarchy-typewriter proof
```

Sway, niri and the rest: whatever your compositor's config calls the same thing.
The command is all that matters.

A five-preset set on `SUPER+ALT+1..5` is offered separately because it unbinds
Hyprland's group-window switching, which you do not get back until you remove
the block.

Writing the block twice produces a byte-identical file. `--remove-bindings`
returns the file to exactly what it was before.

Prefer to do it yourself: `omarchy-typewriter-setup --print-bindings`.

## Bar integration

While a run is in flight the tool shows a pill at the bottom centre of the
screen naming what it is doing — `Proofreading…`, `Rewriting…` — with the
preset's own glyph. On Omarchy this drives the shell's existing OSD, the same
surface the volume and brightness popups use, which costs about 44ms and needs
no background process. Elsewhere it falls back to `hyprctl notify`, whose
position Hyprland does not let anyone configure.

Each preset declares its glyph in its own file:

```markdown
# Proofreading
<!-- icon: 󰓆 -->
```

so a preset you write gets one too.

For a bar, `omarchy-typewriter-status` prints one Waybar-shaped object and
follows with `--follow`. It answers `idle` when the tool has never run, so a bar
module works before first use. States are `idle`, `working`, `held`, `failed`
and `needs-setup`. A stale state ages back to idle after two minutes
(`TYPEWRITER_STATUS_STALE_AFTER`, read from the config file as well as the
environment) so an old error cannot sit there. `needs-setup` is the exception
and never ages: no backend is configured, and that stays true until you run the
wizard. The tooltip carries the focused window's class, which is the answer to
the most likely problem — see below.

## Limits worth knowing

**Prompt injection.** The selected text goes to a language model, and a model
cannot reliably separate instructions from data. Text is wrapped in `<text>`
tags with the instruction repeated afterwards, which is what stops short,
question-like selections being answered instead of rewritten. It is a
mitigation, not a guarantee. Every failure is one visible, reversible paste, and
`Ctrl+Z` undoes it. A result under 20% of the input length is not pasted at all
(`TYPEWRITER_MIN_RATIO`) — it goes to the clipboard with a notification.
Selections of 80 characters or fewer are exempt, because a short one honestly
does get much shorter. `--print`, `--copy` and `--text` skip the hold-back
entirely: there is no document to protect, so a scripted run always returns
what the model said.

**Terminal detection is a regex over window classes.** A terminal that is not
matched gets a bare `Ctrl+C`, which is SIGINT rather than a copy. The status
tooltip shows the focused class so you can extend `TYPEWRITER_TERMINAL_RE`.

**Slow apps.** If an app reports "nothing selected" for text that was selected,
it did not put the selection on the clipboard within
`TYPEWRITER_CAPTURE_TIMEOUT_MS` (default 640). The error names the setting.

**Compositors other than Hyprland.** The window class comes from `hyprctl`.
Without it the tool cannot tell a terminal from anything else, and it refuses
rather than guessing — because guessing wrong means sending a bare `Ctrl+C`,
which is SIGINT to whatever is running. Force it with `TYPEWRITER_TERMINAL=1`
or `0` if you know better.

**Clipboard managers.** If you run one, both the text you selected and the
model's replacement enter its history permanently.

**Rich text.** Capture and paste are plain text. Refining a formatted selection
in Gmail or Docs replaces it with unformatted text.

## Development

```bash
bash -n bin/omarchy-typewriter          # syntax
node --test test/*.test.js              # 44 tests, no model, no network
```

The suite needs `bash`, `jq` and `node`. It shells out to the real script, so
it needs the same `jq` the tool itself depends on. It never needs a model, a
network or a Wayland session, and it writes nothing outside its own temporary
directories.

Neither the tests nor the harnesses are in the package; clone the repo for
those.

The tests reach the script through four seams:

- `--render-prompt` prints the exact system prompt and payload it would send.
  This is the important one: the prompt structure is the part most easily
  broken by a careless edit and has no other test.
- `--select-backend` prints the backend `auto` resolved to and stops.
- `--text TEXT --print` supplies the input and prints the result, instead of
  reading the selection and pressing keys.
- A directory of stub executables on `PATH` stands in for `curl` and
  `wl-copy`, which is what lets the tests exercise the whole run — wordlist
  replacements included — with no model and no clipboard.

One behaviour has no seam. The hold-back is only evaluated on a run that would
paste, and every flag that makes a run safe to script also turns the hold-back
off, so the threshold itself is asserted against the source rather than
observed. A `--dry-run` that took the paste decision and printed it instead of
acting on it would close that gap.

Two live harnesses, opt-in because they need a working backend:

```bash
test/bench.sh   cf @cf/meta/llama-4-scout-17b-16e-instruct
test/quality.sh cf @cf/meta/llama-4-scout-17b-16e-instruct
```

`bench.sh` times three input sizes and scores five correctness cases.
`quality.sh` runs eight harder cases that assert jargon, proper nouns, inline
code, figures, markdown and URLs survive verbatim.

## License

MIT.
