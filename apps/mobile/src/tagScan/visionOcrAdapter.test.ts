import { Platform } from 'react-native'

const mockRecognizeText = jest.fn()

jest.mock('../../modules/tag-ocr/src', () => ({
  __esModule: true,
  default: { recognizeText: (...args: unknown[]) => mockRecognizeText(...args) },
}))

describe('visionOcrAdapter', () => {
  beforeEach(() => {
    mockRecognizeText.mockReset()
  })

  it('calls the native module and interprets its output via parseOcrTextLines', async () => {
    mockRecognizeText.mockResolvedValue([
      { text: 'Digitalis purpurea', confidence: 1 },
      { text: 'PERENNIAL', confidence: 1 },
    ])
    const { visionOcrAdapter } = require('./visionOcrAdapter')

    const candidates = await visionOcrAdapter.recognize({ uri: 'file:///tag.jpg' })

    expect(mockRecognizeText).toHaveBeenCalledWith('file:///tag.jpg')
    expect(candidates).toEqual([{ scientificName: 'Digitalis purpurea' }])
  })

  it('has source "vision-ocr"', () => {
    const { visionOcrAdapter } = require('./visionOcrAdapter')
    expect(visionOcrAdapter.source).toBe('vision-ocr')
  })
})

describe('getTagOcrAdapter', () => {
  const originalOS = Platform.OS

  beforeEach(() => {
    jest.resetModules()
    mockRecognizeText.mockReset()
  })

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { get: () => originalOS })
  })

  it('returns manualEntryAdapter when the native module is unavailable (still on Expo Go, or not yet built)', () => {
    jest.doMock('../../modules/tag-ocr/src', () => ({ __esModule: true, default: null }))
    Object.defineProperty(Platform, 'OS', { get: () => 'ios' })
    const { getTagOcrAdapter } = require('./visionOcrAdapter')
    const { manualEntryAdapter } = require('@plant-app/domain')

    expect(getTagOcrAdapter()).toBe(manualEntryAdapter)
  })

  it('returns visionOcrAdapter on iOS when the native module is available', () => {
    // Re-assert the "available" mock explicitly — jest.doMock from a
    // preceding test in this file otherwise persists across resetModules().
    jest.doMock('../../modules/tag-ocr/src', () => ({
      __esModule: true,
      default: { recognizeText: (...args: unknown[]) => mockRecognizeText(...args) },
    }))
    Object.defineProperty(Platform, 'OS', { get: () => 'ios' })
    const { getTagOcrAdapter, visionOcrAdapter } = require('./visionOcrAdapter')

    expect(getTagOcrAdapter()).toBe(visionOcrAdapter)
  })

  it('returns manualEntryAdapter on a non-iOS platform even if the module were available', () => {
    jest.doMock('../../modules/tag-ocr/src', () => ({
      __esModule: true,
      default: { recognizeText: (...args: unknown[]) => mockRecognizeText(...args) },
    }))
    Object.defineProperty(Platform, 'OS', { get: () => 'android' })
    const { getTagOcrAdapter } = require('./visionOcrAdapter')
    const { manualEntryAdapter } = require('@plant-app/domain')

    expect(getTagOcrAdapter()).toBe(manualEntryAdapter)
  })
})
