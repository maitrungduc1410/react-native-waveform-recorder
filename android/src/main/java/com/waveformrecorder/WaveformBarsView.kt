package com.waveformrecorder

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.util.AttributeSet
import android.view.MotionEvent
import android.view.View

/**
 * Renders the audio waveform as a row of vertical rounded-rect bars. Used in
 * two modes:
 *
 *   1. **Recording mode** (`isRecording = true`): [appendAmplitude] pushes
 *      new samples into a ring buffer. Existing bars shift left (in `scroll`
 *      mode), morph in place (`morph`), or stay centered (`centered`). Bars
 *      to the right of the latest sample are drawn in [futureBarStyle]
 *      (dot / line / hidden).
 *
 *   2. **Preview mode** (`isRecording = false`): renders the supplied
 *      [amplitudes] array with a two-tone "played" / "unplayed" fill driven
 *      by [progressFraction]. Scrub gesture is wired up in v0.2.
 *
 * Drawing is cached: a single `Path` containing all preview bars is rebuilt
 * only when the bar layout changes. Recording-mode rendering rebuilds per
 * frame because the visible bar set shifts every sample.
 */
class WaveformBarsView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : View(context, attrs, defStyleAttr) {

    // region Visual configuration ------------------------------------------------

    var amplitudes: FloatArray = FloatArray(0)
        private set

    /** Update preview-mode amplitudes (used when not actively recording). */
    fun setPreviewAmplitudes(values: FloatArray) {
        amplitudes = values
        recordingAmps.clear()
        invalidatePath()
    }

    var playedBarColor: Int
        get() = playedPaint.color
        set(value) {
            playedPaint.color = value
            invalidate()
        }

    var unplayedBarColor: Int
        get() = unplayedPaint.color
        set(value) {
            unplayedPaint.color = value
            invalidate()
        }

    /** Dotted "future" bar color. `null` = auto: faded unplayed color. */
    var futureBarColor: Int? = null
        set(value) {
            field = value
            futurePaint.color = value ?: deriveFutureColor(unplayedPaint.color)
            invalidate()
        }

    var barWidthPx: Float = 3f * resources.displayMetrics.density
        set(value) {
            field = value
            invalidatePath()
        }

    var barGapPx: Float = 2f * resources.displayMetrics.density
        set(value) {
            field = value
            invalidatePath()
        }

    /** `< 0` means "auto" = barWidth / 2. */
    var barRadiusPx: Float = -1f
        set(value) {
            field = value
            invalidatePath()
        }

    enum class RecordingMode { SCROLL, MORPH, CENTERED }
    var recordingMode: RecordingMode = RecordingMode.SCROLL
        set(value) {
            field = value
            invalidate()
        }

    enum class FutureBarStyle { DOT, LINE, HIDDEN }
    var futureBarStyle: FutureBarStyle = FutureBarStyle.HIDDEN
        set(value) {
            field = value
            invalidate()
        }

    enum class NewSampleEntry { GROW, FADE, NONE }
    var newSampleEntry: NewSampleEntry = NewSampleEntry.GROW
        set(value) {
            field = value
            invalidate()
        }

    /**
     * True while an active recording session is in progress.
     *
     * State transitions:
     *   * `false -> true` (start of a fresh recording session): wipes any
     *     bars left over from a previous "stopped" snapshot so the new
     *     ribbon starts from an empty view, then starts the scroll loop.
     *   * `true -> false` (recording ended, but not entering preview): we
     *     deliberately KEEP [recordingAmps] so the just-recorded waveform
     *     stays frozen on screen alongside the duration label until the
     *     host explicitly clears (cancel / teardown) or supplies preview
     *     amplitudes. Just stops the scroll loop so frames aren't redrawn
     *     for nothing.
     */
    var isRecording: Boolean = false
        set(value) {
            if (field == value) return
            field = value
            if (value) {
                recordingAmps.clear()
                startScrollAnimation()
            } else {
                stopScrollAnimation()
            }
            invalidatePath()
        }

