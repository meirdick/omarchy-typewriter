# Maintainer: Meir Dick <mdick85@gmail.com>
pkgname=omarchy-typewriter
pkgver=0.1.0
pkgrel=1
pkgdesc="Proofread or rewrite selected text in place with a keypress, on Wayland"
arch=('any')
url="https://github.com/meirdick/omarchy-typewriter"
license=('MIT')

# Kept deliberately thin. Everything that gates a capability is optional, so the
# package installs on any Wayland box and the setup wizard adds what you chose.
depends=('bash' 'jq' 'curl' 'wl-clipboard' 'wtype')
# optdepends must name packages pacman can resolve. The pi agent CLI is not in
# the repos - it is mentioned in the README instead.
optdepends=(
  'omarchy: bottom-centre on-screen indicator and keybinding installation'
  'ollama: local backend, nothing leaves the machine'
  'ollama-vulkan: GPU acceleration for the local backend on Intel and AMD'
  'hyprland: window-class detection, without which terminals are not detected'
  'libnotify: failure notifications'
  'gum: prompts in the setup wizard'
  'inotify-tools: event-driven bar updates instead of polling'
  'bash-completion: preset name completion'
)
backup=("etc/$pkgname/config")
install="$pkgname.install"
source=("$pkgname-$pkgver.tar.gz::$url/archive/refs/tags/v$pkgver.tar.gz")
# PLACEHOLDER. 'SKIP' means makepkg verifies nothing, so a tampered or truncated
# download builds without complaint. It can only become a real hash once the
# v$pkgver tag exists on GitHub: push the tag, run `updpkgsums`, and commit the
# result before publishing. Never push to the AUR with SKIP here. See BUILDING.md.
sha256sums=('648526b43c7fa657aded436df5bd47e8abee52af09cb3a1108529bfb2a4f8d4f')

package() {
  cd "$srcdir/$pkgname-$pkgver"

  install -Dm755 "bin/$pkgname" "$pkgdir/usr/bin/$pkgname"
  for helper in setup status; do
    [ -f "bin/$pkgname-$helper" ] \
      && install -Dm755 "bin/$pkgname-$helper" "$pkgdir/usr/bin/$pkgname-$helper"
  done

  install -d "$pkgdir/usr/share/$pkgname/prompts"
  install -m644 -t "$pkgdir/usr/share/$pkgname/prompts" prompts/*.md

  install -Dm644 config/config.example "$pkgdir/etc/$pkgname/config"
  install -d "$pkgdir/usr/share/$pkgname/shell"
  install -m644 -t "$pkgdir/usr/share/$pkgname/shell" shell/typewriter.bash shell/typewriter.zsh

  install -Dm644 config/wordlist.example \
    "$pkgdir/usr/share/$pkgname/wordlist.example"

  install -Dm644 "completions/$pkgname.bash" \
    "$pkgdir/usr/share/bash-completion/completions/$pkgname"

  install -d "$pkgdir/usr/share/$pkgname/shell-plugin"
  install -m644 -t "$pkgdir/usr/share/$pkgname/shell-plugin" shell-plugin/*

  install -Dm644 README.md "$pkgdir/usr/share/doc/$pkgname/README.md"
  install -Dm644 LICENSE   "$pkgdir/usr/share/licenses/$pkgname/LICENSE"
}
