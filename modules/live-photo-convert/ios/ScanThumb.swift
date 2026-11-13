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

/// Side of the grayscale grid that dHash and blur are computed on. Matches src/lib/image-hash.ts.
private let analyzeGrid = 32
private let dhashW = 9
private let dhashH = 8

/// Duplicate, Similar and Blurry analysis done natively from a small Photos thumbnail.
/// No full-size original, no temp file and no image-manipulator round trip: Photos hands back a
/// thumbnail of at most `scanThumbMaxPx`, it is drawn into a 32×32 grayscale grid, and dHash and
/// Laplacian variance are computed here with the same math as src/lib/image-hash.ts.
/// iCloud may supply the thumbnail when the original is not on this iPhone. The request is
/// cancelled at `timeoutMs`, so this always answers. Returns ["ok": false] on any failure.
func requestScanAnalyze(id: String, targetPx: Int, timeoutMs: Int) async -> [String: Any] {
  guard let asset = PHAsset.fetchAssets(withLocalIdentifiers: [id], options: nil).firstObject else {
    return ["ok": false]
  }
  let px = CGFloat(min(max(targetPx, 32), scanThumbMaxPx))
  let options = PHImageRequestOptions()
  options.isNetworkAccessAllowed = true
  options.deliveryMode = .highQualityFormat
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

  guard let image, let gray = grayGrid(image) else {
    NSLog("[klenzer-scan] analyze skipped (no thumbnail within %ld ms)", timeoutMs)
    return ["ok": false]
  }
  return [
    "ok": true,
    "dhash": dHash(gray, w: analyzeGrid, h: analyzeGrid),
    "blur": laplacianVariance(gray, w: analyzeGrid, h: analyzeGrid),
  ]
}

/// Draw the image stretched into a 32×32 RGBA grid and convert to luma (0.299 R + 0.587 G + 0.114 B).
private func grayGrid(_ image: UIImage) -> [Double]? {
  let side = analyzeGrid
  let bytesPerRow = side * 4
  var pixels = [UInt8](repeating: 0, count: side * bytesPerRow)
  let drawn: Bool = pixels.withUnsafeMutableBytes { raw -> Bool in
    guard let base = raw.baseAddress,
          let ctx = CGContext(
            data: base,
            width: side,
            height: side,
            bitsPerComponent: 8,
            bytesPerRow: bytesPerRow,
            space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue
          )
    else { return false }
    ctx.interpolationQuality = .medium
    // UIKit drawing honors the image orientation; flip so row 0 is the top of the photo.
    ctx.translateBy(x: 0, y: CGFloat(side))
    ctx.scaleBy(x: 1, y: -1)
    UIGraphicsPushContext(ctx)
    image.draw(in: CGRect(x: 0, y: 0, width: side, height: side))
    UIGraphicsPopContext()
    return true
  }
  if !drawn { return nil }
  var gray = [Double](repeating: 0, count: side * side)
  for i in 0..<(side * side) {
    let o = i * 4
    gray[i] = Double(pixels[o]) * 0.299 + Double(pixels[o + 1]) * 0.587 + Double(pixels[o + 2]) * 0.114
  }
  return gray
}

private func dHash(_ gray: [Double], w: Int, h: Int) -> String {
  var small = [Double](repeating: 0, count: dhashW * dhashH)
  for y in 0..<dhashH {
    for x in 0..<dhashW {
      let sx = min(w - 1, Int(floor((Double(x) + 0.5) * Double(w) / Double(dhashW))))
      let sy = min(h - 1, Int(floor((Double(y) + 0.5) * Double(h) / Double(dhashH))))
      small[y * dhashW + x] = gray[sy * w + sx]
    }
  }
  var bits: [Int] = []
  for y in 0..<dhashH {
    for x in 0..<(dhashW - 1) {
      bits.append(small[y * dhashW + x] > small[y * dhashW + x + 1] ? 1 : 0)
    }
  }
  let digits = Array("0123456789abcdef")
  var hex = ""
  var i = 0
  while i < bits.count {
    let v = bits[i] * 8 + bits[i + 1] * 4 + bits[i + 2] * 2 + bits[i + 3]
    hex.append(digits[v])
    i += 4
  }
  return hex
}

private func laplacianVariance(_ gray: [Double], w: Int, h: Int) -> Double {
  var sum = 0.0
  var sumSq = 0.0
  var c = 0.0
  for y in 1..<(h - 1) {
    for x in 1..<(w - 1) {
      let i = y * w + x
      let v = gray[i - w] + gray[i - 1] + gray[i + 1] + gray[i + w] - 4 * gray[i]
      sum += v
      sumSq += v * v
      c += 1
    }
  }
  if c == 0 { return 0 }
  let mean = sum / c
  return sumSq / c - mean * mean
}
