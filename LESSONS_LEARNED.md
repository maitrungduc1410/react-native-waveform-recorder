# Lessons learned

This document is the field report from building `react-native-waveform-recorder` — every non-obvious bug we hit, what it taught us, and how to avoid stepping in the same hole twice. Written for future contributors (human and AI) so they don't have to rediscover this the hard way.

If you're just trying to use the library, see the [README](./README.md). For architecture context, see [ARCHITECTURE.md](./ARCHITECTURE.md). For AI-agent quickstart, see [AGENTS.md](./AGENTS.md).

---

## TL;DR — the meta-lessons

1. **Fabric is not Paper.** Patterns that worked under the old architecture (`display: 'none'` to hide a view, `View.GONE` on Android, array-typed events) have new failure modes. Verify each assumption.
2. **Cross-platform parity is a discipline, not a side effect.** Every iOS fix needs an Android twin. Bugs found on one platform almost always exist on the other.
3. **"It works" ≠ "It's correct."** The WAV concat memory bomb only surfaced during a post-launch code review — stress tests passed because nobody pause+resumed a long enough WAV recording. Audit after passing, not just to pass.
4. **State transitions must be atomic UI events.** Most of our subtle bugs were "the data changed but a piece of UI didn't refresh." Route every transition through one function that fans out to every dependent surface.
5. **Resource cleanup is owed on every exit path.** Display links, timers, threads, file handles, foreground services, temp files. Forgetting one is a leak; forgetting all of them is a crash.
6. **Never fabricate citations.** When comparing against other libraries, fetch and verify every URL and every feature claim. (Yes, we made this mistake in the README.)

---

## 1. React Native Fabric pitfalls

### 1.1 `display: 'none'` unmounts the iOS host view

**Symptom**: On iOS, recipe screens that wrap `<WaveformRecorderView>` in a parent `<View style={{ display: 'none' }}>` for an off-screen "hidden recorder" pattern reported the record button doing nothing. Android worked.

**Root cause**: Under Fabric, `display: 'none'` removes the underlying `UIView` from the hierarchy on iOS. The component re-mounts when `display` flips back. While unmounted, the imperative `ref.current` is `null` and any `ref.current?.start()` call silently no-ops.

**Fix pattern**: For "mounted but invisible" recorders, use absolute off-screen positioning instead:

```ts
hiddenRow: {
  position: 'absolute',
  left: -100000,
  top: 0,
  opacity: 0,
}
```

This keeps the native view mounted, the ref alive, and commands routable.

**Generalisation**: On Fabric, `display: 'none'` is closer to conditional rendering than "hide me." If you need the imperative ref to survive, don't use it.

---

### 1.2 `View.GONE` on Android prevents layout measurement

**Symptom**: On Android, the preview-mode play button was missing entirely. iOS was fine.

**Root cause**: The button's initial visibility was `View.GONE`. Under Fabric, `GONE` means "skip measure + layout entirely." When we later flipped it to `VISIBLE`, the host's `requestLayout()` wasn't reliably re-measuring it — the button took zero pixels and never drew.

