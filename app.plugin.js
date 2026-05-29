// Entry point Expo looks for when a project references this package by name in
// its `plugins` array. Delegates to the real implementation under plugin/.
module.exports = require('./plugin/withWaveformRecorder');
