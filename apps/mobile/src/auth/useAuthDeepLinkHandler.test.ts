import { renderHook, waitFor } from '@testing-library/react-native'
import * as authDeepLink from './authDeepLink'
import { useAuthDeepLinkHandler } from './useAuthDeepLinkHandler'

let mockUrl: string | null = null

jest.mock('expo-linking', () => ({
  useLinkingURL: () => mockUrl,
}))

const fakeClient = { auth: { setSession: jest.fn() } }

describe('useAuthDeepLinkHandler', () => {
  beforeEach(() => {
    mockUrl = null
    jest.restoreAllMocks()
  })

  it('does nothing when there is no incoming URL', () => {
    const spy = jest.spyOn(authDeepLink, 'createSessionFromUrl')
    renderHook(() => useAuthDeepLinkHandler(fakeClient))

    expect(spy).not.toHaveBeenCalled()
  })

  it('hands an incoming URL to createSessionFromUrl', async () => {
    mockUrl = 'plant-app://redirect?access_token=abc&refresh_token=def'
    const spy = jest.spyOn(authDeepLink, 'createSessionFromUrl').mockResolvedValue(null)

    renderHook(() => useAuthDeepLinkHandler(fakeClient))

    await waitFor(() => expect(spy).toHaveBeenCalledWith(fakeClient, mockUrl))
  })

  it('logs a warning instead of throwing when createSessionFromUrl rejects', async () => {
    mockUrl = 'plant-app://redirect?errorCode=otp_expired'
    jest.spyOn(authDeepLink, 'createSessionFromUrl').mockRejectedValue(new Error('otp_expired'))
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

    renderHook(() => useAuthDeepLinkHandler(fakeClient))

    await waitFor(() => expect(warnSpy).toHaveBeenCalled())
  })
})
