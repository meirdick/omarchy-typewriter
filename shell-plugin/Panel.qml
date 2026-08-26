// A deliberately plain indicator: one dot and one word, floating on the
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

  property string label: ""
  property string mode: "idle"      // idle | working | done | failed | held
  property int    closeAfter: 0

  visible: mode !== "idle"
  anchors { top: true; bottom: true; left: true; right: true }
  color: "transparent"
  exclusionMode: ExclusionMode.Ignore
  WlrLayershell.namespace: "omarchy-typewriter"
  WlrLayershell.layer: WlrLayer.Overlay
  WlrLayershell.keyboardFocus: WlrKeyboardFocus.None
  mask: Region {}

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
      root.mode = mode
      root.label = label
      var d = parseInt(ms, 10)
      if (isNaN(d)) d = 0
      root.closeAfter = d
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
    anchors.bottomMargin: 96
    spacing: 10
    opacity: root.visible ? 1 : 0
    Behavior on opacity { NumberAnimation { duration: 140; easing.type: Easing.OutCubic } }

    // The dot breathes while the model is working and holds still otherwise,
    // so "thinking" and "finished" are distinguishable without reading.
    Rectangle {
      id: dot
      width: 9; height: 9; radius: 4.5
      anchors.verticalCenter: parent.verticalCenter
      color: root.accent

      SequentialAnimation on scale {
        running: root.mode === "working"
        loops: Animation.Infinite
        NumberAnimation { from: 1.0; to: 1.9; duration: 520; easing.type: Easing.InOutSine }
        NumberAnimation { from: 1.9; to: 1.0; duration: 520; easing.type: Easing.InOutSine }
      }
      onVisibleChanged: if (root.mode !== "working") scale = 1.0
    }

    Text {
      anchors.verticalCenter: parent.verticalCenter
      text: root.label
      color: root.accent
      font.pixelSize: 13
      font.weight: Font.Medium
      // A soft shadow instead of a background, so it stays readable on both a
      // light and a dark desktop without drawing a box.
      style: Text.Raised
      styleColor: "#40000000"
    }
  }
}
