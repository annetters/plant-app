import { describe, expect, it } from "vitest";
import namePairs from "./data/usdaScientificNamePairs.json";
import { parseUsdaChecklist, usdaScientificNameWithoutAuthor } from "./usdaChecklist.js";

describe("usdaScientificNameWithoutAuthor", () => {
  it("drops a trailing author", () => {
    expect(usdaScientificNameWithoutAuthor("Dahlia pinnata Cav.")).toBe("Dahlia pinnata");
    expect(usdaScientificNameWithoutAuthor("Monarda didyma L.")).toBe("Monarda didyma");
  });

  it("drops a parenthesised basionym author and the author that follows it", () => {
    expect(usdaScientificNameWithoutAuthor("Hydrangea macrophylla (Thunb.) Ser.")).toBe(
      "Hydrangea macrophylla",
    );
  });

  it("keeps infraspecific ranks whose author sits in the middle of the name", () => {
    expect(
      usdaScientificNameWithoutAuthor("Abies magnifica A. Murray bis var. shastensis Lemmon"),
    ).toBe("Abies magnifica var. shastensis");
    expect(usdaScientificNameWithoutAuthor("Sorghum bicolor (L.) Moench ssp. bicolor")).toBe(
      "Sorghum bicolor ssp. bicolor",
    );
  });

  it("keeps hybrid markers, attached or spaced", () => {
    expect(usdaScientificNameWithoutAuthor("Clematis ×jackmanii T. Moore")).toBe(
      "Clematis ×jackmanii",
    );
    expect(usdaScientificNameWithoutAuthor("×Agropogon littoralis (Sm.) C.E. Hubbard")).toBe(
      "×Agropogon littoralis",
    );
  });

  it("keeps both parents of a hybrid formula", () => {
    // Dropping the second parent would silently rename this to *Acer
    // leucoderme*, which is a different, real species.
    expect(usdaScientificNameWithoutAuthor("Acer leucoderme × saccharum [unnamed hybrid]")).toBe(
      "Acer leucoderme × saccharum",
    );
  });

  it("drops USDA's bracketed status annotations", () => {
    expect(
      usdaScientificNameWithoutAuthor("Bromus biebersteinii Roem. & Schult. [excluded]"),
    ).toBe("Bromus biebersteinii");
  });

  it("does not mistake the author connector 'ex' for an epithet", () => {
    expect(
      usdaScientificNameWithoutAuthor("Verbesina encelioides (Cav.) Benth. & Hook. f. ex A. Gray"),
    ).toBe("Verbesina encelioides");
  });

  it("handles a genus-rank entry", () => {
    expect(usdaScientificNameWithoutAuthor("Dahlia Cav.")).toBe("Dahlia");
  });

  it("is empty for empty input", () => {
    expect(usdaScientificNameWithoutAuthor("   ")).toBe("");
  });

  /**
   * The real check. USDA's own API publishes both forms of the same name for
   * the 2,186 taxa in `characteristicSearchResults`, so its answer is the
   * specification — `data/usdaScientificNamePairs.json` is that answer,
   * captured verbatim (2026-09-09). The bulk checklist this parser actually
   * reads carries only the authored form, which is the whole reason the
   * parser exists.
   */
  it("agrees with USDA's own answer on all 2,186 taxa it publishes both forms for", () => {
    const mismatches = (namePairs as [string, string][])
      .filter(([withAuthor, expected]) => usdaScientificNameWithoutAuthor(withAuthor) !== expected)
      .map(([withAuthor, expected]) => ({
        withAuthor,
        expected,
        actual: usdaScientificNameWithoutAuthor(withAuthor),
      }));
    expect(mismatches).toEqual([]);
  });
});

describe("parseUsdaChecklist", () => {
  const HEADER = '"Symbol","Synonym Symbol","Scientific Name with Author","Common Name","Family"';

  it("reads an accepted row", () => {
    const rows = parseUsdaChecklist(
      `${HEADER}\n"DAPI3","","Dahlia pinnata Cav.","pinnate dahlia","Asteraceae"\n`,
    );
    expect(rows).toEqual([
      {
        symbol: "DAPI3",
        synonymSymbol: null,
        scientificName: "Dahlia pinnata",
        scientificNameWithAuthor: "Dahlia pinnata Cav.",
        commonName: "pinnate dahlia",
        family: "Asteraceae",
      },
    ]);
  });

  it("reads a synonym row, which carries the accepted taxon's symbol and no common name", () => {
    const rows = parseUsdaChecklist(`${HEADER}\n"DAPI3","DARO","Dahlia rosea Cav.","",""\n`);
    expect(rows).toEqual([
      {
        symbol: "DAPI3",
        synonymSymbol: "DARO",
        scientificName: "Dahlia rosea",
        scientificNameWithAuthor: "Dahlia rosea Cav.",
        commonName: null,
        family: null,
      },
    ]);
  });

  it("skips the header and blank lines", () => {
    expect(parseUsdaChecklist(`${HEADER}\n\n   \n`)).toEqual([]);
  });

  it("skips a row with no usable scientific name rather than importing a nameless entry", () => {
    expect(parseUsdaChecklist(`${HEADER}\n"XXXX","","","",""\n`)).toEqual([]);
  });

  it("handles CRLF line endings and a missing trailing newline", () => {
    const rows = parseUsdaChecklist(
      `${HEADER}\r\n"MODI","","Monarda didyma L.","scarlet beebalm","Lamiaceae"`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.commonName).toBe("scarlet beebalm");
  });

  it("reads a quoted field containing a comma", () => {
    const rows = parseUsdaChecklist(
      `${HEADER}\n"ABC","","Genus species L.","one, two","Fam"\n`,
    );
    expect(rows[0]?.commonName).toBe("one, two");
  });
});
