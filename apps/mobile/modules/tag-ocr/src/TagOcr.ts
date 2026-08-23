import { NativeModule, requireOptionalNativeModule } from 'expo'
import type { TagOcrTextObservation } from './TagOcr.types'

declare class TagOcrModule extends NativeModule {
  recognizeText(uri: string): Promise<TagOcrTextObservation[]>
}

/**
 * `null` whenever this module isn't compiled into the running binary — e.g.
 * still on Expo Go (this module needs a custom EAS dev client, see issue
 * #22) or not on iOS at all. Callers (see apps/mobile/src/tagScan/visionOcrAdapter.ts)
 * must treat that as routine, not a crash — `requireNativeModule` would
 * throw instead, which is the wrong contract for an adapter with a real
 * fallback (manual entry).
 */
export default requireOptionalNativeModule<TagOcrModule>('TagOcr')
