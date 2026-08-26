# Releasing

The PKGBUILD builds from a GitHub release tarball, which is what the AUR
requires — an AUR repository holds only `PKGBUILD` and `.SRCINFO`, so a
`package()` that read from the working tree would find no `bin/` there.

## Cutting a release

```bash
# 1. bump the version in PKGBUILD and bin/omarchy-typewriter (VERSION=)
# 2. commit, then tag
git tag -a v0.1.0 -m "Release 0.1.0"
git push origin main --tags

# 3. real checksum for the published tarball
updpkgsums

# 4. regenerate the metadata the AUR reads
makepkg --printsrcinfo > .SRCINFO

# 5. verify it builds from the tarball, not from here
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

```bash
makepkg -f --skipchecksums   # after pointing source= at a local tarball
```

Or simply run the scripts from `bin/` — they resolve prompts from the
checkout when neither the user's config nor `/usr/share` has them.
