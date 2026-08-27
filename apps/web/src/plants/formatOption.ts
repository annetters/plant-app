/** Renders a hyphenated domain enum value (e.g. `"full-sun"`) as space-separated display text (`"full sun"`) — shared by any `<select>` listing a Plant enum's raw values (sun requirement, foliage type, native status). */
export function formatOption(value: string): string {
  return value.replace(/-/g, ' ')
}
