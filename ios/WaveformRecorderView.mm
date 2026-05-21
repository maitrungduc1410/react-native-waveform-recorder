#import "WaveformRecorderView.h"

#import <React/RCTConversions.h>

#import <react/renderer/components/WaveformRecorderViewSpec/ComponentDescriptors.h>
#import <react/renderer/components/WaveformRecorderViewSpec/EventEmitters.h>
#import <react/renderer/components/WaveformRecorderViewSpec/Props.h>
#import <react/renderer/components/WaveformRecorderViewSpec/RCTComponentViewHelpers.h>

#import "RCTFabricComponentsPlugins.h"

#if __has_include(<WaveformRecorder/WaveformRecorder-Swift.h>)
#import <WaveformRecorder/WaveformRecorder-Swift.h>
#else
#import "WaveformRecorder-Swift.h"
#endif

using namespace facebook::react;

@implementation WaveformRecorderView {
    WaveformRecorderViewImpl *_impl;
}

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
    return concreteComponentDescriptorProvider<WaveformRecorderViewComponentDescriptor>();
}

- (instancetype)initWithFrame:(CGRect)frame
{
    if (self = [super initWithFrame:frame]) {
        static const auto defaultProps = std::make_shared<const WaveformRecorderViewProps>();
        _props = defaultProps;

        _impl = [[WaveformRecorderViewImpl alloc] init];
        self.contentView = _impl;

        [self wireImplCallbacks];
    }
    return self;
}

- (void)wireImplCallbacks
{
    __weak __typeof__(self) weakSelf = self;

    _impl.onStateChange = ^(NSString *_Nonnull state, NSInteger durationMs) {
        [weakSelf emitOnStateChange:state durationMs:durationMs];
    };
    _impl.onMeter = ^(float amplitude, float peak, float db) {
        [weakSelf emitOnMeter:amplitude peak:peak db:db];
    };
    _impl.onComplete = ^(NSString *_Nonnull uri,
                         NSInteger durationMs,
                         NSString *_Nonnull format,
                         NSString *_Nonnull mimeType,
                         NSInteger sizeBytes,
                         NSInteger sampleRate,
                         NSInteger channels,
                         NSString *_Nonnull samplesCsv,
                         float peakAmplitude) {
        [weakSelf emitOnComplete:uri
                      durationMs:durationMs
                          format:format
                        mimeType:mimeType
                       sizeBytes:sizeBytes
                      sampleRate:sampleRate
                        channels:channels
                      samplesCsv:samplesCsv
                   peakAmplitude:peakAmplitude];
    };
    _impl.onMaxDurationReached = ^{
        [weakSelf emitOnMaxDurationReached];
    };
    _impl.onPermissionDenied = ^{
        [weakSelf emitOnPermissionDenied];
    };
    _impl.onError = ^(NSString *_Nonnull message, NSString *_Nonnull code) {
        [weakSelf emitOnError:message code:code];
    };
    _impl.onSeek = ^(NSInteger positionMs) {
        [weakSelf emitOnSeek:positionMs];
    };
    _impl.onPlaybackTimeUpdate = ^(NSInteger positionMs, NSInteger durationMs) {
        [weakSelf emitOnPlaybackTimeUpdate:positionMs durationMs:durationMs];
    };
    _impl.onSlideProgress = ^(float cancelProgress, float lockProgress) {
        [weakSelf emitOnSlideProgress:cancelProgress lockProgress:lockProgress];
    };
    _impl.onSlideCancel = ^{ [weakSelf emitOnSlideCancel]; };
    _impl.onSlideLock = ^{ [weakSelf emitOnSlideLock]; };
    _impl.onSilenceDetected = ^(NSInteger elapsedMs) {
        [weakSelf emitOnSilenceDetected:elapsedMs];
    };
    _impl.onPcmChunk = ^(NSString *chunk, NSInteger sr, NSInteger ch, NSInteger bps, NSInteger ts) {
        [weakSelf emitOnPcmChunk:chunk sampleRate:sr channels:ch bytesPerSample:bps timestampMs:ts];
    };
}

#pragma mark - Event emitter forwarding

