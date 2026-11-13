import Photos
import UIKit

/// Largest edge, in points, the scan may ask Photos for. Never the full-size original.
let scanThumbMaxPx = 300

private final class ThumbRequest: @unchecked Sendable {
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

/// Small thumbnail for Duplicate, Similar and Blurry hashing. iCloud may supply the thumbnail
/// when the original is not on this iPhone. Returns a temp JPEG path, or nil on failure or timeout.
func requestScanThumb(id: String, targetPx: Int, timeoutMs: Int) async -> String? {
  guard let asset = PHAsset.fetchAssets(withLocalIdentifiers: [id], options: nil).firstObject else {
    return nil
  }
  let px = CGFloat(min(max(targetPx, 32), scanThumbMaxPx))
  let options = PHImageRequestOptions()
  options.isNetworkAccessAllowed = true
  options.deliveryMode = .fastFormat
  options.resizeMode = .fast
  options.isSynchronous = false
  options.version = .current

  let manager = PHImageManager.default()
  let state = ThumbRequest()
  let image: UIImage? = await withCheckedContinuation { (cont: CheckedContinuation<UIImage?, Never>) in
    state.requestId = manager.requestImage(
      for: asset,
      targetSize: CGSize(width: px, height: px),
      contentMode: .aspectFit,
      options: options
    ) { result, _ in
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

  guard let image, let data = image.jpegData(compressionQuality: 0.9) else { return nil }
  let dir = FileManager.default.temporaryDirectory.appendingPathComponent("klenzer-scan-thumbs", isDirectory: true)
  try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
  let url = dir.appendingPathComponent("\(UUID().uuidString).jpg")
  do {
    try data.write(to: url, options: .atomic)
    return url.absoluteString
  } catch {
    return nil
  }
}
