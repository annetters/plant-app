import type { Plant, SpeciesNameSummary, TagOcrCandidateFields } from '@plant-app/domain'

export type AuthStackParamList = {
  Login: undefined
  SignUp: undefined
}

/** Front is required, back is optional — see issue #20's guided capture design (ADR-0004's tag2 finding: two different tags' front/back photographed together must never be treated as one tag's two sides). Both ids, when present, get linked to whatever Plant the scan resolves to. */
export type TagScanPhotoIds = { frontTagPhotoId: string; backTagPhotoId?: string }

export type MainStackParamList = {
  Dashboard: undefined
  TagScanCapture: undefined
  TagScanReview: { scanId: string; photoIds: TagScanPhotoIds; candidate?: TagOcrCandidateFields }
  TagScanAmbiguousSpecies: {
    scanId: string
    photoIds: TagScanPhotoIds
    candidate: TagOcrCandidateFields
    species: SpeciesNameSummary[]
  }
  TagScanDuplicateOffer: {
    scanId: string
    photoIds: TagScanPhotoIds
    candidate: TagOcrCandidateFields
    existingPlant: Plant
  }
}
