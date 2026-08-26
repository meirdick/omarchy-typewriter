# omarchy-typewriter — proofread the command line you are typing.
#
#   source /usr/share/omarchy-typewriter/shell/typewriter.zsh
#
# Then press Ctrl-x Ctrl-t to rewrite the current line in place.
#
# Same reasoning as the bash version: at a shell prompt the clipboard route
# cannot replace anything, but ZLE hands us $BUFFER and takes a new one back.

_omarchy_typewriter_line() {
  [[ -n "$BUFFER" ]] || return 0
  local out
  out="$(TYPEWRITER_NOTIFY=0 omarchy-typewriter "${TYPEWRITER_SHELL_PRESET:-proof}" \
         --text "$BUFFER" --print 2>/dev/null)" || return 0
  [[ -n "$out" ]] || return 0
  BUFFER="${out%%$'\n'*}"
  CURSOR=${#BUFFER}
}

zle -N _omarchy_typewriter_line
bindkey '^X^T' _omarchy_typewriter_line