- (std::shared_ptr<const WaveformRecorderViewEventEmitter>)typedEventEmitter
{
    return std::static_pointer_cast<const WaveformRecorderViewEventEmitter>(_eventEmitter);
}

- (void)emitOnStateChange:(NSString *)state durationMs:(NSInteger)durationMs
{
    if (auto e = [self typedEventEmitter]) {
        WaveformRecorderViewEventEmitter::OnStateChange event = {
            .state = std::string([state UTF8String] ?: "idle"),
            .durationMs = static_cast<int>(durationMs),
        };
        e->onStateChange(event);
    }
}

- (void)emitOnMeter:(float)amplitude peak:(float)peak db:(float)db
{
    if (auto e = [self typedEventEmitter]) {
        e->onMeter({
            .amplitude = static_cast<Float>(amplitude),
            .peak = static_cast<Float>(peak),
            .db = static_cast<Float>(db),
        });
    }
}

- (void)emitOnComplete:(NSString *)uri
            durationMs:(NSInteger)durationMs
                format:(NSString *)format
              mimeType:(NSString *)mimeType
             sizeBytes:(NSInteger)sizeBytes
            sampleRate:(NSInteger)sampleRate
              channels:(NSInteger)channels
            samplesCsv:(NSString *)samplesCsv
         peakAmplitude:(float)peakAmplitude
{
    if (auto e = [self typedEventEmitter]) {
        WaveformRecorderViewEventEmitter::OnComplete event = {
            .uri = std::string([uri UTF8String] ?: ""),
            .durationMs = static_cast<int>(durationMs),
            .format = std::string([format UTF8String] ?: "m4a"),
            .mimeType = std::string([mimeType UTF8String] ?: "audio/mp4"),
            .sizeBytes = static_cast<int>(sizeBytes),
            .sampleRate = static_cast<int>(sampleRate),
            .channels = static_cast<int>(channels),
            .samplesCsv = std::string([samplesCsv UTF8String] ?: ""),
            .peakAmplitude = static_cast<Float>(peakAmplitude),
        };
        e->onComplete(event);
    }
}

- (void)emitOnMaxDurationReached
{
    if (auto e = [self typedEventEmitter]) {
        e->onMaxDurationReached({});
    }
}

- (void)emitOnPermissionDenied
{
    if (auto e = [self typedEventEmitter]) {
        e->onPermissionDenied({});
    }
}

- (void)emitOnError:(NSString *)message code:(NSString *)code
{
    if (auto e = [self typedEventEmitter]) {
        WaveformRecorderViewEventEmitter::OnError event = {
            .message = std::string([message UTF8String] ?: ""),
            .code = std::string([code UTF8String] ?: ""),
        };
        e->onError(event);
    }
}

- (void)emitOnSeek:(NSInteger)positionMs
{
    if (auto e = [self typedEventEmitter]) {
        e->onSeek({.positionMs = static_cast<int>(positionMs)});
    }
}

- (void)emitOnPlaybackTimeUpdate:(NSInteger)positionMs durationMs:(NSInteger)durationMs
{
    if (auto e = [self typedEventEmitter]) {
        e->onPlaybackTimeUpdate({
            .positionMs = static_cast<int>(positionMs),
            .durationMs = static_cast<int>(durationMs),
        });
    }
}

- (void)emitOnSlideProgress:(float)cancelProgress lockProgress:(float)lockProgress
{
    if (auto e = [self typedEventEmitter]) {
        e->onSlideProgress({
            .cancelProgress = static_cast<Float>(cancelProgress),
            .lockProgress = static_cast<Float>(lockProgress),
        });
    }
}

- (void)emitOnSlideCancel
{
    if (auto e = [self typedEventEmitter]) {
        e->onSlideCancel({});
    }
}

- (void)emitOnSlideLock
{
    if (auto e = [self typedEventEmitter]) {
        e->onSlideLock({});
    }
}

- (void)emitOnSilenceDetected:(NSInteger)elapsedMs
{
    if (auto e = [self typedEventEmitter]) {
        e->onSilenceDetected({.durationMs = static_cast<int>(elapsedMs)});
    }
}