    /**
     * Expected sample arrival rate. Drives the smooth-scroll cadence: the
     * ribbon slides left by `step` pixels over `1 / samplesPerSecond`
     * seconds so the visual scroll matches when the host pushes new samples
     * via [appendAmplitude]. Defaults to 12 to match the recorder view's
     * default `samplesPerSecond` prop.
     */
    var samplesPerSecond: Int = 12

    /** Preview-mode progress, in [0, 1]. */
    var progressFraction: Float = 0f
        set(value) {
            val clamped = value.coerceIn(0f, 1f)
            if (clamped != field) {
                field = clamped
                invalidate()
            }
        }

    // endregion

    // region Recording ring buffer ----------------------------------------------

    private val recordingAmps = ArrayList<Float>(MAX_RECORDING_SAMPLES)
    /**
     * Timestamp of the most recent [appendAmplitude] in nanoseconds. Drives
     * the sub-pixel scroll + grow-in animation in [drawRecording].
     */
    private var lastAppendNs: Long = 0L
    private var scrollAnimating: Boolean = false

    fun appendAmplitude(value: Float) {
        recordingAmps.add(value.coerceIn(0f, 1f))
        while (recordingAmps.size > MAX_RECORDING_SAMPLES) {
            recordingAmps.removeAt(0)
        }
        lastAppendNs = System.nanoTime()
        startScrollAnimation()
        invalidate()
    }

    fun setRecordingAmplitudes(values: FloatArray) {
        recordingAmps.clear()
        for (v in values) {
            recordingAmps.add(v.coerceIn(0f, 1f))
            if (recordingAmps.size > MAX_RECORDING_SAMPLES) {
                recordingAmps.removeAt(0)
            }
        }
        lastAppendNs = System.nanoTime()
        invalidate()
    }

    fun clearRecordingAmplitudes() {
        recordingAmps.clear()
        lastAppendNs = 0L
        invalidate()
    }

    // region Smooth-scroll animation -------------------------------------------

    /**
     * Posts a recurring redraw via [postOnAnimation] (Choreographer) so the
     * ribbon can interpolate sub-pixel positions between [appendAmplitude]
     * calls. We park the loop as soon as the ribbon has fully settled, so
     * idle frames don't keep the GPU busy.
     */
    private fun startScrollAnimation() {
        if (!isRecording) return
        if (scrollAnimating) return
        scrollAnimating = true
        postOnAnimation(scrollTickRunnable)
    }

    private fun stopScrollAnimation() {
        scrollAnimating = false
        removeCallbacks(scrollTickRunnable)
    }

    private val scrollTickRunnable: Runnable = object : Runnable {
        override fun run() {
            if (!scrollAnimating) return
            val intervalNs = 1_000_000_000L / samplesPerSecond.coerceAtLeast(1)
            val elapsed = System.nanoTime() - lastAppendNs
            if (lastAppendNs != 0L && elapsed >= intervalNs + 50_000_000L) {
                // Ribbon has settled — stop spinning until the next append.
                scrollAnimating = false
                invalidate()
                return
            }
            invalidate()
            postOnAnimation(this)
        }
    }

    // endregion

    // endregion

    // region Touch / scrub callbacks (v0.2 wires these to the preview path) -----

    var onScrubBegan: ((Float) -> Unit)? = null
    var onScrubMoved: ((Float) -> Unit)? = null
    var onScrubEnded: ((Float, Boolean) -> Unit)? = null

    // endregion

    // region Private state -------------------------------------------------------

