# Live Photo seed probe

Checked whether `xcrun simctl addmedia` imports a paired HEIC+MOV as a single Live Photo (needed before any Convert to still test can be marked as run).

qa/scripts/generate-live-photos.swift:104:32: error: type 'AVMetadataKey' has no member 'quickTimeMetadataContentIdentifier'
102 |     // Content identifier metadata (pairs the movie with the still).
103 |     let idItem = AVMutableMetadataItem()
104 |     idItem.key = AVMetadataKey.quickTimeMetadataContentIdentifier as NSString
    |                                `- error: type 'AVMetadataKey' has no member 'quickTimeMetadataContentIdentifier'
105 |     idItem.keySpace = .quickTimeMetadata
106 |     idItem.value = contentID as NSString

qa/scripts/generate-live-photos.swift:112:42: error: type 'AVTimedMetadataGroup' has no member 'metadataSpecifications'
110 |     // Timed metadata track marking the still-image time (value is always -1;
111 |     // the sample time is what Photos uses).
112 |     let stillSpec = AVTimedMetadataGroup.metadataSpecifications(
    |                                          `- error: type 'AVTimedMetadataGroup' has no member 'metadataSpecifications'
113 |         withIdentifier: AVMetadataIdentifier.quickTimeMetadataStillImageTime,
114 |         sufficientFor: .quickTimeMetadata

qa/scripts/generate-live-photos.swift:113:46: error: type 'AVMetadataIdentifier' has no member 'quickTimeMetadataStillImageTime'
111 |     // the sample time is what Photos uses).
112 |     let stillSpec = AVTimedMetadataGroup.metadataSpecifications(
113 |         withIdentifier: AVMetadataIdentifier.quickTimeMetadataStillImageTime,
    |                                              `- error: type 'AVMetadataIdentifier' has no member 'quickTimeMetadataStillImageTime'
114 |         sufficientFor: .quickTimeMetadata
115 |     )

qa/scripts/generate-live-photos.swift:114:25: error: cannot infer contextual base in reference to member 'quickTimeMetadata'
112 |     let stillSpec = AVTimedMetadataGroup.metadataSpecifications(
113 |         withIdentifier: AVMetadataIdentifier.quickTimeMetadataStillImageTime,
114 |         sufficientFor: .quickTimeMetadata
    |                         `- error: cannot infer contextual base in reference to member 'quickTimeMetadata'
115 |     )
116 |     let stillInput = AVAssetWriterInput(mediaType: .metadata, outputSettings: nil)

qa/scripts/generate-live-photos.swift:162:35: error: type 'AVMetadataKey' has no member 'quickTimeMetadataStillImageTime'
160 |     let mid = CMTimeMultiply(frameDuration, multiplier: Int32(frameCount / 2))
161 |     let stillItem = AVMutableMetadataItem()
162 |     stillItem.key = AVMetadataKey.quickTimeMetadataStillImageTime as NSString? ?? "com.apple.quicktime.still-image-time" as NSString
    |                                   `- error: type 'AVMetadataKey' has no member 'quickTimeMetadataStillImageTime'
163 |     stillItem.keySpace = .quickTimeMetadata
164 |     stillItem.value = -1 as NSNumber

**Result: could not generate fixture files** (swift exit 1). Convert to still cannot be tested on this run.
