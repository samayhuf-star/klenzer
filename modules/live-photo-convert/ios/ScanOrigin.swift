import ImageIO
import Photos
import UIKit
import Vision

private final class OriginRequest: @unchecked Sendable {
  private let lock = NSLock()
  private var done = false
  var requestId: PHImageRequestID = PHInvalidImageRequestID

  func claim() -> Bool {
    lock.lock()
    defer { lock.unlock() }
    if done { return false }
    done = true
    return true
  }
}

/// Longest edge of the copy that text is looked for on. Never the full-size picture.
private let originTextMaxPx = 768

/// Reads what one photo's file says about where it came from, for the Forwarded and AI Images folders.
/// - Camera make, model or lens in the file.
/// - AI labels: `needles` are byte patterns (see AI_MARKERS in src/lib/origin-logic.ts) looked for in the
///   first `headBytes` of the original file. The indexes of the ones found come back in `hits`.
/// - Text cover: share of a small copy of the picture that on-device text recognition marks as text.
/// The original is read only if it is already on this iPhone. Nothing is downloaded from iCloud and
/// nothing leaves the device. The request is cancelled at `timeoutMs`, so this always answers.
func requestScanOrigin(id: String, needles: [[Int]], headBytes: Int, wantText: Bool, timeoutMs: Int) async -> [String: Any] {
  guard let asset = PHAsset.fetchAssets(withLocalIdentifiers: [id], options: nil).firstObject,
        asset.mediaType == .image
  else {
    return ["ok": false]
  }
  let options = PHImageRequestOptions()
  options.isNetworkAccessAllowed = false
  options.deliveryMode = .highQualityFormat
  options.isSynchronous = false
  options.version = .original

  let manager = PHImageManager.default()
  let state = OriginRequest()
  let data: Data? = await withCheckedContinuation { (cont: CheckedContinuation<Data?, Never>) in
    state.requestId = manager.requestImageDataAndOrientation(for: asset, options: options) { result, _, _, _ in
      if state.claim() {
        cont.resume(returning: result)
      }
    }
    DispatchQueue.global(qos: .utility).asyncAfter(deadline: .now() + .milliseconds(max(timeoutMs, 1))) {
      if state.claim() {
        manager.cancelImageRequest(state.requestId)
        cont.resume(returning: nil)
      }
    }
  }
  guard let data, !data.isEmpty else {
    return ["ok": false]
  }

  let head = data.prefix(max(headBytes, 1024))
  var hits: [Int] = []
  for (index, needle) in needles.enumerated() {
    let pattern = Data(needle.map { UInt8(truncatingIfNeeded: $0) })
    if !pattern.isEmpty, head.range(of: pattern) != nil {
      hits.append(index)
    }
  }

  var hasCamera = false
  var textRatio: Double? = nil
  var textLines: Int? = nil
  if let source = CGImageSourceCreateWithData(data as CFData, nil) {
    if let props = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any] {
      let tiff = props[kCGImagePropertyTIFFDictionary] as? [CFString: Any]
      let exif = props[kCGImagePropertyExifDictionary] as? [CFString: Any]
      let filled: (Any?) -> Bool = { value in
        guard let text = value as? String else { return false }
        return !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
      }
      hasCamera = filled(tiff?[kCGImagePropertyTIFFMake])
        || filled(tiff?[kCGImagePropertyTIFFModel])
        || filled(exif?[kCGImagePropertyExifLensModel])
        || filled(exif?[kCGImagePropertyExifLensMake])
    }
    if wantText {
      let thumbOptions: [CFString: Any] = [
        kCGImageSourceCreateThumbnailFromImageAlways: true,
        kCGImageSourceCreateThumbnailWithTransform: true,
        kCGImageSourceThumbnailMaxPixelSize: originTextMaxPx,
      ]
      if let small = CGImageSourceCreateThumbnailAtIndex(source, 0, thumbOptions as CFDictionary) {
        if let cover = textCover(small) {
          textRatio = cover.ratio
          textLines = cover.lines
        }
      }
    }
  }

  var out: [String: Any] = ["ok": true, "hasCamera": hasCamera, "hits": hits]
  if let textRatio {
    out["textRatio"] = textRatio
  }
  if let textLines {
    out["textLines"] = textLines
  }
  return out
}

/// Share of the picture (0 to 1) covered by recognised text boxes, and how many lines were found. Nil if recognition fails.
/// Text shorter than `minimumTextHeight` of the picture's height is ignored, and the default (1/32) skips the small
/// print of a document or chat screenshot, so it is lowered here.
private func textCover(_ image: CGImage) -> (ratio: Double, lines: Int)? {
  let request = VNRecognizeTextRequest()
  request.recognitionLevel = .fast
  request.usesLanguageCorrection = false
  request.minimumTextHeight = 0.012
  let handler = VNImageRequestHandler(cgImage: image, options: [:])
  do {
    try handler.perform([request])
  } catch {
    return nil
  }
  guard let observations = request.results else { return (0, 0) }
  var area = 0.0
  for observation in observations {
    let box = observation.boundingBox
    area += Double(box.width) * Double(box.height)
  }
  return (min(1.0, max(0.0, area)), observations.count)
}