- (void)emitOnPcmChunk:(NSString *)chunk
            sampleRate:(NSInteger)sampleRate
              channels:(NSInteger)channels
        bytesPerSample:(NSInteger)bytesPerSample
           timestampMs:(NSInteger)timestampMs
{
    if (auto e = [self typedEventEmitter]) {
        e->onPcmChunk({
            .chunk = std::string([chunk UTF8String] ?: ""),
            .sampleRate = static_cast<int>(sampleRate),
            .channels = static_cast<int>(channels),
            .bytesPerSample = static_cast<int>(bytesPerSample),
            .timestampMs = static_cast<int>(timestampMs),
        });
    }
}

#pragma mark - Props

- (void)updateProps:(const Props::Shared &)props oldProps:(const Props::Shared &)oldProps
{
    const auto &oldViewProps =
        *std::static_pointer_cast<WaveformRecorderViewProps const>(_props);
    const auto &newViewProps =
        *std::static_pointer_cast<WaveformRecorderViewProps const>(props);

    if (oldViewProps.outputUri != newViewProps.outputUri) {
        NSString *uri = [NSString stringWithUTF8String:newViewProps.outputUri.c_str()];
        _impl.outputUri = uri ?: @"";
    }
    if (oldViewProps.outputFormat != newViewProps.outputFormat) {
        _impl.outputFormat = outputFormatToString(newViewProps.outputFormat);
    }
    if (oldViewProps.outputSampleRate != newViewProps.outputSampleRate) {
        _impl.outputSampleRate = (NSInteger)newViewProps.outputSampleRate;
    }
    if (oldViewProps.outputChannels != newViewProps.outputChannels) {
        _impl.outputChannels = (NSInteger)newViewProps.outputChannels;
    }
    if (oldViewProps.outputBitrate != newViewProps.outputBitrate) {
        _impl.outputBitrate = (NSInteger)newViewProps.outputBitrate;
    }
    if (oldViewProps.outputQuality != newViewProps.outputQuality) {
        _impl.outputQuality = outputQualityToString(newViewProps.outputQuality);
    }
    if (oldViewProps.maxDurationMs != newViewProps.maxDurationMs) {
        _impl.maxDurationMs = (NSInteger)newViewProps.maxDurationMs;
    }
    if (oldViewProps.minDurationMs != newViewProps.minDurationMs) {
        _impl.minDurationMs = (NSInteger)newViewProps.minDurationMs;
    }

    if (oldViewProps.playedBarColor != newViewProps.playedBarColor) {
        _impl.playedBarColor =
            RCTUIColorFromSharedColor(newViewProps.playedBarColor) ?: [UIColor whiteColor];
    }
    if (oldViewProps.unplayedBarColor != newViewProps.unplayedBarColor) {
        _impl.unplayedBarColor = RCTUIColorFromSharedColor(newViewProps.unplayedBarColor)
            ?: [[UIColor whiteColor] colorWithAlphaComponent:0.5];
    }
    if (oldViewProps.futureBarColor != newViewProps.futureBarColor) {
        _impl.futureBarColor = RCTUIColorFromSharedColor(newViewProps.futureBarColor);
    }

    if (oldViewProps.barWidth != newViewProps.barWidth) {
        _impl.barWidth = (CGFloat)newViewProps.barWidth;
    }
    if (oldViewProps.barGap != newViewProps.barGap) {
        _impl.barGap = (CGFloat)newViewProps.barGap;
    }
    if (oldViewProps.barRadius != newViewProps.barRadius) {
        _impl.barRadius = (CGFloat)newViewProps.barRadius;
    }

    if (oldViewProps.containerBackgroundColor != newViewProps.containerBackgroundColor) {
        _impl.containerBackgroundColor =
            RCTUIColorFromSharedColor(newViewProps.containerBackgroundColor)
            ?: [UIColor colorWithRed:0.204 green:0.471 blue:0.965 alpha:1.0];
    }
    if (oldViewProps.containerBorderRadius != newViewProps.containerBorderRadius) {
        _impl.containerBorderRadius = (CGFloat)newViewProps.containerBorderRadius;
    }
    if (oldViewProps.showBackground != newViewProps.showBackground) {
        _impl.showBackground = newViewProps.showBackground;
    }

    if (oldViewProps.showTime != newViewProps.showTime) {
        _impl.showTime = newViewProps.showTime;
    }
    if (oldViewProps.timeColor != newViewProps.timeColor) {
        _impl.timeColor = RCTUIColorFromSharedColor(newViewProps.timeColor) ?: [UIColor whiteColor];
    }
    if (oldViewProps.timeMode != newViewProps.timeMode) {
        NSString *mode = (newViewProps.timeMode == WaveformRecorderViewTimeMode::CountDown)
            ? @"count-down" : @"count-up";
        _impl.timeMode = mode;
    }

    if (oldViewProps.recordingMode != newViewProps.recordingMode) {
        NSString *m;
        switch (newViewProps.recordingMode) {
            case WaveformRecorderViewRecordingMode::Morph: m = @"morph"; break;
            case WaveformRecorderViewRecordingMode::Centered: m = @"centered"; break;
            default: m = @"scroll"; break;
        }
        _impl.recordingMode = m;
    }
    if (oldViewProps.futureBarStyle != newViewProps.futureBarStyle) {
        NSString *s;
        switch (newViewProps.futureBarStyle) {
            case WaveformRecorderViewFutureBarStyle::Line: s = @"line"; break;
            case WaveformRecorderViewFutureBarStyle::Hidden: s = @"hidden"; break;
            default: s = @"dot"; break;
        }
        _impl.futureBarStyle = s;
    }
    if (oldViewProps.newSampleEntry != newViewProps.newSampleEntry) {
        NSString *s;
        switch (newViewProps.newSampleEntry) {
            case WaveformRecorderViewNewSampleEntry::Fade: s = @"fade"; break;
            case WaveformRecorderViewNewSampleEntry::None: s = @"none"; break;
            default: s = @"grow"; break;
        }
        _impl.newSampleEntry = s;
    }

    if (oldViewProps.meterUpdatesPerSecond != newViewProps.meterUpdatesPerSecond) {
        _impl.meterUpdatesPerSecond = (NSInteger)newViewProps.meterUpdatesPerSecond;
    }
    if (oldViewProps.samplesPerSecond != newViewProps.samplesPerSecond) {
        _impl.samplesPerSecond = (NSInteger)newViewProps.samplesPerSecond;
    }

    // v0.2 preview props
    if (oldViewProps.enablePreview != newViewProps.enablePreview) {
        _impl.enablePreview = newViewProps.enablePreview;
    }
    if (oldViewProps.enableContinueRecording != newViewProps.enableContinueRecording) {
        _impl.enableContinueRecording = newViewProps.enableContinueRecording;
    }
    if (oldViewProps.showPlayButton != newViewProps.showPlayButton) {
        _impl.showPlayButton = newViewProps.showPlayButton;
    }
    if (oldViewProps.playButtonColor != newViewProps.playButtonColor) {
        _impl.playButtonColor =
            RCTUIColorFromSharedColor(newViewProps.playButtonColor) ?: [UIColor whiteColor];
    }

    // v0.3 gesture props
    if (oldViewProps.enableSlideToCancel != newViewProps.enableSlideToCancel) {
        _impl.enableSlideToCancel = newViewProps.enableSlideToCancel;
    }
    if (oldViewProps.slideToCancelThresholdDp != newViewProps.slideToCancelThresholdDp) {
        _impl.slideToCancelThresholdDp = (CGFloat)newViewProps.slideToCancelThresholdDp;
    }
    if (oldViewProps.enableSlideToLock != newViewProps.enableSlideToLock) {
        _impl.enableSlideToLock = newViewProps.enableSlideToLock;
    }
    if (oldViewProps.slideToLockThresholdDp != newViewProps.slideToLockThresholdDp) {
        _impl.slideToLockThresholdDp = (CGFloat)newViewProps.slideToLockThresholdDp;
    }

    // v0.3 silence detection props
    if (oldViewProps.silenceThresholdDb != newViewProps.silenceThresholdDb) {
        _impl.silenceThresholdDb = newViewProps.silenceThresholdDb;
    }
    if (oldViewProps.silenceTimeoutMs != newViewProps.silenceTimeoutMs) {
        _impl.silenceTimeoutMs = (NSInteger)newViewProps.silenceTimeoutMs;
    }
    if (oldViewProps.autoStopOnSilence != newViewProps.autoStopOnSilence) {
        _impl.autoStopOnSilence = newViewProps.autoStopOnSilence;
    }

    // v1.0 raw-PCM streaming props
    if (oldViewProps.enablePcmStream != newViewProps.enablePcmStream) {
        _impl.enablePcmStream = newViewProps.enablePcmStream;
    }
    if (oldViewProps.pcmChunkMs != newViewProps.pcmChunkMs) {
        _impl.pcmChunkMs = (NSInteger)newViewProps.pcmChunkMs;
    }

    // v1.0 background-recording props
    if (oldViewProps.backgroundRecording != newViewProps.backgroundRecording) {
        _impl.backgroundRecording = newViewProps.backgroundRecording;
    }
    if (oldViewProps.backgroundNotificationTitle != newViewProps.backgroundNotificationTitle) {
        NSString *title = [NSString stringWithUTF8String:newViewProps.backgroundNotificationTitle.c_str()];
        _impl.backgroundNotificationTitle = title.length > 0 ? title : @"Recording";
    }
    if (oldViewProps.backgroundNotificationBody != newViewProps.backgroundNotificationBody) {
        NSString *body = [NSString stringWithUTF8String:newViewProps.backgroundNotificationBody.c_str()];
        _impl.backgroundNotificationBody = body.length > 0 ? body : @"Microphone recording in progress.";
    }

    if (oldViewProps.controlledState != newViewProps.controlledState) {
        _impl.controlledState = controlledStateToString(newViewProps.controlledState);
    }

    [super updateProps:props oldProps:oldProps];
}

