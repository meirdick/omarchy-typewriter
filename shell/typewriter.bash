# omarchy-typewriter — proofread the command line you are typing.
#
#   source /usr/share/omarchy-typewriter/shell/typewriter.bash
#
# Then press Ctrl-x Ctrl-t to rewrite the current line in place.
#
# This exists because the clipboard route cannot work at a shell prompt. A
# terminal owns its mouse selection, the program inside it cannot see one, and
# a paste therefore inserts rather than replaces. Readline has no such problem:
# it hands us the line and takes a new one back. No clipboard, no synthetic
# keystrokes, no selection.

_omarchy_typewriter_preset="${TYPEWRITER_SHELL_PRESET:-proof}"

_omarchy_typewriter_line() {
  [ -n "$READLINE_LINE" ] || return 0
  local out
  # --print keeps it off the clipboard and out of the stats history; --text
  # means the tool never touches the keyboard.
  out="$(TYPEWRITER_NOTIFY=0 omarchy-typewriter "$_omarchy_typewriter_preset" \
         --text "$READLINE_LINE" --print 2>/dev/null)" || return 0
  [ -n "$out" ] || return 0
  # Single line only: a multi-line result would corrupt the prompt.
  out="${out%%$'\n'*}"
  READLINE_LINE="$out"
  READLINE_POINT=${#READLINE_LINE}
}

bind -x '"\C-x\C-t": _omarchy_typewriter_line' 2>/dev/null
