import { describe, expect, it } from "vitest";
import { isKnownPlantGenus, knownPlantGenusCount } from "./genusVocabulary.js";

describe("isKnownPlantGenus", () => {
  it("accepts genera that appear on the real nursery tags", () => {
    // Every one of these is printed on a tag in
    // prototype/tag-scan-ocr/vision-ocr-results.txt — the last three in all
    // caps, which is why the lookup folds case.
    for (const genus of ["Phlox", "Monarda", "Digitalis", "Mangave", "Veronica", "Agastache", "Scabiosa"]) {
      expect(isKnownPlantGenus(genus), genus).toBe(true);
    }
  });

  it("accepts Heucherella, which the transcript only ever contains misspelled", () => {
    // Vision read tag3's "Heucherella" as "Heucheralla". The real genus has to
    // validate; the OCR artifact must not, or the misspelling would be
    // proposed as a species.
    expect(isKnownPlantGenus("Heucherella")).toBe(true);
    expect(isKnownPlantGenus("Heucheralla")).toBe(false);
  });

  it("accepts genera USDA's conservation dataset lacks, which is why the vocabulary is GBIF's", () => {
    for (const genus of ["Heucherella", "Mangave", "Hosta", "Helleborus"]) {
      expect(isKnownPlantGenus(genus), genus).toBe(true);
    }
  });

  it("keeps SYNONYM genera, since horticulture lags taxonomy and nurseries print them", () => {
    // Both are synonyms under current taxonomy. Dropping SYNONYM would reject
    // real tag text — Mangave is on tag5.
    expect(isKnownPlantGenus("Perovskia")).toBe(true);
    expect(isKnownPlantGenus("Mangave")).toBe(true);
  });

  it("rejects the marketing and OCR garbage the shape rule alone used to admit", () => {
    // "Sum" and "Follow" are the first words of the two false positives the
    // old shape-only parser produced on the real transcript.
    for (const word of ["Sum", "Summer", "Follow", "Deer", "Proven", "Winners", "Aurora"]) {
      expect(isKnownPlantGenus(word), word).toBe(false);
    }
  });

  it("matches case-insensitively, since OCR casing is not trustworthy", () => {
    expect(isKnownPlantGenus("phlox")).toBe(true);
    expect(isKnownPlantGenus("PHLOX")).toBe(true);
    expect(isKnownPlantGenus("PhLoX")).toBe(true);
  });

  it("ignores surrounding whitespace", () => {
    expect(isKnownPlantGenus("  Phlox  ")).toBe(true);
  });

  it("rejects empty and non-genus input rather than throwing", () => {
    expect(isKnownPlantGenus("")).toBe(false);
    expect(isKnownPlantGenus("   ")).toBe(false);
    expect(isKnownPlantGenus("Phlox paniculata")).toBe(false); // a binomial is not a genus
  });

  describe("the override layer", () => {
    it("adds Angelica, which the ACCEPTED/SYNONYM filter drops as DOUBTFUL", () => {
      // The clearest evidence that no single status filter is correct: a real,
      // widely sold garden genus sitting in the backbone as DOUBTFUL.
      expect(isKnownPlantGenus("Angelica")).toBe(true);
    });

    it("excludes Aurora, a doubtful genus that collides with marketing copy", () => {
      expect(isKnownPlantGenus("Aurora")).toBe(false);
    });
  });

  it("carries the whole backbone slice, not a truncated page of it", () => {
    // GBIF matched 53,376 rows for this filter, which dedupe to 48,873
    // distinct genus names (Hosta alone appears four times, across two
    // statuses and three families). A vocabulary materially smaller than that
    // means the generator stopped paginating early and shipped a partial list,
    // which would show up as real genera being silently rejected.
    expect(knownPlantGenusCount()).toBeGreaterThan(45_000);
  });
});