#pragma mark - Codegen enum helpers

static NSString *outputFormatToString(WaveformRecorderViewOutputFormat value) {
    switch (value) {
        case WaveformRecorderViewOutputFormat::Aac: return @"aac";
        case WaveformRecorderViewOutputFormat::Wav: return @"wav";
        case WaveformRecorderViewOutputFormat::Opus: return @"opus";
        default: return @"m4a";
    }
}

static NSString *outputQualityToString(WaveformRecorderViewOutputQuality value) {
    switch (value) {
        case WaveformRecorderViewOutputQuality::Low: return @"low";
        case WaveformRecorderViewOutputQuality::Medium: return @"medium";
        default: return @"high";
    }
}

static NSString *controlledStateToString(WaveformRecorderViewControlledState value) {
    switch (value) {
        case WaveformRecorderViewControlledState::Idle: return @"idle";
        case WaveformRecorderViewControlledState::Recording: return @"recording";
        case WaveformRecorderViewControlledState::Paused: return @"paused";
        case WaveformRecorderViewControlledState::Preview: return @"preview";
        case WaveformRecorderViewControlledState::Stopped: return @"stopped";
        default: return @"auto";
    }
}

#pragma mark - Commands

- (void)handleCommand:(const NSString *)commandName args:(const NSArray *)args
{
    if ([commandName isEqualToString:@"start"]) {
        [_impl startCommand];
    } else if ([commandName isEqualToString:@"pause"]) {
        [_impl pauseCommand];
    } else if ([commandName isEqualToString:@"resume"]) {
        [_impl resumeCommand];
    } else if ([commandName isEqualToString:@"stop"]) {
        [_impl stopCommand];
    } else if ([commandName isEqualToString:@"cancel"]) {
        [_impl cancelCommand];
    } else if ([commandName isEqualToString:@"enterPreview"]) {
        [_impl enterPreviewCommand];
    } else if ([commandName isEqualToString:@"exitPreview"]) {
        [_impl exitPreviewCommand];
    } else if ([commandName isEqualToString:@"togglePreviewPlayback"]) {
        [_impl togglePreviewPlaybackCommand];
    } else if ([commandName isEqualToString:@"seekPreview"] && args.count >= 1) {
        NSInteger ms = [args[0] integerValue];
        [_impl seekPreviewCommand:ms];
    }
}

- (void)prepareForRecycle
{
    [_impl tearDown];
    [super prepareForRecycle];
    static const auto defaultProps = std::make_shared<const WaveformRecorderViewProps>();
    _props = defaultProps;
}

@end
