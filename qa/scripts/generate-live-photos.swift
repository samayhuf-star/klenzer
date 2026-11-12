#!/usr/bin/env swift
// Generate a few paired still+MOV Live Photos for simulator seeding.
// simctl addmedia discovers a Live Photo when the still and movie share
// Apple's ContentIdentifier and are passed in the same addmedia invocation.
//
// This script is meant to run on macOS (ImageIO + AVFoundation). It is a
// probe + fixture generator; success is confirmed only after addmedia + a
// Photos-library check on a booted simulator.
import AVFoundation
import CoreGraphics
import CoreImage
import Foundation
import ImageIO
import UniformTypeIdentifiers

let outDir = URL(fileURLWithPath: CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "qa/fixtures/live")
let count = CommandLine.arguments.count > 2 ? (Int(CommandLine.arguments[2]) ?? 3) : 3
try FileManager.default.createDirectory(at: outDir, withIntermediateDirectories: true)

func appleDate(_ date: Date) -> String {
    let f = DateFormatter()
    f.dateFormat = "yyyy:MM:dd HH:mm:ss"
    f.locale = Locale(identifier: "en_US_POSIX")
    f.timeZone = TimeZone(secondsFromGMT: 0)
    return f.string(from: date)
}

func makeCGImage(index: Int, width: Int = 640, height: Int = 480) -> CGImage {
    let colorSpace = CGColorSpaceCreateDeviceRGB()
    let ctx = CGContext(
        data: nil,
        width: width,
        height: height,
        bitsPerComponent: 8,
        bytesPerRow: width * 4,
        space: colorSpace,
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    )!
    let r = CGFloat((40 + index * 37) % 200) / 255
    let g = CGFloat((80 + index * 19) % 200) / 255
    let b = CGFloat((120 + index * 53) % 200) / 255
    ctx.setFillColor(CGColor(red: r, green: g, blue: b, alpha: 1))
    ctx.fill(CGRect(x: 0, y: 0, width: width, height: height))
    ctx.setFillColor(CGColor(red: 1, green: 1, blue: 1, alpha: 1))
    ctx.fillEllipse(in: CGRect(x: 80, y: 60, width: 200, height: 200))
    ctx.setFillColor(CGColor(red: 0, green: 0, blue: 0, alpha: 1))
    ctx.fill(CGRect(x: 40, y: 40, width: 160, height: 40))
    return ctx.makeImage()!
}

func writeStill(url: URL, image: CGImage, contentID: String, date: Date, lat: Double, lon: Double) throws {
    let type = UTType.heic.identifier as CFString
    guard let dest = CGImageDestinationCreateWithURL(url as CFURL, type, 1, nil) else {
        throw NSError(domain: "livegen", code: 1, userInfo: [NSLocalizedDescriptionKey: "could not create HEIC destination"])
    }
    let exif: [CFString: Any] = [
        kCGImagePropertyExifDateTimeOriginal: appleDate(date),
        kCGImagePropertyExifDateTimeDigitized: appleDate(date),
    ]
    let gps: [CFString: Any] = [
        kCGImagePropertyGPSLatitude: abs(lat),
        kCGImagePropertyGPSLatitudeRef: lat >= 0 ? "N" : "S",
        kCGImagePropertyGPSLongitude: abs(lon),
        kCGImagePropertyGPSLongitudeRef: lon >= 0 ? "E" : "W",
    ]
    // Maker note key "17" (0x11) is Apple's ContentIdentifier.
    let apple: [String: Any] = ["17": contentID]
    let props: [CFString: Any] = [
        kCGImagePropertyExifDictionary: exif,
        kCGImagePropertyGPSDictionary: gps,
        kCGImagePropertyMakerAppleDictionary: apple,
        kCGImagePropertyTIFFDictionary: [kCGImagePropertyTIFFDateTime: appleDate(date)],
    ]
    CGImageDestinationAddImage(dest, image, props as CFDictionary)
    guard CGImageDestinationFinalize(dest) else {
        throw NSError(domain: "livegen", code: 2, userInfo: [NSLocalizedDescriptionKey: "HEIC finalize failed"])
    }
}

