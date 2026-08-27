# omarchy-typewriter

Select some text, press a key, and it gets fixed where it sits.

No window to switch to. No copying it into a chat and pasting the answer back.
About 0.8 seconds.

Built for Wayland. Developed on Omarchy with Hyprland.

## Install

```bash
git clone https://github.com/meirdick/omarchy-typewriter.git
cd omarchy-typewriter
makepkg -si
omarchy-typewriter-setup
```

Setup asks before every step and shows you the exact command for anything that
needs sudo. `omarchy-typewriter-setup --dry-run` prints the whole plan without
doing any of it.

## Try it

Select a sentence in your browser and press `SUPER+ALT+1`.

That is proofreading. There are five more.

| Key | What it does |
|---|---|
| `SUPER+ALT+1` | Fix spelling and grammar, change nothing else |
| `SUPER+ALT+2` | Rewrite it so it reads better |
| `SUPER+ALT+3` | Make it shorter |
| `SUPER+ALT+4` | Make it sound professional |
| `SUPER+ALT+5` | Turn it into bullet points |

With nothing selected, it takes whatever you have typed so far in that box.

## Where the thinking happens

Pick one when you run setup. They all do the same job.

| | Speed | What it costs you |
|---|---|---|
| **Cloudflare** | 0.8s | An account ID and a token |
| **pi** | 1.5s | Nothing, if you already use pi |
| **Local** | 5s | A 2 GB download. Nothing leaves your machine |
| **Anthropic** | 1.5s | An API key |

Local is the private one. The other three send the selected text to somebody
else's computer, which is worth knowing before you point this at an email.

Those times are from one laptop. Setup finishes by running a real one and
telling you your own number.

## Making it yours

**Write your own.** Each of the six is just a markdown file. Drop another one in
`~/.config/omarchy-typewriter/prompts/` and it works immediately:

```markdown
# Slack

Rewrite this as a Slack message. Direct, no greeting, no sign-off.
Three sentences at most.
```

Now `omarchy-typewriter slack` works, and you can bind it to a key. There is no
limit on how many you have.

**Protect your words.** Models "correct" terms they have not seen. One of the
models tested here turned `psql` into `PostgreSQL` and `sts` into `StatefulSet`
in someone's own sentence.

Put the spellings you want left alone in
`~/.config/omarchy-typewriter/wordlist`:

```
psql
CrashLoopBackOff
Acme Robotics

github => GitHub
k8s => Kubernetes
```

A word on its own is protected. `x => y` is always rewritten that way. Product
and company names are the ones worth adding first, because a model has never
seen them and will confidently fix them into something else.

**Teach it your voice.** Put a few things you have written into
`~/.config/omarchy-typewriter/prompts/rewrite.samples/` and it will match how
you write. How well depends on the model — Claude Haiku picked up a short, blunt
style straight away; the smaller Cloudflare model barely moved.

## What it has done

```
$ omarchy-typewriter stats
runs            24
words refined   412
words changed   106
time in models  19.4s
median run      0.81s
```

`omarchy-typewriter undo` puts the old text back on your clipboard if you do not
like the new one.

The history keeps counts and timings only. It never stores what you wrote.

## In a terminal it works differently

A terminal owns your mouse selection. The program running inside it — your
shell, an editor, anything full-screen — cannot see that selection at all. So
there is nothing for it to replace, and pasting would just add the new text next
to the old.

Rather than pretend, the tool puts the result on your clipboard and tells you.
Press `Ctrl+Shift+V` where you want it.

For the shell prompt itself there is a better way. Add this to your `~/.bashrc`:

```bash
source /usr/share/omarchy-typewriter/shell/typewriter.bash
```

Now `Ctrl-x Ctrl-t` fixes the command you are typing, in place:

```
git comit -m "fixs teh bug in teh parser"
git commit -m "fixes the bug in the parser"
```

That works because the shell hands the line over and takes a new one back, with
no clipboard involved. There is a zsh version next to it.

## Settings

`~/.config/omarchy-typewriter/config`. Every option is in there with a comment
saying what it does and why the default is what it is.

Your Cloudflare token is not in that file. It lives on its own in
`cloudflare.token`, readable only by you.

## Things worth knowing

**It can be talked into misbehaving.** Your text goes to a language model, and a
model cannot always tell your words apart from instructions aimed at it. There
are guards: the text is clearly marked as text, and a suspiciously short answer
is held back instead of pasted. They are guards, not guarantees. Every mistake
is one paste you can undo with `Ctrl+Z`.

**It only knows terminals it has heard of.** If yours is not in the list it will
say so rather than guess, because guessing wrong means sending Ctrl+C, which
kills whatever is running.

**Formatting is lost.** It reads and writes plain text, so fixing a bolded
paragraph in Gmail gives you back an unbolded one.

**Clipboard managers remember everything.** If you run one, both the original
and the rewrite end up in its history.

## Undoing setup

The package itself only writes to `/usr` and `/etc`. Setup is separate, and can
also touch:

- a systemd file that lets ollama use your GPU
- your Hyprland keybindings, backed up first
- `~/.config/omarchy-typewriter/`
- packages you approved by name

`omarchy-typewriter-setup --uninstall` reverses all of it, asking separately
before deleting a downloaded model.

## Working on it

```bash
node --test test/*.test.js     # 44 tests, no network, no model needed
bash -n bin/omarchy-typewriter
```

`BUILDING.md` covers cutting a release.

If you change the on-screen indicator, run `omarchy-restart-shell` — Omarchy
keeps plugin code in memory, and nothing else reloads it.

## License

MIT.
