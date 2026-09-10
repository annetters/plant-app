/**
 * Reading USDA PLANTS' bulk checklist, `plantlst.txt` (#36).
 *
 * The Tag Scan adapter used to treat USDA's `characteristicSearchResults`
 * endpoint as the species universe. It isn't one: it is a 2,186-entry NRCS
 * conservation-plant traits table, and *Dahlia pinnata* — an ordinary
 * binomial, not a cultivar — is simply not in it. The full checklist behind
 * the rest of PLANTS carries 48,994 accepted names and resolved 57 of 60
 * ordinary garden ornamentals against that table's 10. See
 * `docs/research/usda-plants-name-resolution.md`.
 *
 * So names come from here and traits stay live: this module turns the bulk
 * file into rows for `public.usda_plant_names`.
 *
 * Mirrored in `supabase/functions/_shared/usdaChecklist.ts` for the Deno edge
 * runtime, which can't import this npm workspace package — keep the two in
 * sync. Same arrangement as `property.ts` and `create-property`.
 */

/** One row of `plantlst.txt`, reduced to the columns we keep. */
export interface UsdaChecklistRow {
  /** The *accepted* taxon's symbol. Synonym rows repeat it — that is what makes them a synonym mapping. */
  symbol: string;
  /** This row's own symbol when it is a synonym; `null` on an accepted row. */
  synonymSymbol: string | null;
  /** Author stripped — the form a gardener types and the form we write into a Plant. */
  scientificName: string;
  /** Kept verbatim so a future correction to the parser can be re-derived without re-downloading 6.7 MB. */
  scientificNameWithAuthor: string;
  /** USDA supplies one only on accepted rows, and not always then. */
  commonName: string | null;
  family: string | null;
}

/**
 * Infraspecific rank connectors, which sit *between* name parts and so can't
 * be found by position — "Abies magnifica A. Murray bis var. shastensis
 * Lemmon" puts an author on both sides of `var.`.
 */
const RANK_MARKERS = new Set([
  "ssp.",
  "subsp.",
  "var.",
  "f.",
  "fo.",
  "forma",
  "subvar.",
  "nothosubsp.",
  "nothossp.",
  "nothovar.",
]);

/**
 * Lowercase words that appear inside author citations ("Hook. f. ex A. Gray")
 * and would otherwise be read as epithets. Without this, *Verbesina
 * encelioides* comes back as "Verbesina encelioides f. ex".
 */
const AUTHOR_CONNECTORS = new Set(["ex", "and", "or", "in", "non", "nec", "pro", "sensu"]);

const EPITHET = /^[a-z][a-z-]*$/;
const HYBRID_SIGN = "×";

function isEpithet(token: string): boolean {
  return EPITHET.test(token) && !AUTHOR_CONNECTORS.has(token);
}

/**
 * Strips the author citation from a USDA scientific name.
 *
 * USDA's API publishes both forms of a name; its bulk checklist publishes
 * only the authored one, so importing the checklist means deriving the other.
 * That derivation is checked against USDA's own answer for all 2,186 taxa it
 * gives both forms for (see `usdaChecklist.test.ts`) — it is a grammar, not a
 * heuristic, and the fixture is what keeps it one.
 *
 * The grammar: a genus, optionally a species epithet, optionally a second
 * hybrid parent, then any number of `rank + epithet` pairs. Everything else
 * is an author and is dropped, including parenthesised groups and USDA's
 * bracketed status annotations (`[excluded]`, `[unnamed hybrid]`).
 */
export function usdaScientificNameWithoutAuthor(nameWithAuthor: string): string {
  const tokens = nameWithAuthor
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 0);
  if (tokens.length === 0) return "";

  const parts: string[] = [tokens[0]!];
  let index = 1;

  // Species epithet. The hybrid sign attaches either way — USDA writes both
  // "Clematis ×jackmanii" and, rarely, a spaced form.
  const epithet = tokens[index];
  if (epithet !== undefined) {
    if (epithet.startsWith(HYBRID_SIGN) && isEpithet(epithet.slice(HYBRID_SIGN.length))) {
      parts.push(epithet);
      index += 1;
    } else if (epithet === HYBRID_SIGN && isEpithet(tokens[index + 1] ?? "")) {
      parts.push(HYBRID_SIGN + tokens[index + 1]!);
      index += 2;
    } else if (isEpithet(epithet)) {
      parts.push(epithet);
      index += 1;
    }
  }

  // A named hybrid's second parent ("Acer leucoderme × saccharum"). Dropping
  // it would leave a name that reads as a different, real species.
  if (parts.length === 2 && tokens[index] === HYBRID_SIGN && isEpithet(tokens[index + 1] ?? "")) {
    parts.push(HYBRID_SIGN, tokens[index + 1]!);
    index += 2;
  }

  while (index < tokens.length) {
    const token = tokens[index]!;
    if (RANK_MARKERS.has(token) && isEpithet(tokens[index + 1] ?? "")) {
      parts.push(token, tokens[index + 1]!);
      index += 2;
      continue;
    }
    index += 1;
  }

  return parts.join(" ");
}

/**
 * Splits one line of USDA's comma-delimited, fully-quoted checklist.
 * Hand-rolled rather than pulled in as a dependency: the format is five
 * quoted fields with no escaping to speak of, and this has to run unchanged
 * in the Deno edge runtime as well as here.
 */
function splitChecklistLine(line: string): string[] {
  const fields: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const character = line[i]!;
    if (character === '"') {
      // A doubled quote inside a quoted field is one literal quote.
      if (quoted && line[i + 1] === '"') {
        field += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (character === "," && !quoted) {
      fields.push(field);
      field = "";
      continue;
    }
    field += character;
  }
  fields.push(field);
  return fields;
}

/**
 * Deliberately not shared with the identical helper in `usdaTraits.ts`: this
 * module is mirrored verbatim into the Deno edge runtime, which can't import
 * across the workspace, so a shared helper would have to be mirrored too and
 * the mirror is the thing most worth keeping small.
 */
function blankToNull(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Parses the whole checklist. Rows with no usable scientific name are
 * dropped rather than imported nameless — the point of the table is to
 * resolve a name, and a row that can't do that is only noise in a substring
 * search.
 */
export function parseUsdaChecklist(text: string): UsdaChecklistRow[] {
  const rows: UsdaChecklistRow[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    const fields = splitChecklistLine(line);
    const symbol = blankToNull(fields[0]);
    // USDA's own header line, and anything else without a symbol.
    if (symbol === null || symbol === "Symbol") continue;
    const scientificNameWithAuthor = blankToNull(fields[2]);
    if (scientificNameWithAuthor === null) continue;
    const scientificName = usdaScientificNameWithoutAuthor(scientificNameWithAuthor);
    if (scientificName.length === 0) continue;
    rows.push({
      symbol,
      synonymSymbol: blankToNull(fields[1]),
      scientificName,
      scientificNameWithAuthor,
      commonName: blankToNull(fields[3]),
      family: blankToNull(fields[4]),
    });
  }
  return rows;
}