    private val playedPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.WHITE
        style = Paint.Style.FILL
    }
    private val unplayedPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.argb(128, 255, 255, 255)
        style = Paint.Style.FILL
    }
    private val futurePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = deriveFutureColor(Color.argb(128, 255, 255, 255))
        style = Paint.Style.FILL
    }

    private var cachedPath: Path? = null
    private var cachedWidth: Int = 0
    private var cachedHeight: Int = 0
    private val tmpRect = RectF()

    // endregion

    init {
        isClickable = true
        isFocusable = true
    }

    override fun onDetachedFromWindow() {
        super.onDetachedFromWindow()
        stopScrollAnimation()
    }

    // region Scrub gesture (preview only) ---------------------------------------

    private var isTrackingScrub = false

    override fun onTouchEvent(event: MotionEvent): Boolean {
        // Recording mode passes touches through so the host (or its parent)
        // can react to e.g. a "slide-to-cancel" gesture in v0.3.
        if (isRecording) return false
        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                isTrackingScrub = true
                parent?.requestDisallowInterceptTouchEvent(true)
                onScrubBegan?.invoke(fractionForX(event.x))
                return true
            }
            MotionEvent.ACTION_MOVE -> {
                if (!isTrackingScrub) return false
                onScrubMoved?.invoke(fractionForX(event.x))
                return true
            }
            MotionEvent.ACTION_UP -> {
                if (!isTrackingScrub) return false
                isTrackingScrub = false
                parent?.requestDisallowInterceptTouchEvent(false)
                onScrubEnded?.invoke(fractionForX(event.x), false)
                performClick()
                return true
            }
            MotionEvent.ACTION_CANCEL -> {
                if (!isTrackingScrub) return false
                isTrackingScrub = false
                parent?.requestDisallowInterceptTouchEvent(false)
                onScrubEnded?.invoke(progressFraction, true)
                return true
            }
        }
        return false
    }

    override fun performClick(): Boolean {
        super.performClick()
        return true
    }

    private fun fractionForX(x: Float): Float {
        if (width <= 0) return 0f
        return (x / width.toFloat()).coerceIn(0f, 1f)
    }

    // endregion

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        super.onSizeChanged(w, h, oldw, oldh)
        if (w != cachedWidth || h != cachedHeight) {
            invalidatePath()
        }
    }

    private fun invalidatePath() {
        cachedPath = null
        cachedWidth = 0
        cachedHeight = 0
        invalidate()
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        // Recording layout owns the dispatch whenever there are live
        // amplitude samples — whether we're actively recording (animated /
        // scrolling) OR sitting in the .stopped composite state (frozen
        // at the last frame the user saw). Only fall back to the preview
        // path when there are no live bars; that's where the player's
        // two-tone scrub UI lives.
        if (isRecording || recordingAmps.isNotEmpty()) {
            drawRecording(canvas)
        } else {
            drawPreview(canvas)
        }
    }

    // region Recording rendering -------------------------------------------------

    /**
     * Render the recording-mode bars with sub-pixel scrolling, a height-from-
     * zero entry animation for the newest bar, and a shrink-to-zero exit for
     * whichever bar is sliding off the left edge.
     *
     * Time model (with `interval = 1 / samplesPerSecond`):
     *  * `scrollProgress = clamp(now - lastAppendNs, 0, interval) / interval`
     *  * Each bar's x is shifted left by `scrollProgress * step` so the
     *    ribbon advances smoothly between appends.
     *  * Newest bar's height interpolates from 0 -> target (ease-out cubic).
     *  * Whichever bar's left edge crosses x = 0 going left has its height
     *    scaled linearly from 1 -> 0 so it shrinks instead of popping.
     */
    private fun drawRecording(canvas: Canvas) {
        val totalWidth = width.toFloat()
        val totalHeight = height.toFloat()
        if (totalWidth <= 0f || totalHeight <= 0f) return

        val step = barWidthPx + barGapPx
        if (step <= 0f) return
        val visibleBars = (totalWidth / step).toInt().coerceAtLeast(1)
        val verticalPadding = barWidthPx * 1.5f
        val drawableHeight = (totalHeight - verticalPadding * 2f).coerceAtLeast(barWidthPx)
        val radius = if (barRadiusPx < 0f) barWidthPx / 2f else barRadiusPx
        val minBarHeight = barWidthPx

        // How far through the current sample interval we are. While the
        // engine is between appends this slides 0 -> 1, then resets on
        // the next [appendAmplitude]. When `isRecording` is false we're
        // frozen at "last frame after stop" — pin progress to 1 so every
        // bar sits at its final resting slot and the entry-grow taper is
        // skipped entirely (otherwise the rightmost few bars would look
        // stuck mid-animation).
        val rawProgress = if (!isRecording) {
            1f
        } else {
            val intervalNs = 1_000_000_000L / samplesPerSecond.coerceAtLeast(1)
            val elapsedNs = if (lastAppendNs == 0L) intervalNs else System.nanoTime() - lastAppendNs
            if (lastAppendNs == 0L) 1f
            else (elapsedNs.toFloat() / intervalNs.toFloat()).coerceIn(0f, 1f)
        }

        // Render `exitWindow` extra bars beyond the leftmost visible slot
        // so the exit-to-left taper can play across multiple bars without
        // popping. The newest few bars on the right are sourced from the
        // tail of `recordingAmps` naturally.
        val renderCount = recordingAmps.size.coerceAtMost(visibleBars + EXIT_WINDOW)
        val firstSourceIdx = recordingAmps.size - renderCount

        for (i in 0 until renderCount) {
            val sourceIdx = firstSourceIdx + i
            val amp = recordingAmps[sourceIdx]
            val ageFromLatest = recordingAmps.size - 1 - sourceIdx
            // The newest bar (ageFromLatest = 0) stays pinned to slot 0 for
            // the entire interval and only grows; older bars ease from their
            // previous resting slot (ageFromLatest - 1) to their new one
            // (ageFromLatest) over the same window.
            val slotFromRight = if (ageFromLatest == 0) {
                0f
            } else {
                (ageFromLatest - 1).toFloat() + rawProgress
            }

            // Entry taper: the rightmost `entryWindow` bars are still
            // settling. `settleAge` is a continuous "how long ago did this
            // bar appear" measured in sample intervals — at rawProgress=0
            // it equals ageFromLatest, at rawProgress=1 it equals
            // ageFromLatest+1. Normalise across ENTRY_WINDOW intervals
            // and ease for a snappy start.
            //
            // In the frozen-after-stop case we force `entryScale = 1` so
            // the static snapshot doesn't show those last few bars at
            // sub-full height — the animation has nothing left to settle
            // into.
            val entryScale = if (!isRecording) {
                1f
            } else {
                val settleAge = ageFromLatest.toFloat() + rawProgress
                val entryProgress = (settleAge / ENTRY_WINDOW.toFloat()).coerceAtMost(1f)
                easeOutCubic(entryProgress)
            }

            // Exit taper: the leftmost EXIT_WINDOW slots taper from 1 down
            // toward 0 as they approach the left edge. `slotsFromLeft = 1`
            // sits in the leftmost visible slot (partial scale); `= 0` is
            // one slot off-screen-left (hidden). Linear by design — easing
            // here leaves the leftmost bar nearly full-height, which
            // doesn't read as "fading".
            val slotsFromLeft = visibleBars.toFloat() - slotFromRight
            val exitScale = (slotsFromLeft / EXIT_WINDOW.toFloat()).coerceIn(0f, 1f)

            val scale = entryScale * exitScale
            if (scale <= 0f) continue

            // Map the "slot from leading edge" into screen-x. The leading
            // edge is the right side; the entry/exit math above is
            // direction-agnostic.
            val x = totalWidth - barWidthPx - slotFromRight * step
            // Min-height floor applied before the scale so silent samples
            // still get a visible nub once the grow-in finishes.
            val targetHeight = (amp * drawableHeight).coerceAtLeast(minBarHeight)
            val barHeight = targetHeight * scale
            val y = verticalPadding + (drawableHeight - barHeight) / 2f
            tmpRect.set(x, y, x + barWidthPx, y + barHeight)
            canvas.drawRoundRect(tmpRect, radius, radius, playedPaint)
        }

        // Future placeholder bars fill any slots not yet covered by live
        // samples. Drawn in both `.recording` AND the frozen-after-stop
        // state so the empty left-hand region keeps the same visual
        // texture before / during / after recording, instead of snapping
        // to blank the instant the user hits stop.
        if (futureBarStyle != FutureBarStyle.HIDDEN) {
            val liveSlotCount = recordingAmps.size.coerceAtMost(visibleBars)
            val futureCount = visibleBars - liveSlotCount
            if (futureCount > 0) {
                // `LINE` is a short vertical pill (~4× bar width tall) so
                // it reads distinctly from the circular `DOT` style.
                // A `barWidthPx × barWidthPx` round-rect with corner
                // radius = half the side would render as a circle and be
                // indistinguishable from `DOT`.
                val lineHeight = barWidthPx * 4f
                for (i in 0 until futureCount) {
                    // Empty slots fill [0, futureCount) on the left.
                    val slotIdx = i
                    val x = slotIdx * step
                    val cy = verticalPadding + drawableHeight / 2f
                    when (futureBarStyle) {
                        FutureBarStyle.DOT -> {
                            val r = barWidthPx / 2f
                            canvas.drawCircle(x + r, cy, r, futurePaint)
                        }
                        FutureBarStyle.LINE -> {
                            tmpRect.set(
                                x,
                                cy - lineHeight / 2f,
                                x + barWidthPx,
                                cy + lineHeight / 2f
                            )
                            canvas.drawRoundRect(
                                tmpRect,
                                barWidthPx / 2f,
                                barWidthPx / 2f,
                                futurePaint
                            )
                        }
                        FutureBarStyle.HIDDEN -> Unit
                    }
                }
            }
        }
    }

    private fun easeOutCubic(t: Float): Float {
        val inv = 1f - t
        return 1f - inv * inv * inv
    }

    // endregion

    // region Preview rendering ---------------------------------------------------

    private fun ensureCachedPath(): Path? {
        val current = cachedPath
        if (current != null && cachedWidth == width && cachedHeight == height) {
            return current
        }
        val built = buildPreviewPath() ?: return null
        cachedPath = built
        cachedWidth = width
        cachedHeight = height
        return built
    }

    private fun buildPreviewPath(): Path? {
        val totalWidth = width.toFloat()
        val totalHeight = height.toFloat()
        if (totalWidth <= 0f || totalHeight <= 0f) return null
        // Match the social-media-app convention: with no amplitude data
        // yet (idle state, before the first sample), render nothing
        // rather than filling the view with a placeholder ribbon. Callers
        // that *want* a baseline visual can supply their own [amplitudes].
        if (amplitudes.isEmpty()) return null
        val step = barWidthPx + barGapPx
        if (step <= 0f) return null
        val barCount = (totalWidth / step).toInt().coerceAtLeast(1)
        val verticalPadding = barWidthPx * 1.5f
        val drawableHeight = totalHeight - verticalPadding * 2f
        if (drawableHeight <= 0f) return null
        val radius = if (barRadiusPx < 0f) barWidthPx / 2f else barRadiusPx

        val path = Path()
        for (i in 0 until barCount) {
            val idx = (i * amplitudes.size / barCount).coerceIn(0, amplitudes.size - 1)
            val amp = amplitudes[idx].coerceIn(0f, 1f)
            val barHeight = (amp * drawableHeight).coerceAtLeast(barWidthPx)
            val x = i * step
            val y = verticalPadding + (drawableHeight - barHeight) / 2f
            tmpRect.set(x, y, x + barWidthPx, y + barHeight)
            path.addRoundRect(tmpRect, radius, radius, Path.Direction.CW)
        }
        return path
    }

    private fun drawPreview(canvas: Canvas) {
        val path = ensureCachedPath() ?: return
        val w = width.toFloat()
        val h = height.toFloat()

        // Pass 1: full unplayed bars.
        canvas.drawPath(path, unplayedPaint)

        val progressX = progressFraction.coerceIn(0f, 1f) * w
        if (progressX <= 0f) return

        // Pass 2: played overlay clipped to the leftmost `progressX`.
        val s2 = canvas.save()
        canvas.clipRect(0f, 0f, progressX, h)
        canvas.drawPath(path, playedPaint)
        canvas.restoreToCount(s2)
    }

    // endregion

    private fun deriveFutureColor(base: Int): Int {
        // Drop alpha to 60% of the base unplayed color so the dotted bars
        // read as "future / not yet recorded" without blending into the
        // background.
        val alpha = (Color.alpha(base) * 0.6f).toInt().coerceIn(0, 255)
        return Color.argb(alpha, Color.red(base), Color.green(base), Color.blue(base))
    }

    companion object {
        private const val MAX_RECORDING_SAMPLES = 4096
        /** Bars on the right that participate in the grow-in taper. */
        private const val ENTRY_WINDOW = 4
        /** Bars on the left that participate in the fade-out taper. */
        private const val EXIT_WINDOW = 4
    }
}
