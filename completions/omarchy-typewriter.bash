# bash completion for omarchy-typewriter
_omarchy_typewriter() {
  local cur prev opts presets dir
  cur="${COMP_WORDS[COMP_CWORD]}"
  prev="${COMP_WORDS[COMP_CWORD-1]}"
  opts="--copy --print --time --scope --text --version --help"

  case "$prev" in
    --scope) COMPREPLY=($(compgen -W "auto selection line all words:1 words:3 words:5" -- "$cur")); return ;;
  esac
  if [[ "$cur" == -* ]]; then
    COMPREPLY=($(compgen -W "$opts" -- "$cur")); return
  fi
  # Presets are files, so the completions are whatever is actually installed.
  presets=""
  for dir in "${XDG_CONFIG_HOME:-$HOME/.config}/omarchy-typewriter/prompts" \
             /usr/share/omarchy-typewriter/prompts; do
    [ -d "$dir" ] && presets+=" $(cd "$dir" && ls *.md 2>/dev/null | sed 's/\.md$//')"
  done
  COMPREPLY=($(compgen -W "$presets" -- "$cur"))
}
complete -F _omarchy_typewriter omarchy-typewriter
