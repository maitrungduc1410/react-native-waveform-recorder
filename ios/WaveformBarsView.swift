import UIKit

/// Custom UIView that draws the audio waveform as a row of vertical rounded
/// rectangles. Used in two modes:
///
///   1. **Recording mode** (`isRecording = true`): `append(amplitude:)` pushes
///      new samples into a ring buffer at `samplesPerSecond` rate. Existing
///      bars shift left ("scroll" mode), morph in place ("morph"), or stay
///      centered with bars added on both sides ("centered"). Bars to the
///      right of the latest sample are drawn in `futureBarStyle` (dot/line/
///      hidden).
///
///   2. **Preview mode** (`isRecording = false`, the same code path the
///      player uses): the bars view renders the supplied `amplitudes` array
///      with a two-tone "played" / "unplayed" fill driven by
///      `progressFraction`. Tap-and-drag scrubbing is enabled in v0.2.
///
/// Drawing is cached: a `UIBezierPath` is rebuilt only when the bar layout
/// (size, bar geometry, future-bar style) changes — per-frame updates from
/// the amplitude ring buffer just invalidate the path so the next draw
/// rebuilds in <0.1 ms for ~150 bars.
final class WaveformBarsView: UIView {

    // MARK: - Visual configuration

    /// Static amplitudes (preview mode). Setting this clears the recording
    /// ring buffer and switches to two-tone rendering.
    var amplitudes: [CGFloat] = [] {
        didSet {
            recordingAmps.removeAll()
            invalidatePath()
        }
    }

    var playedBarColor: UIColor = .white {
        didSet { setNeedsDisplay() }
    }
    var unplayedBarColor: UIColor = UIColor.white.withAlphaComponent(0.5) {
        didSet { setNeedsDisplay() }
    }
    /// Color for the dotted "future" bars to the right of the recording head.
    /// `nil` -> auto: a slightly faded `unplayedBarColor`.
    var futureBarColor: UIColor? {
        didSet { setNeedsDisplay() }
    }

    var barWidth: CGFloat = 3 {
        didSet { invalidatePath() }
    }
    var barGap: CGFloat = 2 {
        didSet { invalidatePath() }
    }
    /// `< 0` means "auto" (barWidth / 2).
    var barRadius: CGFloat = -1 {
        didSet { invalidatePath() }
    }

    /// Recording sub-mode. Only `.scroll` is fully wired in v0.1 — `.morph`
    /// and `.centered` are accepted at the API level and currently fall back
    /// to scroll behaviour. The full morph/centered animations land in v0.2.
    enum RecordingMode: String {
        case scroll
        case morph
        case centered
    }
    var recordingMode: RecordingMode = .scroll {
        didSet { invalidatePath() }
    }

    /// How to draw bars to the right of the recording head (i.e. amplitudes
    /// not yet sampled).
    enum FutureBarStyle: String {
        case dot
        case line
        case hidden
    }
    var futureBarStyle: FutureBarStyle = .hidden {
        didSet { invalidatePath() }
    }

    /// Per-bar entry animation. `.grow` (default) eases a new bar up from
    /// `barWidth` to its full amplitude. `.fade` cross-fades it in. `.none`
    /// snaps. Only honored in recording mode.
    enum NewSampleEntry: String {
        case grow
        case fade
        case none
    }
    var newSampleEntry: NewSampleEntry = .grow {
        didSet { setNeedsDisplay() }
    }

