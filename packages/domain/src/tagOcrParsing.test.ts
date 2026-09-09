import { describe, expect, it } from "vitest";
import { parseOcrTextLines, type TagOcrTextObservation } from "./tagOcrParsing.js";

function line(text: string, confidence = 1): TagOcrTextObservation {
  return { text, confidence };
}

describe("parseOcrTextLines", () => {
  it("returns no candidates for empty input", () => {
    expect(parseOcrTextLines([])).toEqual([]);
  });

  // Real lines below are copied verbatim from prototype/tag-scan-ocr/vision-ocr-results.txt
  // (ADR-0004's real 8-tag OCR run) — this heuristic is tuned against real, messy
  // nursery-tag text, not invented examples.

  it("extracts a clean scientific name and attaches its standalone cultivar line (tag6: Digitalis)", () => {
    const result = parseOcrTextLines([
      line("Foxglove"),
      line("'Camelot™ Lavender'"),
      line("Digitalis purpurea"),
      line("PERENNIAL"),
      line("Deer Resistant"),
    ]);
    expect(result).toEqual([{ scientificName: "Digitalis purpurea", cultivar: "Camelot™ Lavender" }]);
  });

  it("attaches a same-line quoted cultivar to its scientific name", () => {
    const result = parseOcrTextLines([line("Echinacea purpurea 'Magnus'")]);
    expect(result).toEqual([{ scientificName: "Echinacea purpurea", cultivar: "Magnus" }]);
  });

  it("attaches a standalone cultivar line when exactly one scientific name is found (tag1: Phlox)", () => {
    const result = parseOcrTextLines([
      line("Full Sun"),
      line("PERENNIAL"),
      line('\'Glamour Girl"'), // real OCR artifact: mismatched opening/closing quote chars
      line("Tall Garden Phlox"),
      line("Phlox paniculata"),
      line("0120277707"),
      line("Phlox paniculata"), // real duplicate occurrence later in the same tag
      line("height"),
    ]);
    expect(result).toEqual([{ scientificName: "Phlox paniculata", cultivar: "Glamour Girl" }]);
  });

  it("dedupes the same scientific name recognized twice", () => {
    const result = parseOcrTextLines([line("Digitalis purpurea"), line("Digitalis purpurea")]);
    expect(result).toHaveLength(1);
  });

  it("never matches ordinary marketing prose, even when it starts with a capitalized word (tag5/tag2 real lines)", () => {
    const result = parseOcrTextLines([
      line("This perennial will"),
      line(
        "This cross between an Agave and & Manfreds captures the best of both",
      ),
      line("Full Sun"),
      line("Tall Garden Phlox"),
      line("Attracts Hummingbirds"),
      line("Deer Resistant"),
      line("PROVEN WINNERS"),
    ]);
    expect(result).toEqual([]);
  });

  it("never matches a binomial-looking line with untagged trailing text, rather than guessing (tag5 real line: Mangave Catch a Wave PPAF)", () => {
    const result = parseOcrTextLines([line("Mangave Catch a Wave PPAF")]);
    expect(result).toEqual([]);
  });

  it("never matches a messy line where extra words sit between the binomial and a quote (tag3 real line)", () => {
    // Verbatim, misspelling included: Vision read "Heucherella" as
    // "Heucheralla" at 0.50 confidence. Correcting it here would test a line
    // no tag ever produced.
    const result = parseOcrTextLines([line("Heucheralla Capture the Fag'")]);
    expect(result).toEqual([]);
  });

  it("surfaces distinct candidates for two different tags in one photo, without cross-attaching a stray cultivar (ADR-0004's tag2 finding)", () => {
    const result = parseOcrTextLines([
      line("Monarda didyma"),
      line("PAIR WITH: Bee Balm companion planting"),
      line("Veronica spicata"),
      line("'Some Unrelated Cultivar'"),
    ]);
    expect(result).toEqual(
      expect.arrayContaining([{ scientificName: "Monarda didyma" }, { scientificName: "Veronica spicata" }]),
    );
    expect(result).toHaveLength(2);
    // Neither candidate should have picked up the stray cultivar line — with
    // more than one scientific-name match, attaching it would risk pairing
    // one tag's cultivar with a different tag's species.
    expect(result.every((c) => c.cultivar === undefined)).toBe(true);
  });

  it("requires the genus to be capitalized — an all-lowercase or all-caps line never matches", () => {
    expect(parseOcrTextLines([line("digitalis purpurea")])).toEqual([]);
    expect(parseOcrTextLines([line("SCABIOSA COLUMBARIA HARLEQUIN")])).toEqual([]);
  });

  // #23: the shape rule alone cannot tell "Monarda didyma" from "Follow us" —
  // they are typographically identical, so loosening it multiplies false
  // positives and tightening it drops real names. The discriminator is
  // vocabulary: the first word has to be a real plant genus. The gate stacks
  // on top of the shape rule rather than replacing it, so a false positive now
  // has to be both a real genus AND followed by a lowercase word.
  describe("genus validation (#23)", () => {
    it("rejects a social-media footer that the shape rule matched perfectly (tag5 real line)", () => {
      expect(parseOcrTextLines([line("Follow us")])).toEqual([]);
    });

    it("rejects a split word that the shape rule matched perfectly (tag3 real line)", () => {
      // Vision split "Summer" across a line break, and the old parser proposed
      // "Sum mer" as a species with confidence.
      expect(parseOcrTextLines([line("Sum mer")])).toEqual([]);
    });

    it("does not rescue a rejected candidate by attaching a real cultivar to it (tag3)", () => {
      // tag3's real shape: the false-positive "Sum mer" used to capture the
      // genuine cultivar 'Wildberry' and bind it to a nonsense species. With
      // the species rejected there is no candidate to attach it to, so tag3
      // degrades to nothing here. Whether it should instead yield a
      // cultivar-only candidate is #38's decision, not this one's.
      const result = parseOcrTextLines([
        line("Sum mer"),
        line("'Wildberry'"),
        line("Heucheralla Capture the Fag'"),
      ]);
      expect(result).toEqual([]);
    });

    it("still accepts every genus the real tags actually print", () => {
      // The three tags the old parser got right must stay right — this is the
      // regression the genus gate could plausibly cause.
      expect(parseOcrTextLines([line("Phlox paniculata"), line('\'Glamour Girl"')])).toEqual([
        { scientificName: "Phlox paniculata", cultivar: "Glamour Girl" },
      ]);
      expect(parseOcrTextLines([line("Monarda didyma"), line("'PARDON MY PINK'")])).toEqual([
        { scientificName: "Monarda didyma", cultivar: "PARDON MY PINK" },
      ]);
      expect(parseOcrTextLines([line("Digitalis purpurea"), line("'Camelot™ Lavender'")])).toEqual([
        { scientificName: "Digitalis purpurea", cultivar: "Camelot™ Lavender" },
      ]);
    });

    it("accepts a genus that is only a SYNONYM in the backbone, since nurseries print those", () => {
      expect(parseOcrTextLines([line("Perovskia atriplicifolia")])).toEqual([
        { scientificName: "Perovskia atriplicifolia" },
      ]);
    });

    it("accepts Angelica, which reaches the vocabulary through the override file", () => {
      expect(parseOcrTextLines([line("Angelica gigas")])).toEqual([
        { scientificName: "Angelica gigas" },
      ]);
    });

    it("still rejects a real genus followed by untagged text, since the shape rule is unchanged", () => {
      // Mangave IS a real genus now that the vocabulary knows it, so this line
      // is held out only by the whole-line anchor. #23 explicitly does not
      // loosen that anchor.
      expect(parseOcrTextLines([line("Mangave Catch a Wave PPAF")])).toEqual([]);
    });
  });
});
