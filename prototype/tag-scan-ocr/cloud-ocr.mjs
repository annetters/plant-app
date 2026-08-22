#!/usr/bin/env node
// PROTOTYPE — throwaway, not production code. See README.md.
// Cloud OCR harness for Tag Scan's OCR-placement decision (Issue #19).
// NOT RUN LIVE as part of this pass — no GOOGLE_CLOUD_VISION_API_KEY was
// available. Scaffolded so finishing the comparison later is one command,
// not a rebuild. Same CLI shape as vision-ocr.swift so output is diffable.
// Usage: GOOGLE_CLOUD_VISION_API_KEY=... node cloud-ocr.mjs <image1> [image2 ...]

import { readFileSync } from "node:fs";

const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY;
const paths = process.argv.slice(2);

if (!apiKey) {
  console.error(
    "GOOGLE_CLOUD_VISION_API_KEY is not set — see README.md for how to get one.",
  );
  process.exit(1);
}

if (paths.length === 0) {
  console.error("Usage: node cloud-ocr.mjs <image1> [image2 ...]");
  process.exit(1);
}

for (const path of paths) {
  console.log(`=== ${path} ===`);
  const content = readFileSync(path).toString("base64");

  const response = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [
          {
            image: { content },
            features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
          },
        ],
      }),
    },
  );

  const data = await response.json();
  const result = data.responses?.[0];
  if (result?.error) {
    console.log(`  [API error: ${result.error.message}]`);
  } else if (result?.fullTextAnnotation?.text) {
    console.log(result.fullTextAnnotation.text.replace(/^/gm, "  "));
  } else {
    console.log("  [no text detected]");
  }
  console.log("");
}