    /// True while a recording session is active. Drives the two-tone vs.
    /// scroll-and-dotted-future rendering split, and gates the smooth-scroll
    /// animation display link.
    ///
    /// State transitions:
    ///   * `false -> true` (start of a fresh recording session): wipes any
    ///     bars left over from a previous "stopped" snapshot so the new
    ///     ribbon starts from an empty view, then starts the scroll loop.
    ///   * `true -> false` (recording ended, but not entering preview): we
    ///     deliberately KEEP `recordingAmps` so the just-recorded waveform
    ///     stays frozen on screen alongside the duration label until the
    ///     host explicitly clears (cancel / teardown) or sets `amplitudes`
    ///     (enterPreview). Just stops the scroll loop so frames are no
    ///     longer redrawn for nothing.
    var isRecording: Bool = false {
        didSet {
            if oldValue != isRecording {
                if isRecording {
                    recordingAmps.removeAll()
                    startScrollAnimation()
                } else {
                    stopScrollAnimation()
                }
                invalidatePath()
            }
        }
    }

    /// Expected sample arrival rate. Drives the smooth-scroll cadence — bars
    /// slide left by `step` pixels over `1 / samplesPerSecond` seconds so the
    /// visual scroll matches the rate at which the host pushes new samples
    /// via `append(amplitude:)`. Defaults to 12 to match the recorder view's
    /// default `samplesPerSecond` prop.
    var samplesPerSecond: Int = 12

    /// Fraction of the waveform that has been played, in [0, 1]. Preview-mode
    /// only; ignored while `isRecording` is true.
    var progressFraction: CGFloat = 0 {
        didSet {
            if oldValue != progressFraction {
                setNeedsDisplay()
            }
        }
    }

    // MARK: - Recording ring buffer

    private var recordingAmps: [CGFloat] = []
    /// Visual cap to avoid unbounded growth during very long recordings. The
    /// host view also derives a sensible max from `samplesPerSecond` + view
    /// width before pushing into us; this is the safety net.
    private static let maxRecordingSamples: Int = 4096
    /// Timestamp of the most recent `append(amplitude:)`. Drives the
    /// sub-pixel scroll + grow-in animation in `drawRecording`.
    private var lastAppendTime: CFTimeInterval = 0
    private var scrollDisplayLink: CADisplayLink?

    /// Append a new amplitude sample (0..1). Trims the ring buffer and resets
    /// the scroll-progress clock so the new bar grows in over one sample
    /// interval while existing bars slide left.
    func append(amplitude: CGFloat) {
        recordingAmps.append(max(0, min(1, amplitude)))
        if recordingAmps.count > Self.maxRecordingSamples {
            recordingAmps.removeFirst(recordingAmps.count - Self.maxRecordingSamples)
        }
        lastAppendTime = CACurrentMediaTime()
        startScrollAnimation()
        // Don't invalidate the cached preview path — recording mode rebuilds
        // its own per-bar geometry on every frame.
        setNeedsDisplay()
    }

    /// Replace the entire ring buffer (used by tests / centered mode pre-fills).
    func setRecordingAmplitudes(_ amps: [CGFloat]) {
        recordingAmps = amps.suffix(Self.maxRecordingSamples).map { max(0, min(1, $0)) }
        lastAppendTime = CACurrentMediaTime()
        setNeedsDisplay()
    }

    /// Clear the ring buffer (used by `cancel()`).
    func clearRecordingAmplitudes() {
        recordingAmps.removeAll()
        lastAppendTime = 0
        setNeedsDisplay()
    }

    // MARK: - Smooth-scroll animation

