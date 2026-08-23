import { describe, expect, it } from "vitest";
import {
  manualEntryAdapter,
  resolveCommonName,
  reviewTagOcrCandidates,
  type SpeciesNameSummary,
} from "./tagScanCandidate.js";

describe("manualEntryAdapter", () => {
  it("is the manual-entry source", () => {
    expect(manualEntryAdapter.source).toBe("manual-entry");
  });

  it("never proposes any candidates of its own — it's the complete fallback, not a partial one", async () => {
    await expect(manualEntryAdapter.recognize({ uri: "file:///tag.jpg" })).resolves.toEqual([]);
  });
});

describe("reviewTagOcrCandidates", () => {
  it("surfaces an empty candidate list as needing confirmation, not as a failure", () => {
    const review = reviewTagOcrCandidates("manual-entry", []);
    expect(review).toEqual({ status: "needs-confirmation", source: "manual-entry", candidates: [] });
  });

  it("surfaces a bad OCR result verbatim, still gated behind confirmation — never auto-applied", () => {
    const badCandidate = { commonName: "###garbled###", scientificName: "" };
    const review = reviewTagOcrCandidates("vision-ocr", [badCandidate]);
    expect(review.status).toBe("needs-confirmation");
    expect(review.candidates).toEqual([badCandidate]);
  });

  it("always returns needs-confirmation, regardless of source or candidate count — there is no auto-applied status to return", () => {
    const many = reviewTagOcrCandidates("vision-ocr", [
      { commonName: "Bee balm", scientificName: "Monarda didyma" },
      { commonName: "Bee balm", scientificName: "Monarda fistulosa" },
    ]);
    expect(many.status).toBe("needs-confirmation");
  });
});

const digitalis: SpeciesNameSummary = {
  scientificName: "Digitalis purpurea",
  commonName: "purple foxglove",
};
const monardaDidyma: SpeciesNameSummary = {
  scientificName: "Monarda didyma",
  commonName: "bee balm",
};
const monardaFistulosa: SpeciesNameSummary = {
  scientificName: "Monarda fistulosa",
  commonName: "bee balm",
};

describe("resolveCommonName", () => {
  it("reports unresolved when nothing matches", () => {
    expect(resolveCommonName("bee balm", [digitalis])).toEqual({ status: "unresolved" });
  });

  it("resolves to a single species when exactly one match exists", () => {
    expect(resolveCommonName("purple foxglove", [digitalis, monardaDidyma])).toEqual({
      status: "resolved",
      species: digitalis,
    });
  });

  it("matches case-insensitively", () => {
    expect(resolveCommonName("PURPLE FOXGLOVE", [digitalis])).toEqual({
      status: "resolved",
      species: digitalis,
    });
  });

  it("reports ambiguous with distinct species candidates when a common name spans multiple species", () => {
    const result = resolveCommonName("bee balm", [digitalis, monardaDidyma, monardaFistulosa]);
    expect(result).toEqual({
      status: "ambiguous",
      candidates: [monardaDidyma, monardaFistulosa],
    });
  });

  it("dedupes by scientific name — the same species listed twice is not ambiguity", () => {
    const result = resolveCommonName("bee balm", [monardaDidyma, { ...monardaDidyma }]);
    expect(result).toEqual({ status: "resolved", species: monardaDidyma });
  });
});
