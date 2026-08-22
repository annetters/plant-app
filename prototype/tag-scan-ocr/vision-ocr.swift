#!/usr/bin/env swift
// PROTOTYPE — throwaway, not production code. See README.md.
// On-device OCR harness for Tag Scan's OCR-placement decision (Issue #19).
// Usage: swift vision-ocr.swift <image1> [image2 ...]

import Vision
import ImageIO
import Foundation

func loadCGImage(from path: String) -> (CGImage, CGImagePropertyOrientation)? {
    var imagePath = path
    if path.lowercased().hasSuffix(".webp") {
        // Vision/ImageIO can't decode webp directly — convert via sips first.
        let tmpPath = NSTemporaryDirectory() + UUID().uuidString + ".png"
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/sips")
        process.arguments = ["-s", "format", "png", path, "--out", tmpPath]
        process.standardOutput = FileHandle.nullDevice
        process.standardError = FileHandle.nullDevice
        do {
            try process.run()
            process.waitUntilExit()
        } catch {
            print("  [error running sips: \(error)]")
            return nil
        }
        imagePath = tmpPath
    }

    guard let source = CGImageSourceCreateWithURL(URL(fileURLWithPath: imagePath) as CFURL, nil),
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

let args = Array(CommandLine.arguments.dropFirst())
if args.isEmpty {
    print("Usage: swift vision-ocr.swift <image1> [image2 ...]")
    exit(1)
}

for path in args {
    print("=== \(path) ===")
    guard let (cgImage, orientation) = loadCGImage(from: path) else {
        print("  [could not decode image]")
        print("")
        continue
    }

    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = true

    let handler = VNImageRequestHandler(cgImage: cgImage, orientation: orientation, options: [:])
    do {
        try handler.perform([request])
        let observations = request.results ?? []
        if observations.isEmpty {
            print("  [no text detected]")
        }
        for observation in observations {
            guard let candidate = observation.topCandidates(1).first else { continue }
            print(String(format: "  %.2f  %@", candidate.confidence, candidate.string))
        }
    } catch {
        print("  [error: \(error)]")
    }
    print("")
}