**Fix pattern**:
- Use `View.INVISIBLE` for the initial state (keeps the view in layout, just doesn't draw).
- After flipping to `VISIBLE`, force an immediate `measure()` + `layout()` pass so the host's coordinates resolve before the next frame.

```kotlin
playButton.visibility = View.VISIBLE
requestLayout()
if (width > 0 && height > 0) {
  measure(
    View.MeasureSpec.makeMeasureSpec(width, View.MeasureSpec.EXACTLY),
    View.MeasureSpec.makeMeasureSpec(height, View.MeasureSpec.EXACTLY)
  )
  layout(left, top, right, bottom)
}
```

**Generalisation**: `View.GONE` is for views that should be ignored. `View.INVISIBLE` is for views that should be reserved space but not drawn.

---

### 1.3 Codegen DirectEvent payloads can't contain arrays

**Symptom**: Android build failed with `Error: Unable to determine event type for "samples": ReadonlyArray`.

**Root cause**: React Native Codegen's DirectEvent payload validator doesn't accept array types.

**Fix pattern**: Serialise to a delimited string on the native side; parse in the JS wrapper before invoking the public callback.

```ts
samplesCsv: string  // codegen-friendly
```

Then in the JS wrapper:

```ts
const samples = samplesCsv.split(',').map(Number);
onComplete?.({ ...rest, samples });
```

The CSV layer is an implementation detail — public consumers never see it.

**Generalisation**: Codegen is strict. If your prop/event shape feels "obvious," verify the shape is permitted before betting on it. Easy escape hatches: string-encoded JSON, CSV, or numeric flags.

---

### 1.4 Stale codegen after spec changes

**Symptom**: iOS build fails with `no member named 'backgroundRecording' in 'facebook::react::WaveformRecorderViewProps'` after adding a new prop.

**Root cause**: iOS codegen artifacts are generated during `pod install`, not on every build. Editing the codegen spec doesn't automatically regenerate them.

**Fix pattern**: `cd example/ios && pod install` after every change to `src/WaveformRecorderViewNativeComponent.ts`. Android regenerates automatically as part of gradle.

**Generalisation**: Build any prop/event/command change in 8 steps (codegen spec, public types, JS wrapper, iOS `.mm` bridge, iOS impl, Android view manager, Android impl, then `pod install`). Skipping any one of them produces hard-to-debug failures.

---

## 2. Native gesture conflicts

### 2.1 React Navigation's swipe-back gesture intercepts our scrub

**Symptom**: On iOS in preview mode, dragging horizontally on the waveform to seek would trigger React Navigation's back gesture instead. Android was fine because its gesture is vertical-edge-only.

**Root cause**: Our initial implementation used raw `touchesBegan/Moved/Ended/Cancelled` overrides on the `UIView`. iOS resolves gesture conflicts using `UIGestureRecognizer.delegate` semantics, and a parent gesture recogniser wins by default unless a child explicitly claims priority. Raw touch overrides don't participate in that arbitration.

**Fix pattern**: Use `UILongPressGestureRecognizer` with:

```swift
let r = UILongPressGestureRecognizer(target: self, action: ...)
r.minimumPressDuration = 0                       // fire instantly
r.allowableMovement = .greatestFiniteMagnitude   // never cancel due to movement
r.cancelsTouchesInView = false                   // don't disrupt sibling views
```

`minimumPressDuration = 0` makes it behave like a pan but with proper gesture-recogniser arbitration, so it claims the touch before the navigation gesture can.

**Generalisation**: On iOS, any custom touch handling inside a navigation stack should go through `UIGestureRecognizer` — not raw `UIResponder` overrides — so the system can resolve conflicts. On Android, the analogous trick is `requestDisallowInterceptTouchEvent(true)` on the parent.

---

## 3. State machine & UI synchronisation

This was the single largest source of subtle bugs. The pattern is always: **data state changes, but a dependent UI element doesn't refresh because the change took a "fast path" that bypassed the UI update.**

### 3.1 Direct `compositeState = .paused` bypassed layout updates

**Symptom**: After `record → pause → enterPreview → exitPreview`, the preview-mode play button stayed on screen.

**Root cause**: `exitPreviewCommand()` assigned directly to `compositeState = .paused`. The `didSet` only fired `emitStateChange()`. It did NOT call `updatePlayButtonVisibility()` or `setNeedsLayout()`.

**Fix pattern**: Route every transition through one function — `transitionComposite(target)` — that:
1. Mutates `compositeState`.
2. Fans out to every UI surface that depends on the state (`updatePlayButtonVisibility`, `setNeedsLayout`, gesture recogniser toggling, …).

```swift
private func transitionComposite(_ target: CompositeState) {
    if compositeState != target {
        compositeState = target
        updatePlayButtonVisibility()
        setNeedsLayout()
    }
}
```

Then never assign to `compositeState` directly outside of `transitionComposite()`.

**Generalisation**: If a state machine has N states and M dependent UI surfaces, you have N × M edges that can desync. Centralising the transition into one function collapses that to M edges from one source.

---

### 3.2 IDLE branch cleared bars but not the time label

**Symptom**: After `record → stop → cancel`, the waveform bars disappeared (correct) but the duration label kept showing the post-stop time instead of resetting to `0:00`.

**Root cause**: `handleRecorderStateChange()`'s `.idle` branch called `barsView.clearRecordingAmplitudes()` but didn't call `updateTimeLabel()`. The engine had reset `durationMs = 0`, the bars knew about it, but the label didn't.

**Fix pattern**: When you reset internal data, refresh **every** UI element that reads from it — in the same branch, right next to the reset. Don't rely on incidental redraws.

```swift
case .idle:
    barsView.isRecording = false
    barsView.clearRecordingAmplitudes()
    updateTimeLabel()           // ← add this; the durationMs source just reset
    transitionComposite(.idle)
```

**Generalisation**: For every piece of state, list the UI surfaces that read it. When the state changes, walk that list. A consistent "refresh fan-out" pattern is your best defence.

---

### 3.3 `barsView.isRecording = true` setter clears the buffer

**Symptom**: After `record → pause → enterPreview → exitPreview`, the live waveform vanished.

**Root cause**: The `isRecording = false → true` setter on `WaveformBarsView` clears the ring buffer because it assumes a fresh recording session. Exiting preview correctly re-armed `isRecording = true` for the continue-recording path — and silently wiped the bars the user just saw.

**Fix pattern**: After re-arming `isRecording = true` in `exitPreviewInternal()`, immediately re-seed the buffer from the recorder engine's amplitude history snapshot:

```swift
let history = recorderEngine.amplitudeHistorySnapshot.map { CGFloat($0) }
barsView.isRecording = true
barsView.setRecordingAmplitudes(history)   // ← re-seed
```

**Generalisation**: Setters with side effects (especially `didSet { clear() }`-style invariants) are landmines for composite state machines. Document them loudly, or restructure so the clear lives on an explicit `reset()` call instead of a setter side-effect.

---

### 3.4 Bar animation slot math pinned the wrong bar

**Symptom**: During the sub-pixel scroll animation, the *newest* bar visibly slid leftward during its grow-in window, instead of being pinned at slot 0 and growing in place.

**Root cause**: The `slotFromRight` formula applied `rawProgress` (the sub-pixel scroll offset) to every bar uniformly, including the newest one. The newest bar should be pinned to slot 0 for the entire interval (only growing), and the scroll offset should apply to older bars.

**Fix pattern**:

```swift
// ageFromLatest: 0 = newest, 1 = previous, ...
let ageFromLatest = recordingAmps.count - 1 - sourceIdx
let slotFromRight: CGFloat = ageFromLatest == 0
    ? 0                                      // newest pinned to slot 0
    : CGFloat(ageFromLatest) - rawProgress   // older bars ease leftward
```

**Generalisation**: Animation slot math is fiddly. Add unit-style sanity checks: at `rawProgress = 0`, every bar should be at slot N. At `rawProgress = 0.5`, every bar should be at slot N - 0.5. Walk through a few `(ageFromLatest, rawProgress)` pairs by hand before shipping.

---

## 4. Async race conditions

### 4.1 Stale `snapshotForPreview` callback re-enters preview after cancel

**Symptom** (caught in a self-audit, not user-reported): A user could enter preview, the async concat could take several seconds to complete, the user could `cancel()` in the meantime, and the callback would land — re-entering preview from a cancelled state, leaking the temp file, and desyncing the state machine.

**Root cause**: `snapshotForPreview(completion:)` had no liveness guard. Whatever the engine state was when the callback fired, the callback acted on it.

**Fix pattern**: Generation counter.

```swift
private var previewToken: Int = 0

// On any state-mutating command (cancel, stop, exitPreview, resume, ...):
previewToken += 1

// When kicking off the async work:
let token = previewToken
recorderEngine.snapshotForPreview { [weak self] url, err in
    guard let self = self else { return }
    guard self.previewToken == token else {
        // Host has moved on. Drop the orphaned temp file the snapshot produced.
        if let url = url { Self.deleteIfTempConcat(url) }
        return
    }
    // ... safe to act on `url`
}
```

The token monotonically increments on every state-mutating command. The closure captures the token at call time; if the token has advanced when the closure fires, it's stale and bails.

**Generalisation**: Any time you launch async work that will produce a UI mutation or resource:
1. Capture a generation token at launch.
2. On every state change that would invalidate the work, bump the token.
3. In the callback, compare against the captured token; if it advanced, clean up and bail.

This is more robust than "weak self + isCancelled" because it survives view recycling.

---

### 4.2 Temp concat files leaked on every preview cleanup path

**Symptom** (caught in the same audit): Every preview exit / cancel / teardown / stale-callback path left a `wfr_concat_*.wav` (or `.m4a`) file in the app's caches directory. Multi-hour usage would slowly fill the cache.

**Root cause**: Multiple cleanup paths (preview-exit, cancel, stop-from-preview, teardown, `deinit`, stale-token) — none of them deleted the temp file.

**Fix pattern**: One helper, called from every cleanup path.

```swift
private static func deleteIfTempConcat(_ url: URL) {
    if url.lastPathComponent.hasPrefix("wfr_concat_") {
        try? FileManager.default.removeItem(at: url)
    }
}
```

Then call it from: `exitPreviewInternal`, `stopFromPreview`, `tearDown`, `deinit`, and the stale-token branch of the snapshot callback.

**Generalisation**: When you allocate a resource in a "fast path" (here, an async snapshot that produces a temp file), enumerate every possible exit path **before** shipping, and ensure cleanup is wired in every one. A grep for the resource-creation site is your friend.

---

## 5. Resource cleanup — the "every exit path" rule

Display links, timers, handlers, file handles, threads, foreground services, gesture recognisers, observers. Every one must be released on every state exit.

**Symptom pattern**: Subtle leaks that only manifest in long-running sessions or after many state cycles. Sometimes a crash on `deinit` if the resource still holds a `self` reference.

**Lesson**: When you write the acquisition line, write the cleanup line in the same edit.

```swift
// BAD
private var meterDisplayLink: CADisplayLink?

func startMeter() {
    meterDisplayLink = CADisplayLink(target: self, selector: ...)
    meterDisplayLink?.add(to: .main, forMode: .common)
}
// (no stopMeter() function — leaks until the view is fully released)

// GOOD
func startMeter() {
    if meterDisplayLink != nil { return }     // idempotent
    let link = CADisplayLink(target: self, selector: ...)
    link.add(to: .main, forMode: .common)
    meterDisplayLink = link
}

func stopMeter() {                            // mandatory companion
    meterDisplayLink?.invalidate()
    meterDisplayLink = nil
}
```

And every exit path — `pause`, `stop`, `cancel`, `tearDown`, `deinit`, error — must call `stopMeter()`.

**Generalisation**: Treat resource acquisition like opening a brace `{` — your eye should immediately go looking for the matching `}` cleanup.

---

## 6. Memory bounds for long-running native processes

The library's promise: "the only thing that grows over time is the audio file on disk, managed by the OS." Meeting that promise required a few patterns.

### 6.1 Ring buffer with explicit cap (visual amplitudes)

```swift
private var recordingAmps: [CGFloat] = []
private static let maxRecordingSamples: Int = 4096

func append(amplitude: CGFloat) {
    recordingAmps.append(max(0, min(1, amplitude)))
    if recordingAmps.count > Self.maxRecordingSamples {
        recordingAmps.removeFirst(recordingAmps.count - Self.maxRecordingSamples)
    }
}
```

### 6.2 Stride-merging for long history (engine amplitudes)

For data we need to retain across an entire (multi-hour) session, simple capping loses peaks. Stride-merge in pairs once the cap is hit, taking the max of each pair so peak energy survives.

```swift
private static let maxAmplitudeHistory: Int = 16384

private func appendAmplitudeBounded(_ value: Float) {
    amplitudeHistory.append(value)
    if amplitudeHistory.count <= Self.maxAmplitudeHistory { return }
    var compacted: [Float] = []
    compacted.reserveCapacity(Self.maxAmplitudeHistory)
    var i = 0
    while i + 1 < amplitudeHistory.count {
        compacted.append(max(amplitudeHistory[i], amplitudeHistory[i + 1]))
        i += 2
    }
    if i < amplitudeHistory.count { compacted.append(amplitudeHistory[i]) }
    amplitudeHistory = compacted
}
```

A 1-hour recording at 12 samples/sec = 43200 raw samples; after one merge cycle that fits in 16384, after two it fits comfortably. The visual fidelity stays high.

### 6.3 Bounded I/O for file-based work

The cautionary tale: our WAV multi-segment concat path. Each segment is loaded fully into RAM via `Data(contentsOf:)` / `file.readBytes()`, then concatenated, then written. Peak memory ≈ 3× total PCM on iOS (`Data + Data + Data` creates triple copies) and 1× on Android. For a 1-hour multi-segment WAV recording (~317 MB raw), iOS can peak ~950 MB and crash.

**The fix** (deferred — documented in the README roadmap): stream segment-to-segment via 256 KB chunks instead of buffering whole files. Peak memory drops from 3× total PCM to 256 KB.

**Lesson**: When you write code that touches files of unknown size, sketch the worst-case memory profile before shipping. "Load → process → write" feels innocent and is the most common way to ship a memory bomb.

### 6.4 Stream don't buffer (PCM events to JS)

For raw-PCM streaming we cap each chunk at 256 KB and emit immediately. Never accumulate.

---

## 7. Cross-platform parity

iOS and Android are intentional mirrors. Every fix on one needs a twin on the other. Of the bugs in this document, **most affected both platforms** — they manifested differently because of platform quirks, but the root cause was usually shared logic.

Examples:
- The `barsView.isRecording = true` clearing bug existed on both, fixed in `ios/WaveformRecorderViewImpl.swift` and `android/.../WaveformRecorderView.kt` with identical re-seed logic.
- The `previewToken` generation counter for snapshot races was added to both platforms in the same audit.
- The `futureBarStyle` dot/line and disappear-after-stop bugs affected both `ios/WaveformBarsView.swift` and `android/.../WaveformBarsView.kt`.

**Lesson**: When fixing a bug on one platform, **always** open the other platform's mirror file and look for the same code path. The pair-fix discipline saves more time than it costs.

When the platforms genuinely diverge (e.g. iOS `display: 'none'` unmounts but Android doesn't), document the divergence in a comment near the platform-specific code so the next reader doesn't try to "harmonise" them.

---

## 8. Default behaviours matter more than features

A surprising amount of polish came from matching the default behaviour of the reference apps, not from adding features:

| Default we changed | Why |
| --- | --- |
| Idle state shows no bars at all (not placeholder bars) | Matches WhatsApp / Slack / Messenger. The pre-recording emptiness is part of the UX. |
| `futureBarStyle` defaults to `'hidden'` | Same — Instagram / Zalo use `'dot'`, set explicitly. |
| Bars stay frozen on stop (don't clear) | The duration label persists; the bars should too. |
| Cancel clears both bars AND label | Symmetric reset — easy to forget the label. |

**Lesson**: Before picking a default, look at three or four reference apps. If they all agree, the default's clear. If they disagree, ship the most-conservative default and document the prop for the others.

---

## 9. Documentation honesty

This one bit us in the README.

**What happened**: In the original "Why another recorder?" comparison table, we cited three competitor libraries: `simform-solutions/react-native-audio-waveform`, `AlirezaHadjar/react-native-nitro-sound`, and `SocketSomeone/react-native-waveforms`. None of these URLs resolved:
- The Simform URL had the wrong org name (real: `SimformSolutionsPvtLtd`).
- The nitro-sound URL had the wrong maintainer (real: `hyochan`).
- `SocketSomeone/react-native-waveforms` **did not exist anywhere** — it was hallucinated from training data.

When the user flagged the broken links, we discovered not just URL typos but also several **factual errors** in the comparison claims for the two real libraries (e.g. claimed SimformSolutions didn't support pause/resume, but its README documents `pauseRecord()` / `resumeRecord()`).

**Lessons**:
1. **Every external citation must be fetched and verified.** Both the URL and the claims about it.
2. **If you can't verify, don't cite.** Removing a column is always better than fabricating one.
3. **When you find one mistake, audit the surrounding work.** The fake third row meant the comparison author was operating from memory, so rows 1 and 2 needed re-verification too.

The current table cites 5 real libraries with URLs verified live and claims cross-checked against each library's README.

---

## 10. Code review your own work AFTER it passes

A big chunk of our most important fixes came from **post-launch audits**, not from "make the feature work" sessions:

- The `previewToken` generation counter (4.1) — caught by re-reading the async preview path after it was working.
- The temp concat file cleanup (4.2) — caught in the same pass.
- The WAV multi-segment memory hazard (6.3) — caught in a long-recording memory review after the stress test passed.
- The cancel-after-stop time-label bug — surfaced by a user actually exercising the state machine in an unusual order.

The pattern: implementing a feature optimises for "does the happy path work?" and the bugs hide in the edges. A dedicated review pass — asking specifically *"what happens if the user does X in the middle of Y?"* and *"what if this async work outlives its caller?"* — catches what feature-writing misses.

**Practical recommendation**: For any feature touching state machines, async work, or long-running native processes, schedule a dedicated review pass before considering it done. Ask:
- What's the memory profile in the worst case?
- What happens on every cleanup path?
- What state mutations can race with this async work?
- What edge state combinations exist that the happy-path test didn't cover?

---

## 11. Process & workflow takeaways

- **`yarn lint --fix` before finishing.** ESLint catches things like `no-void` warnings that otherwise slip through.
- **`pod install` after every codegen-affecting change.** Non-negotiable on iOS.
- **Run the `StressTestScreen` for at least a minute** before considering anything memory-sensitive done.
- **Test the state machine in unusual orders.** `start → stop → cancel`, `record → pause → preview → exit → resume → preview → stop`, etc. Each combination is a potential bug site.
- **When the user reports a bug on one platform, check the other.** Often it's the same bug, manifesting differently.
- **Don't scrub PII at the end — never write it in the first place.** We had `/Users/bytedance/...` paths in a planning document because they were captured during exploration. The fix was global, but it was easier to avoid in the first place by using relative paths from day one.

---

## What could still bite us

Honestly catalogued in [README → Roadmap & known limitations](./README.md#roadmap--known-limitations), but worth restating:

- **WAV multi-segment concat memory** (Section 6.3). Real bug, deferred fix.
- **`recordingMode: 'morph'` and `'centered'` not implemented.** Accepted as prop values but fall through to `'scroll'`. The bar animation slot math (Section 3.4) was hard enough for one mode; another two need similar care.
- **CI workflow not wired up.** Lint / typecheck / build run locally only. Easy regressions await.
- **No automated tests.** Manual verification only. The state-machine bugs in Section 3 would have been caught by even basic unit tests on the engine.

---

If you're working on this codebase and find a new failure mode that taught you something — add a section here. Keep it specific (real symptom, real root cause, real fix) and add the meta-lesson so the next reader doesn't have to re-derive it.
