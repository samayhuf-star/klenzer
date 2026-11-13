import ExpoModulesCore
import Photos

private let chunkSize = 250

public class LivePhotoConvertModule: Module {
  public func definition() -> ModuleDefinition {
    Name("LivePhotoConvert")

    AsyncFunction("pairedVideoSizes") { (ids: [String]) -> [[String: Any]] in
      var rows: [[String: Any]] = []
      let assets = PHAsset.fetchAssets(withLocalIdentifiers: ids, options: nil)
      assets.enumerateObjects { asset, _, _ in
        var bytes: Int64 = 0
        let resources = PHAssetResource.assetResources(for: asset)
        for resource in resources where resource.type == .pairedVideo {
          if let n = resource.value(forKey: "fileSize") as? NSNumber {
            bytes += n.int64Value
          }
        }
        rows.append(["id": asset.localIdentifier, "videoBytes": NSNumber(value: bytes)])
      }
      return rows
    }

    AsyncFunction("convertToStills") { (ids: [String]) -> [String: Any] in
      try await convertAll(ids: ids)
    }

    AsyncFunction("scanThumb") { (id: String, targetPx: Int, timeoutMs: Int) -> String? in
      await requestScanThumb(id: id, targetPx: targetPx, timeoutMs: timeoutMs)
    }
  }
}

private struct Prepared {
  let asset: PHAsset
  let photoURL: URL
  let videoBytes: Int64
  let albumIds: [String]
}

@MainActor
private func convertAll(ids: [String]) async throws -> [String: Any] {
  var converted: [String] = []
  var created: [String] = []
  var skipped: [String] = []
  var pending = ids
  var saved: Int64 = 0

  let unique = Array(NSOrderedSet(array: ids)) as? [String] ?? ids
  var i = 0
  while i < unique.count {
    let slice = Array(unique[i..<min(i + chunkSize, unique.count)])
    let prepared = prepare(ids: slice)
    skipped.append(contentsOf: prepared.skipped)

    if prepared.items.isEmpty {
      pending = Array(unique[(i + slice.count)...])
      i += slice.count
      continue
    }

    do {
      let result = try await applyChunk(prepared.items)
      converted.append(contentsOf: result.converted)
      created.append(contentsOf: result.created)
      saved += result.saved
      pending = Array(unique[(i + slice.count)...])
    } catch {
      // This chunk did not commit, so originals whose stills were not created stay.
      pending = Array(unique[i...])
      cleanup(prepared.items)
      return pack(converted: converted, created: created, skipped: skipped, pending: pending, saved: saved)
    }
    cleanup(prepared.items)
    i += slice.count
  }

  return pack(converted: converted, created: created, skipped: skipped, pending: pending, saved: saved)
}

private func pack(converted: [String], created: [String], skipped: [String], pending: [String], saved: Int64) -> [String: Any] {
  [
    "convertedIds": converted,
    "createdIds": created,
    "skippedIds": skipped,
    "pendingIds": pending,
    "videoBytesSaved": NSNumber(value: saved),
  ]
}

private func prepare(ids: [String]) -> (items: [Prepared], skipped: [String]) {
  var items: [Prepared] = []
  var skipped: [String] = []
  let fm = FileManager.default
  let dir = fm.temporaryDirectory.appendingPathComponent("klenzer-live-convert", isDirectory: true)
  try? fm.createDirectory(at: dir, withIntermediateDirectories: true)

  let assets = PHAsset.fetchAssets(withLocalIdentifiers: ids, options: nil)
  var seen = Set<String>()
  assets.enumerateObjects { asset, _, _ in
    seen.insert(asset.localIdentifier)
    guard asset.mediaSubtypes.contains(.photoLive) else {
      skipped.append(asset.localIdentifier)
      return
    }
    let resources = PHAssetResource.assetResources(for: asset)
    guard let photo = resources.first(where: { $0.type == .photo }) else {
      skipped.append(asset.localIdentifier)
      return
    }
    var videoBytes: Int64 = 0
    for resource in resources where resource.type == .pairedVideo {
      if let n = resource.value(forKey: "fileSize") as? NSNumber {
        videoBytes += n.int64Value
      }
    }
    let ext = (photo.originalFilename as NSString).pathExtension.isEmpty ? "JPG" : (photo.originalFilename as NSString).pathExtension
    let url = dir.appendingPathComponent("\(UUID().uuidString).\(ext)")
    let sem = DispatchSemaphore(value: 0)
    var writeError: Error?
    PHAssetResourceManager.default().writeData(for: photo, toFile: url, options: nil) { err in
      writeError = err
      sem.signal()
    }
    sem.wait()
    if writeError != nil || !fm.fileExists(atPath: url.path) {
      skipped.append(asset.localIdentifier)
      try? fm.removeItem(at: url)
      return
    }
    var albumIds: [String] = []
    let albums = PHAssetCollection.fetchAssetCollectionsContaining(asset, with: .album, options: nil)
    albums.enumerateObjects { collection, _, _ in
      albumIds.append(collection.localIdentifier)
    }
    items.append(Prepared(asset: asset, photoURL: url, videoBytes: videoBytes, albumIds: albumIds))
  }
  for id in ids where !seen.contains(id) {
    skipped.append(id)
  }
  return (items, skipped)
}