    /// Run the display link at screen refresh while recording so the ribbon
    /// can interpolate sub-pixel positions between appends. The display link
    /// is cheap when there's nothing to redraw — we early-out in
    /// `handleScrollTick` if no animation is currently active.
    private func startScrollAnimation() {
        guard isRecording else { return }
        if scrollDisplayLink != nil { return }
        let link = CADisplayLink(target: self, selector: #selector(handleScrollTick))
        link.add(to: .main, forMode: .common)
        scrollDisplayLink = link
    }

    private func stopScrollAnimation() {
        scrollDisplayLink?.invalidate()
        scrollDisplayLink = nil
    }

    @objc private func handleScrollTick() {
        // If we're past one sample interval beyond the last append, there's
        // nothing left to animate (the ribbon has settled). Suspend the
        // display link until the next append wakes us back up.
        let interval = 1.0 / Double(max(1, samplesPerSecond))
        let elapsed = CACurrentMediaTime() - lastAppendTime
        if elapsed >= interval + 0.05 {
            stopScrollAnimation()
            return
        }
        setNeedsDisplay()
    }

    // MARK: - Scrub callbacks (preview mode; wired in v0.2)

    var onScrubBegan: ((CGFloat) -> Void)?
    var onScrubMoved: ((CGFloat) -> Void)?
    var onScrubEnded: ((CGFloat, _ cancelled: Bool) -> Void)?

    // MARK: - Private

    private var cachedPath: UIBezierPath?
    private var cachedSize: CGSize = .zero

    override init(frame: CGRect) {
        super.init(frame: frame)
        commonInit()
    }
    required init?(coder: NSCoder) {
        super.init(coder: coder)
        commonInit()
    }
    private func commonInit() {
        isOpaque = false
        backgroundColor = .clear
        contentMode = .redraw
        isUserInteractionEnabled = true
        installScrubRecogniser()
    }

    deinit {
        scrollDisplayLink?.invalidate()
        scrollDisplayLink = nil
    }

    // MARK: - Scrub gesture (preview only)

    private var isTrackingScrub = false

    /// Immediate-fire long-press recogniser that owns the scrub touch.
    ///
    /// We can't use raw `touchesBegan/Moved/Ended` overrides here: a parent
    /// `UIPanGestureRecognizer` (UINavigationController's
    /// `interactivePopGestureRecognizer`, the full-screen pan that
    /// `react-native-screens` attaches when `fullScreenGestureEnabled` is on,
    /// or any wrapping `UIScrollView`) would happily steal the touch as
    /// soon as the user dragged horizontally — UIKit cancels our touch
    /// sequence and the navigator pops the screen mid-scrub.
    ///
    /// `UILongPressGestureRecognizer` with `minimumPressDuration = 0`
    /// recognises *instantly* on touch-down, immediately enters `.began`,
    /// and from then on owns the touch. Other pans waiting for movement
    /// to recognise lose. `allowableMovement = .greatestFiniteMagnitude`
    /// keeps us recognising no matter how far the user drags;
    /// `cancelsTouchesInView = false` lets sibling touch handling continue
    /// to function normally. This is the same pattern we use in the
    /// sibling waveform-player library.
    private lazy var scrubRecogniser: UILongPressGestureRecognizer = {
        let r = UILongPressGestureRecognizer(
            target: self,
            action: #selector(handleScrubGesture(_:))
        )
        r.minimumPressDuration = 0
        r.allowableMovement = .greatestFiniteMagnitude
        r.cancelsTouchesInView = false
        return r
    }()

    /// Attach the scrub recogniser. Called from `commonInit()`.
    private func installScrubRecogniser() {
        addGestureRecognizer(scrubRecogniser)
    }

    /// Only intercept touches in preview mode. Recording-mode touches pass
    /// through (and the recogniser's handler bails on `isRecording`), so
    /// the host view (or its parent) can still react.
    override func point(inside point: CGPoint, with event: UIEvent?) -> Bool {
        if isRecording { return false }
        return super.point(inside: point, with: event)
    }

    @objc private func handleScrubGesture(_ recogniser: UILongPressGestureRecognizer) {
        // Bail if recording-mode flipped on between gesture start and now.
        if isRecording {
            if isTrackingScrub {
                isTrackingScrub = false
                onScrubEnded?(progressFraction, true)
            }
            return
        }
        let fraction = fractionForPoint(recogniser.location(in: self))
        switch recogniser.state {
        case .began:
            isTrackingScrub = true
            onScrubBegan?(fraction)
        case .changed:
            guard isTrackingScrub else { return }
            onScrubMoved?(fraction)
        case .ended:
            guard isTrackingScrub else { return }
            isTrackingScrub = false
            onScrubEnded?(fraction, false)
        case .cancelled, .failed:
            guard isTrackingScrub else { return }
            isTrackingScrub = false
            onScrubEnded?(progressFraction, true)
        default:
            break
        }
    }

    private func fractionForPoint(_ point: CGPoint) -> CGFloat {
        guard bounds.width > 0 else { return 0 }
        let raw = point.x / bounds.width
        if raw.isNaN { return 0 }
        return max(0, min(1, raw))
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        if cachedSize != bounds.size {
            invalidatePath()
        }
    }

    private func invalidatePath() {
        cachedPath = nil
        cachedSize = .zero
        setNeedsDisplay()
    }

    // MARK: - Drawing

    override func draw(_ rect: CGRect) {
        // Recording layout owns the dispatch whenever there are live
        // amplitude samples — whether we're actively recording (animated /
        // scrolling) OR sitting in the .stopped composite state (frozen
        // at the last frame the user saw). Only fall back to the preview
        // path when there are no live bars; that's where the player's
        // two-tone scrub UI lives.
        if isRecording || !recordingAmps.isEmpty {
            drawRecording()
        } else {
            drawPreview()
        }
    }

    // MARK: Recording rendering

    /// Render the recording-mode bars with smooth sub-pixel scrolling, a
    /// height-from-zero entry animation for the newest bar, and a shrink-to-
    /// zero exit animation for whatever bar is sliding off the left edge.
    ///
    /// Time model (with `interval = 1 / samplesPerSecond`):
    ///   * `scrollProgress = clamp(now - lastAppendTime, 0, interval) / interval`.
    ///   * Each bar's x-position is shifted left by `scrollProgress * step`
    ///     so the ribbon smoothly advances between appends.
    ///   * The newest bar grows from 0 to its full height as `scrollProgress`
    ///     traverses 0 -> 1 (ease-out cubic).
    ///   * The bar whose centre crosses x = 0 (going left) gets its height
    ///     scaled linearly from 1 -> 0, so it shrinks instead of popping out.
    private func drawRecording() {
        let totalWidth = bounds.width
        let totalHeight = bounds.height
        guard totalWidth > 0, totalHeight > 0 else { return }

        let step = barWidth + barGap
        guard step > 0 else { return }
        let visibleBars = max(1, Int(floor(totalWidth / step)))
        let verticalPadding = barWidth * 1.5
        let drawableHeight = max(barWidth, totalHeight - verticalPadding * 2)
        let radius = barRadius < 0 ? barWidth / 2 : barRadius
        let minBarHeight = barWidth

        // How far through the current sample interval we are. While the
        // engine is between appends this slides smoothly from 0 -> 1, then
        // resets on the next `append(amplitude:)` call. When `isRecording`
        // is false we're frozen at "last frame after stop" — pin progress
        // to 1 so every bar sits at its final resting slot and skip the
        // entry-grow taper entirely (the rightmost few bars would
        // otherwise look stuck mid-animation).
        let rawProgress: CGFloat
        if isRecording {
            let interval = 1.0 / CGFloat(max(1, samplesPerSecond))
            let elapsed = CGFloat(max(0, CACurrentMediaTime() - lastAppendTime))
            rawProgress = lastAppendTime == 0 ? 1.0 : min(1.0, elapsed / interval)
        } else {
            rawProgress = 1.0
        }

        // Render `entryWindow` extra bars beyond the rightmost visible slot
        // so the grow-in taper can play across multiple bars without
        // discontinuities at the edge of the buffer.
        let renderCount = min(recordingAmps.count, visibleBars + Self.exitWindow)
        let firstSourceIdx = recordingAmps.count - renderCount

        playedBarColor.setFill()
        for i in 0..<renderCount {
            let sourceIdx = firstSourceIdx + i
            let amp = recordingAmps[sourceIdx]
            // ageFromLatest: 0 = newest bar, 1 = previous, ...
            let ageFromLatest = recordingAmps.count - 1 - sourceIdx
            // Visual slot from the right, in sub-pixel units.
            //   * The latest bar (ageFromLatest = 0) is pinned to slot 0 for
            //     the entire interval; only its height grows.
            //   * Older bars slide one slot leftward — they ease from their
            //     previous resting slot (ageFromLatest - 1) to their new
            //     resting slot (ageFromLatest) over the interval.
            let slotFromRight: CGFloat = ageFromLatest == 0
                ? 0
                : CGFloat(ageFromLatest - 1) + rawProgress

            // Entry taper: the rightmost `entryWindow` bars are still
            // settling. `settleAge` is a continuous "how long ago did this
            // bar appear" measured in sample intervals — at rawProgress = 0
            // it equals `ageFromLatest`, at rawProgress = 1 it equals
            // `ageFromLatest + 1`. Normalise to [0, 1] across `entryWindow`
            // intervals and ease for a snappy start.
            //
            // In the frozen-after-stop case we force `entryScale = 1` so
            // the static snapshot doesn't show those last few bars at
            // sub-full height (the animation has nothing left to settle
            // into).
            let entryScale: CGFloat
            if isRecording {
                let settleAge = CGFloat(ageFromLatest) + rawProgress
                let entryProgress = min(1, settleAge / CGFloat(Self.entryWindow))
                entryScale = Self.easeOutCubic(entryProgress)
            } else {
                entryScale = 1
            }

            // Exit taper: the leftmost `exitWindow` slots taper from 1 down
            // toward 0 as they approach the left edge. `slotsFromLeft` is
            // measured so that a bar sitting in the leftmost *visible* slot
            // is 1 unit in (still visible at ~`1 / exitWindow` scale), and
            // a bar one slot past the left edge (off-screen) is 0 (hidden).
            // Linear is intentional here — easeOut would leave the leftmost
            // bar nearly full-height, which doesn't read as "fading".
            let slotsFromLeft = CGFloat(visibleBars) - slotFromRight
            let exitScale = min(1, max(0, slotsFromLeft / CGFloat(Self.exitWindow)))

            let scale = entryScale * exitScale
            if scale <= 0 { continue }

            // Map the "slot from leading edge" into screen-x. The leading
            // edge is the right side; the entry/exit math above is
            // direction-agnostic.
            let x: CGFloat = totalWidth - barWidth - slotFromRight * step
            // Apply the minimum-height floor *before* the entry scale so
            // silent samples still get a visible nub at the end of the
            // grow-in (matches the request: silent != zero height).
            let targetHeight = max(minBarHeight, amp * drawableHeight)
            let barHeight = targetHeight * scale
            let y = verticalPadding + (drawableHeight - barHeight) / 2.0
            let path = UIBezierPath(
                roundedRect: CGRect(x: x, y: y, width: barWidth, height: barHeight),
                cornerRadius: radius
            )
            path.fill()
        }

        // Future placeholder bars fill any slots not yet covered by live
        // samples. We don't animate these — they get consumed naturally as
        // the live ribbon advances toward the trailing edge. We render
        // them in both `.recording` AND the frozen-after-stop state so
        // the empty left-hand region keeps the same visual texture
        // before / during / after the recording, instead of snapping to
        // blank the instant the user hits stop.
        if futureBarStyle != .hidden {
            let liveSlotCount = min(recordingAmps.count, visibleBars)
            let futureBarCount = visibleBars - liveSlotCount
            if futureBarCount > 0 {
                let color = futureBarColor ?? unplayedBarColor.withAlphaComponent(0.6)
                color.setFill()
                // `line` is a short vertical pill (~4× bar width tall) so
                // it reads distinctly from the circular `dot` style.
                // Using `barWidth × barWidth` here would render as a
                // circle (corner radius = half the side), making `line`
                // visually identical to `dot`.
                let lineHeight: CGFloat = barWidth * 4
                for i in 0..<futureBarCount {
                    // Empty slots fill [0, futureCount) on the left.
                    let slotIdx = i
                    let x = CGFloat(slotIdx) * step
                    let cy = verticalPadding + drawableHeight / 2.0
                    switch futureBarStyle {
                    case .dot:
                        let dotRadius = barWidth / 2
                        let dotRect = CGRect(
                            x: x,
                            y: cy - dotRadius,
                            width: barWidth,
                            height: barWidth
                        )
                        UIBezierPath(ovalIn: dotRect).fill()
                    case .line:
                        let lineRect = CGRect(
                            x: x,
                            y: cy - lineHeight / 2,
                            width: barWidth,
                            height: lineHeight
                        )
                        UIBezierPath(roundedRect: lineRect, cornerRadius: barWidth / 2).fill()
                    case .hidden:
                        break
                    }
                }
            }
        }
    }

    private static func easeOutCubic(_ t: CGFloat) -> CGFloat {
        let inv = 1 - t
        return 1 - inv * inv * inv
    }

    /// Number of bars on the right that participate in the grow-in taper. The
    /// newest bar starts at scale 0; each successive bar leftward steps up
    /// by `1 / entryWindow` until it reaches full height. Tuned against the
    /// WhatsApp reference UI — large enough to read as a smooth ramp, small
    /// enough to keep the active waveform clearly visible.
    private static let entryWindow: Int = 4
    /// Number of bars on the left that participate in the fade-out taper.
    /// Symmetric to the entry window so the ribbon looks balanced.
    private static let exitWindow: Int = 4

    // MARK: Preview rendering (player-style two-tone with cached path)

    private func ensurePreviewPath() -> UIBezierPath? {
        if let path = cachedPath, cachedSize == bounds.size {
            return path
        }
        let path = buildPreviewPath()
        cachedPath = path
        cachedSize = bounds.size
        return path
    }

    private func buildPreviewPath() -> UIBezierPath? {
        let totalWidth = bounds.width
        let totalHeight = bounds.height
        guard totalWidth > 0, totalHeight > 0 else { return nil }
        // Match the social-media-app convention: when there's no amplitude
        // data yet (idle state, just before the first sample), render
        // nothing instead of filling the view with a placeholder ribbon.
        // Callers that *want* a baseline visual can supply their own
        // `amplitudes` array.
        if amplitudes.isEmpty { return nil }
        let step = barWidth + barGap
        guard step > 0 else { return nil }
        let barCount = max(1, Int(floor(totalWidth / step)))
        let verticalPadding = barWidth * 1.5
        let drawableHeight = totalHeight - verticalPadding * 2
        guard drawableHeight > 0 else { return nil }
        let radius = barRadius < 0 ? barWidth / 2 : barRadius

        let path = UIBezierPath()
        for i in 0..<barCount {
            let ampIndex = i * amplitudes.count / barCount
            let amp = amplitudes[min(max(ampIndex, 0), amplitudes.count - 1)]
            let barHeight = max(barWidth, amp * drawableHeight)
            let x = CGFloat(i) * step
            let y = verticalPadding + (drawableHeight - barHeight) / 2.0
            path.append(UIBezierPath(
                roundedRect: CGRect(x: x, y: y, width: barWidth, height: barHeight),
                cornerRadius: radius
            ))
        }
        return path
    }

    private func drawPreview() {
        guard let path = ensurePreviewPath() else { return }
        guard let ctx = UIGraphicsGetCurrentContext() else { return }

        // Pass 1: full unplayed bars.
        unplayedBarColor.setFill()
        path.fill()

        let clamped = max(0, min(1, progressFraction))
        let progressX = clamped * bounds.width
        guard progressX > 0 else { return }

        // Pass 2: played overlay, clipped to the leftmost `progressX`.
        ctx.saveGState()
        ctx.clip(to: CGRect(x: 0, y: 0, width: progressX, height: bounds.height))
        playedBarColor.setFill()
        path.fill()
        ctx.restoreGState()
    }
}
