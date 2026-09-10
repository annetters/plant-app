import { describe, expect, it } from "vitest";
import {
  manualEntryAdapter,
  resolveSpeciesMatches,
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
  commonName: "scarlet beebalm",
};
const monardaFistulosa: SpeciesNameSummary = {
  scientificName: "Monarda fistulosa",
  commonName: "wild bergamot",
};

describe("resolveSpeciesMatches", () => {
  it("reports unresolved when the source found nothing", () => {
    expect(resolveSpeciesMatches([])).toEqual({ status: "unresolved" });
  });

  it("resolves to a single species when the source found exactly one", () => {
    expect(resolveSpeciesMatches([digitalis])).toEqual({ status: "resolved", species: digitalis });
  });

  it("reports ambiguous with distinct candidates when a common name spans multiple species", () => {
    expect(resolveSpeciesMatches([monardaDidyma, monardaFistulosa])).toEqual({
      status: "ambiguous",
      candidates: [monardaDidyma, monardaFistulosa],
    });
  });

  it("dedupes by scientific name — the same species listed twice is not ambiguity", () => {
    expect(resolveSpeciesMatches([monardaDidyma, { ...monardaDidyma }])).toEqual({
      status: "resolved",
      species: monardaDidyma,
    });
  });

  it("keeps a species USDA has no common name for", () => {
    // 5,218 of USDA's 48,994 accepted taxa carry no national common name.
    // Dropping them would reintroduce exactly the coverage gap #36 closed.
    const unnamed: SpeciesNameSummary = { scientificName: "Hosta venusta", commonName: null };
    expect(resolveSpeciesMatches([unnamed])).toEqual({ status: "resolved", species: unnamed });
  });

  it("does not second-guess what the source matched on", () => {
    // The name index matches "bee balm" against USDA's "beebalm" by
    // collapsing punctuation, and matches scientific names too. Re-filtering
    // those hits against the typed text — which this used to do — throws away
    // every match the smarter search just found.
    const beebalm: SpeciesNameSummary = {
      scientificName: "Monarda didyma",
      commonName: "scarlet beebalm",
    };
    expect(resolveSpeciesMatches([beebalm])).toEqual({ status: "resolved", species: beebalm });
  });
});
