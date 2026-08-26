// A deliberately plain indicator: one dot and one line of text, floating on the
// desktop. No card, no border, no background - Omarchy's own OSD already does
// the card, and this exists because that was too heavy for a 600ms operation.
//
// The surface is input-transparent. That is load-bearing rather than cosmetic:
// Wayland only lets the keyboard-focused client take the clipboard selection,
// so an indicator that took focus would break the text capture outright.
import Quickshell
import Quickshell.Io
import Quickshell.Wayland
import QtQuick

PanelWindow {
  id: root

  // Distance from the bottom edge of the screen, in pixels. Small on purpose:
  // this is a transient hint, not a dialog, and sitting on the edge keeps it
  // out of the way of whatever the user is actually reading.
  //
  // 14 also clears Omarchy's own OSD, the volume and brightness card, which
  // sits about 67px up and stands about 64px tall. The previous 96px put this
  // indicator inside that band, so a volume change during a run drew one on
  // top of the other.
  //
  // Raise it if your bar is at the bottom. This surface anchors to all four
  // edges with ExclusionMode.Ignore, so it is not pushed up by the bar's
  // exclusive zone: with "position": "bottom" in shell.json a bar of about
  // 26px would cover the indicator. Around 40 clears it.
  property int bottomEdgeMargin: 14

  property string label: ""
  property string mode: "idle"      // idle | working | done | failed | held

  // The window has to outlive the mode by the length of the fade, or the fade
  // never renders: binding visible straight to the mode unmapped the surface on
  // the same frame the opacity animation started, so the indicator vanished
  // instead of fading. showing lags mode, and fadeTimer closes the gap.
  property bool showing: false
  visible: showing

  anchors { top: true; bottom: true; left: true; right: true }
  color: "transparent"
  exclusionMode: ExclusionMode.Ignore
  WlrLayershell.namespace: "omarchy-typewriter"
  WlrLayershell.layer: WlrLayer.Overlay
  WlrLayershell.keyboardFocus: WlrKeyboardFocus.None
  mask: Region {}

  readonly property int fadeMs: 140

  onModeChanged: {
    if (mode !== "idle") {
      fadeTimer.stop()
      showing = true
      row.opacity = 1
    } else if (showing) {
      row.opacity = 0
      fadeTimer.restart()
    }
    // Stopping the breath leaves the dot at whatever size it had reached.
    if (mode !== "working") dot.scale = 1.0
  }

  Timer {
    id: fadeTimer
    interval: root.fadeMs + 20
    repeat: false
    onTriggered: root.showing = false
  }

  readonly property color accent: {
    if (mode === "failed") return "#f38ba8"
    if (mode === "held")   return "#f9e2af"
    if (mode === "done")   return "#a6e3a1"
    return "#89b4fa"
  }

  IpcHandler {
    target: "typewriter"

    // ms arrives as a string over IPC; declaring it int silently yielded 0,
    // so the auto-hide never armed and the indicator stayed on screen.
    function show(mode: string, label: string, ms: string): string {
      root.label = label
      root.mode = mode
      var d = parseInt(ms, 10)
      if (isNaN(d)) d = 0
      hideTimer.stop()
      if (d > 0) { hideTimer.interval = d; hideTimer.restart() }
      return "ok"
    }
    function close(): string { hideTimer.stop(); root.mode = "idle"; return "ok" }
    function state(): string { return root.mode }
  }

  Timer { id: hideTimer; repeat: false; onTriggered: root.mode = "idle" }

  Row {
    id: row
    anchors.horizontalCenter: parent.horizontalCenter
    anchors.bottom: parent.bottom
    anchors.bottomMargin: root.bottomEdgeMargin
    spacing: 10
    opacity: 0
    Behavior on opacity {
      NumberAnimation { duration: root.fadeMs; easing.type: Easing.OutCubic }
    }

    // The dot breathes while the model is working and holds still otherwise,
    // so "thinking" and "finished" are distinguishable without reading.
    Rectangle {
      id: dot
      width: 9; height: 9; radius: 4.5
      anchors.verticalCenter: parent.verticalCenter
      color: root.accent

      // Targeted rather than a "SequentialAnimation on scale" value source, so
      // scale stays an ordinary property that can be reset once the loop stops.
      // As a value source it kept ownership of scale and the dot sat frozen
      // mid-breath, larger than an idle dot, for as long as "done" was up.
      SequentialAnimation {
        id: breathe
        running: root.mode === "working"
        loops: Animation.Infinite
        NumberAnimation {
          target: dot; property: "scale"
          from: 1.0; to: 1.9; duration: 520; easing.type: Easing.InOutSine
        }
        NumberAnimation {
          target: dot; property: "scale"
          from: 1.9; to: 1.0; duration: 520; easing.type: Easing.InOutSine
        }
        onRunningChanged: if (!running) dot.scale = 1.0
      }
    }

    Text {
      id: labelText
      anchors.verticalCenter: parent.verticalCenter
      text: root.label
      color: root.accent
      font.pixelSize: 13
      font.weight: Font.Medium
      // failed carries the backend's own error message, which can be a whole
      // API response. With no cap it ran off the edge of the screen, taking
      // the start of the message with it.
      width: Math.min(implicitWidth, root.width * 0.6)
      elide: Text.ElideRight
      maximumLineCount: 1
      // A soft shadow instead of a background, so it stays readable on both a
      // light and a dark desktop without drawing a box.
      style: Text.Raised
      styleColor: "#40000000"
    }
  }
}