private func applyChunk(_ items: [Prepared]) async throws -> (converted: [String], created: [String], saved: Int64) {
  let createdBox = NSMutableArray()
  try await withCheckedThrowingContinuation { (cont: CheckedContinuation<Void, Error>) in
    PHPhotoLibrary.shared().performChanges({
      var placeholders: [String: PHObjectPlaceholder] = [:]
      for item in items {
        let req = PHAssetCreationRequest.forAsset()
        let opts = PHAssetResourceCreationOptions()
        opts.shouldMoveFile = false
        req.addResource(with: .photo, fileURL: item.photoURL, options: opts)
        req.creationDate = item.asset.creationDate
        req.location = item.asset.location
        req.isFavorite = item.asset.isFavorite
        if let placeholder = req.placeholderForCreatedAsset {
          placeholders[item.asset.localIdentifier] = placeholder
          createdBox.add(placeholder.localIdentifier)
        }
      }

      // Album membership for the new stills. Only user albums can be mutated.
      var byAlbum: [String: [PHObjectPlaceholder]] = [:]
      for item in items {
        guard let placeholder = placeholders[item.asset.localIdentifier] else { continue }
        for albumId in item.albumIds {
          byAlbum[albumId, default: []].append(placeholder)
        }
      }
      if !byAlbum.isEmpty {
        let collections = PHAssetCollection.fetchAssetCollections(
          withLocalIdentifiers: Array(byAlbum.keys),
          options: nil
        )
        collections.enumerateObjects { collection, _, _ in
          guard let add = byAlbum[collection.localIdentifier],
                let change = PHAssetCollectionChangeRequest(for: collection) else { return }
          change.addAssets(add as NSFastEnumeration)
        }
      }

      // Delete originals only in the same block, and only those we created a still for.
      let originals = items.compactMap { placeholders[$0.asset.localIdentifier] != nil ? $0.asset : nil }
      if !originals.isEmpty {
        PHAssetChangeRequest.deleteAssets(originals as NSFastEnumeration)
      }
    }, completionHandler: { ok, error in
      if let error {
        cont.resume(throwing: error)
      } else if !ok {
        cont.resume(throwing: NSError(domain: "LivePhotoConvert", code: 1, userInfo: [NSLocalizedDescriptionKey: "The convert could not be completed."]))
      } else {
        cont.resume()
      }
    })
  }

  // After a successful commit, fetch the new identifiers by creation date + favourite is not unique enough.
  // The performChanges API does not return placeholders to the completion handler. We report the source ids
  // as converted; created ids are resolved below by fetching assets created just now is unreliable.
  // Placeholder localIdentifiers are valid after a successful commit.
  // We cannot access them after the block, so createdIds stays empty unless we re-fetch.
  // Callers treat convertedIds (the originals that left the library) as the source of truth.
  return (
    converted: items.map { $0.asset.localIdentifier },
    created: createdBox.compactMap { $0 as? String },
    saved: items.reduce(Int64(0)) { $0 + $1.videoBytes }
  )
}

private func cleanup(_ items: [Prepared]) {
  for item in items {
    try? FileManager.default.removeItem(at: item.photoURL)
  }
}
