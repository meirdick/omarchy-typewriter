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
optdepends=(
  'pi: agent-harness backend, uses providers you already authenticated'
  'ollama: local backend, nothing leaves the machine'
  'ollama-vulkan: GPU acceleration for the local backend on Intel and AMD'
  'hyprland: window-class detection and the on-screen indicator'
  'libnotify: failure notifications'
  'gum: prompts in the setup wizard'
)
backup=("etc/$pkgname/config")
source=()

package() {
  cd "$startdir"

  install -Dm755 "bin/$pkgname" "$pkgdir/usr/bin/$pkgname"
  for helper in setup status; do
    [ -f "bin/$pkgname-$helper" ] \
      && install -Dm755 "bin/$pkgname-$helper" "$pkgdir/usr/bin/$pkgname-$helper"
  done

  install -d "$pkgdir/usr/share/$pkgname/prompts"
  install -m644 -t "$pkgdir/usr/share/$pkgname/prompts" prompts/*.md

  install -Dm644 config/config.example "$pkgdir/etc/$pkgname/config"

  install -Dm644 "completions/$pkgname.bash" \
    "$pkgdir/usr/share/bash-completion/completions/$pkgname"

  install -Dm644 README.md "$pkgdir/usr/share/doc/$pkgname/README.md"
  install -Dm644 LICENSE   "$pkgdir/usr/share/licenses/$pkgname/LICENSE"
}