func writePairedMovie(url: URL, image: CGImage, contentID: String, duration: TimeInterval = 3.0) throws {
    if FileManager.default.fileExists(atPath: url.path) {
        try FileManager.default.removeItem(at: url)
    }
    let writer = try AVAssetWriter(outputURL: url, fileType: .mov)
    let settings: [String: Any] = [
        AVVideoCodecKey: AVVideoCodecType.h264,
        AVVideoWidthKey: image.width,
        AVVideoHeightKey: image.height,
    ]
    let video = AVAssetWriterInput(mediaType: .video, outputSettings: settings)
    video.expectsMediaDataInRealTime = false
    let adaptor = AVAssetWriterInputPixelBufferAdaptor(
        assetWriterInput: video,
        sourcePixelBufferAttributes: [
            kCVPixelBufferPixelFormatTypeKey as String: Int(kCVPixelFormatType_32ARGB),
            kCVPixelBufferWidthKey as String: image.width,
            kCVPixelBufferHeightKey as String: image.height,
        ]
    )
    writer.add(video)

    // Content identifier metadata (pairs the movie with the still).
    let idItem = AVMutableMetadataItem()
    idItem.key = AVMetadataKey.quickTimeMetadataContentIdentifier as NSString
    idItem.keySpace = .quickTimeMetadata
    idItem.value = contentID as NSString
    idItem.dataType = kCMMetadataBaseDataType_UTF8 as String
    writer.metadata = [idItem]

    // Timed metadata track marking the still-image time (value is always -1;
    // the sample time is what Photos uses).
    let stillSpec = AVTimedMetadataGroup.metadataSpecifications(
        withIdentifier: AVMetadataIdentifier.quickTimeMetadataStillImageTime,
        sufficientFor: .quickTimeMetadata
    )
    let stillInput = AVAssetWriterInput(mediaType: .metadata, outputSettings: nil)
    let stillAdaptor = AVAssetWriterInputMetadataAdaptor(assetWriterInput: stillInput)
    writer.add(stillInput)

    writer.startWriting()
    writer.startSession(atSourceTime: .zero)

    // Draw a few nearly-identical frames so there is real motion data.
    let frameCount = 15
    let frameDuration = CMTime(value: 1, timescale: 5) // 5 fps, 3 seconds
    for i in 0..<frameCount {
        let time = CMTimeMultiply(frameDuration, multiplier: Int32(i))
        while !video.isReadyForMoreMediaData { Thread.sleep(forTimeInterval: 0.01) }
        var pb: CVPixelBuffer?
        CVPixelBufferCreate(
            kCFAllocatorDefault,
            image.width,
            image.height,
            kCVPixelFormatType_32ARGB,
            nil,
            &pb
        )
        guard let buffer = pb else { throw NSError(domain: "livegen", code: 3) }
        CVPixelBufferLockBaseAddress(buffer, [])
        let ctx = CGContext(
            data: CVPixelBufferGetBaseAddress(buffer),
            width: image.width,
            height: image.height,
            bitsPerComponent: 8,
            bytesPerRow: CVPixelBufferGetBytesPerRow(buffer),
            space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGImageAlphaInfo.noneSkipFirst.rawValue
        )!
        ctx.draw(image, in: CGRect(x: 0, y: 0, width: image.width, height: image.height))
        // Slight motion: a moving bar, so the paired video is non-trivial.
        ctx.setFillColor(CGColor(red: 1, green: 0.8, blue: 0, alpha: 1))
        ctx.fill(CGRect(x: 20 + i * 8, y: 200, width: 40, height: 12))
        CVPixelBufferUnlockBaseAddress(buffer, [])
        adaptor.append(buffer, withPresentationTime: time)
    }
    video.markAsFinished()

    // still-image-time sample at the midpoint.
    while !stillInput.isReadyForMoreMediaData { Thread.sleep(forTimeInterval: 0.01) }
    let mid = CMTimeMultiply(frameDuration, multiplier: Int32(frameCount / 2))
    let stillItem = AVMutableMetadataItem()
    stillItem.key = AVMetadataKey.quickTimeMetadataStillImageTime as NSString? ?? "com.apple.quicktime.still-image-time" as NSString
    stillItem.keySpace = .quickTimeMetadata
    stillItem.value = -1 as NSNumber
    stillItem.dataType = kCMMetadataBaseDataType_SInt8 as String
    let group = AVTimedMetadataGroup(items: [stillItem], timeRange: CMTimeRange(start: mid, duration: frameDuration))
    stillAdaptor.append(group)
    stillInput.markAsFinished()

    writer.endSession(atSourceTime: CMTimeMultiply(frameDuration, multiplier: Int32(frameCount)))
    let sem = DispatchSemaphore(value: 0)
    var fail: Error?
    writer.finishWriting { fail = writer.error; sem.signal() }
    sem.wait()
    if let fail { throw fail }
    if writer.status != .completed {
        throw NSError(domain: "livegen", code: 4, userInfo: [NSLocalizedDescriptionKey: "writer status \(writer.status.rawValue)"])
    }
    _ = stillSpec
}

var manifest: [[String: Any]] = []
for i in 0..<count {
    let id = UUID().uuidString
    let date = Date(timeIntervalSince1970: 1_704_067_200 + Double(i * 3600)) // 2024-01-01 UTC + i hours
    let lat = 28.6508 + Double(i) * 0.001
    let lon = 77.2773 + Double(i) * 0.001
    let base = String(format: "LIVE_%03d", i)
    let heic = outDir.appendingPathComponent("\(base).HEIC")
    let mov = outDir.appendingPathComponent("\(base).MOV")
    let image = makeCGImage(index: i)
    try writeStill(url: heic, image: image, contentID: id, date: date, lat: lat, lon: lon)
    try writePairedMovie(url: mov, image: image, contentID: id)
    manifest.append([
        "id": id,
        "heic": heic.path,
        "mov": mov.path,
        "creationDate": appleDate(date),
        "latitude": lat,
        "longitude": lon,
        "favorite": i == 0,
        "album": "Klenzer QA",
    ])
    fputs("wrote \(heic.lastPathComponent) + \(mov.lastPathComponent) id=\(id)\n", stderr)
}

let manURL = outDir.appendingPathComponent("manifest.json")
let data = try JSONSerialization.data(withJSONObject: manifest, options: [.prettyPrinted])
try data.write(to: manURL)
print(outDir.path)
