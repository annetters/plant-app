// Local Expo module for issue #22 (Tag Scan: on-device Vision OCR).
// Deliberately dumb: this module only extracts raw recognized text lines —
// interpreting them into commonName/scientificName/cultivar candidates is
// domain logic that lives (and is unit-tested) in
// packages/domain/src/tagScanCandidate.ts, not here. Keeping this module
// thin means the only untestable-by-CI code is "does Vision read text",
// which was already validated for real in the ADR-0004 prototype
// (prototype/tag-scan-ocr/vision-ocr.swift) — this reuses that exact
// VNRecognizeTextRequest configuration.
import ExpoModulesCore
import Vision

public class TagOcr: Module {
  public func definition() -> ModuleDefinition {
    Name("TagOcr")

    // Expo's AsyncFunction runs on a dedicated background queue by default
    // (see expo-modules-core's AsyncFunctionDefinition — `defaultQueue`),
    // not the main/UI thread, so this synchronous, potentially slow
    // (accurate-mode) Vision call doesn't need its own manual dispatch.
    AsyncFunction("recognizeText") { (uri: String) throws -> [[String: Any]] in
      try TagOcr.recognizeText(atUri: uri)
    }
  }

  private static func recognizeText(atUri uri: String) throws -> [[String: Any]] {
    guard let url = URL(string: uri) else {
      throw TagOcrError.invalidUri(uri)
    }
    guard let (cgImage, orientation) = loadCGImage(from: url) else {
      throw TagOcrError.couldNotDecodeImage
    }

    // Same configuration validated against 8 real nursery tag photos in the
    // ADR-0004 prototype: 8/8 produced usable text.
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = true

    let handler = VNImageRequestHandler(cgImage: cgImage, orientation: orientation, options: [:])
    try handler.perform([request])

    let observations = request.results ?? []
    return observations.compactMap { observation -> [String: Any]? in
      guard let candidate = observation.topCandidates(1).first else { return nil }
      return ["text": candidate.string, "confidence": Double(candidate.confidence)]
    }
  }

  /// Mirrors the prototype's `loadCGImage` — reads EXIF orientation
  /// explicitly, since a photo straight from the camera roll is not
  /// guaranteed to be stored "right side up" pixel-wise.
  private static func loadCGImage(from url: URL) -> (CGImage, CGImagePropertyOrientation)? {
    guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
          let cgImage = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
      return nil
    }

    var orientation: CGImagePropertyOrientation = .up
    if let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
       let rawOrientation = properties[kCGImagePropertyOrientation] as? UInt32,
       let parsed = CGImagePropertyOrientation(rawValue: rawOrientation) {
      orientation = parsed
    }

    return (cgImage, orientation)
  }
}

enum TagOcrError: Error, LocalizedError {
  case invalidUri(String)
  case couldNotDecodeImage

  var errorDescription: String? {
    switch self {
    case .invalidUri(let uri):
      return "Could not parse image URI: \(uri)"
    case .couldNotDecodeImage:
      return "Could not decode the image for OCR."
    }
  }
}
