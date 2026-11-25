# AppKit shell

This is a hybrid app, not a complete SwiftUI rewrite. NSToolbar, NSSegmentedControl,
NSOutlineView, NSSearchField, NSMenu and NSGlassEffectView replace the web titlebar
and scene directory on macOS 26+. The existing Chromium/Tiptap/Yjs editor, IndexedDB,
recovery journal, .jhwrite files, local MCP permissions and CloudKit bridge stay in
place. Data never moves between browser engines. Embedded editing forms remain web
views; simulated CSS glass is disabled in those forms when this shell is active.

`getNativeWindowHandle()` supplies the Electron NSView; AppKit accesses its NSWindow
through the public API. No private Apple API, method swizzling or app-store SDK is used.
Callbacks use Node-API's threadsafe queue and never invoke JS from arbitrary AppKit
frames. State is sent through context-isolated preload IPC. Destructive scene commands
still use existing confirmations and document readonly guards.

Build: accept Xcode's license personally and finish first-launch setup, provide Node
headers via JUHAO_NODE_HEADERS (default .local/native-shell-headers/include/node),
then run `node scripts/build-native-shell.mjs` with macOS SDK 26 or later. The headers
used in development are from nodejs.org/dist/v24.22.3/node-v24.22.3-headers.tar.gz;
NAPI_VERSION=8 is selected for ABI compatibility with the packaged Electron runtime.
Rebuild before `node scripts/package-mac.mjs`. Packager includes and signs the addon.

Test with `node --import tsx scripts/test-native-shell.mjs`; this creates a disposable
profile. JUHAO_NATIVE_SHELL=0 exercises the legacy web shell for regression comparison.
JUHAO_NATIVE_SELF_TEST=1 exposes native target/action invocation only in test processes.
Older macOS versions keep the earlier interface; actual Liquid Glass requires macOS 26.

Verification includes native class identity, navigation target/action, window resizing,
editor undo, modal isolation, PDF, and prompt writing. Actual native-window screenshots
must also be checked: a Chromium screenshot cannot capture AppKit controls.

© 2026 Fu Junhao
