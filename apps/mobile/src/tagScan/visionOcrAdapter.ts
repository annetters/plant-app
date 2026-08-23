import { manualEntryAdapter, parseOcrTextLines, type TagOcrAdapter } from '@plant-app/domain'
import { Platform } from 'react-native'
import TagOcrNativeModule from '../../modules/tag-ocr/src'

/**
 * The real on-device OCR adapter (issue #22) — thin glue only. Reading text
 * off the photo is the native module's job (`modules/tag-ocr`); interpreting
 * that text into commonName/scientificName/cultivar candidates is domain
 * logic (`parseOcrTextLines` in `@plant-app/domain`, unit-tested against
 * real tag transcripts). Never call this directly — go through
 * `getTagOcrAdapter()`, which only returns this when the native module is
 * actually available.
 */
export const visionOcrAdapter: TagOcrAdapter = {
  source: 'vision-ocr',
  async recognize(photo) {
    if (!TagOcrNativeModule) {
      throw new Error('The Vision OCR native module is not available on this build.')
    }
    const observations = await TagOcrNativeModule.recognizeText(photo.uri)
    return parseOcrTextLines(observations)
  },
}

/**
 * Vision OCR when the native module is actually compiled into this binary
 * (a custom EAS dev client, iOS only — see issue #22); `manualEntryAdapter`
 * everywhere else (still on Expo Go, or any other platform) — per
 * CONTEXT.md's Tag Scan rule, manual entry is a complete fallback, not a
 * degraded experience, when OCR "fails, is unavailable, or misreads."
 */
export function getTagOcrAdapter(): TagOcrAdapter {
  if (Platform.OS === 'ios' && TagOcrNativeModule) {
    return visionOcrAdapter
  }
  return manualEntryAdapter
}
