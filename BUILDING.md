# Releasing

The PKGBUILD builds from a GitHub release tarball, which is what the AUR
requires — an AUR repository holds only `PKGBUILD` and `.SRCINFO`, so a
`package()` that read from the working tree would find no `bin/` there.

## The version lives in four files

Bump all of them together. `.SRCINFO` is generated, so it is not on this list.

| File | Where |
|---|---|
| `PKGBUILD` | `pkgver=` |
| `bin/omarchy-typewriter` | `VERSION=` |
| `bin/omarchy-typewriter-setup` | the `--version` case |
| `shell-plugin/manifest.json` | `"version"` |

Check nothing was missed before tagging:

```bash
grep -rn '0\.1\.0' PKGBUILD bin shell-plugin
```

## Never publish with `sha256sums=('SKIP')`

`SKIP` disables verification. makepkg accepts whatever it downloads, so a
tampered or truncated tarball builds without complaint. The committed value is
a placeholder, because a real hash cannot exist before the tag it names.

**Run `updpkgsums` after `git push --tags` and before anything reaches the
AUR.** It fetches the published tarball and writes the real hash into the
PKGBUILD. If `git diff PKGBUILD` shows no change afterwards, the tag is not on
GitHub yet and the release is not ready.

## Cutting a release

```bash
# 1. bump the version in all four files above
# 2. commit, then tag
git tag -a v0.1.0 -m "Release 0.1.0"
git push origin main --tags

# 3. real checksum for the published tarball. Not optional.
updpkgsums
grep sha256sums PKGBUILD          # must no longer say SKIP

# 4. regenerate the metadata the AUR reads
makepkg --printsrcinfo > .SRCINFO

# 5. verify it builds from the published tarball, not from here
makepkg -f --cleanbuild

git commit -am "Release 0.1.0 packaging" && git push
```

## Publishing to the AUR

```bash
git clone ssh://aur@aur.archlinux.org/omarchy-typewriter.git aur
cp PKGBUILD .SRCINFO aur/
cd aur && git commit -am "Initial import" && git push
```

Only those two files belong in the AUR repository.

## Building locally without a tag

No tarball is tracked in this repository, and none should be. A tracked
tarball is packed into the next tarball GitHub builds from the tag, so every
release would carry a copy of the release before it.

Build one from the current commit instead. makepkg uses a file that already
sits next to the PKGBUILD under the expected name and skips the download:

```bash
ver=$(sed -n 's/^pkgver=//p' PKGBUILD)
git archive --format=tar.gz --prefix="omarchy-typewriter-$ver/" \
  -o "omarchy-typewriter-$ver.tar.gz" HEAD
makepkg -f --skipchecksums
```

`git archive HEAD` packs the last commit, not the working tree, and only
tracked files. To test an uncommitted change, commit it first.

`.gitignore` covers `*.tar.gz`, so that tarball and the `src/`, `pkg/` and
`*.pkg.tar.zst` makepkg leaves behind all stay untracked. Clear them with:

```bash
rm -rf src pkg ./*.pkg.tar.zst ./*.tar.gz
```

Or simply run the scripts from `bin/` — they resolve prompts from the
checkout when neither the user's config nor `/usr/share` has them.
