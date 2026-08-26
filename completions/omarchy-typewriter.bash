# bash completion for omarchy-typewriter
_omarchy_typewriter() {
  local cur prev opts subs presets dir
  cur="${COMP_WORDS[COMP_CWORD]}"
  prev="${COMP_WORDS[COMP_CWORD-1]}"
  opts="--copy --print --time --scope --text --version --help
        --render-prompt --select-backend"
  subs="stats undo"

  case "$prev" in
    # A bare "words" is accepted and means words:1.
    --scope)
      COMPREPLY=($(compgen -W "auto selection line all words words:1 words:3 words:5" -- "$cur"))
      return ;;
    # Free text. Offering anything here would only get in the way.
    --text) return ;;
  esac
  if [[ "$cur" == -* ]]; then
    COMPREPLY=($(compgen -W "$opts" -- "$cur")); return
  fi
  # Presets are files, so the completions are whatever is actually installed.
  # TYPEWRITER_PROMPT_DIR first, matching the tool's own lookup order.
  presets=""
  for dir in "${TYPEWRITER_PROMPT_DIR:-${XDG_CONFIG_HOME:-$HOME/.config}/omarchy-typewriter/prompts}" \
             /usr/share/omarchy-typewriter/prompts; do
    [ -d "$dir" ] && presets+=" $(cd "$dir" && ls *.md 2>/dev/null | sed 's/\.md$//')"
  done
  # A user preset that shadows a shipped one appears in both directories.
  presets="$(printf '%s\n' $presets | sort -u)"
  COMPREPLY=($(compgen -W "$presets $subs" -- "$cur"))
}
complete -F _omarchy_typewriter omarchy-typewriter
