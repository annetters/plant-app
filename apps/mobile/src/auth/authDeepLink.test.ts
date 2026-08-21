import { createSessionFromUrl, type SessionSettableClient } from './authDeepLink'

function createMockClient() {
  const client: SessionSettableClient = {
    auth: {
      setSession: jest.fn().mockResolvedValue({
        data: { session: { user: { id: 'u1' } } as never },
        error: null,
      }),
    },
  }
  return client
}

describe('createSessionFromUrl', () => {
  it('sets the session from access_token/refresh_token query params', async () => {
    const client = createMockClient()

    const session = await createSessionFromUrl(
      client,
      'plant-app://redirect?access_token=abc123&refresh_token=def456',
    )

    expect(client.auth.setSession).toHaveBeenCalledWith({
      access_token: 'abc123',
      refresh_token: 'def456',
    })
    expect(session).toEqual({ user: { id: 'u1' } })
  })

  it('returns null and does nothing for a link with no access_token', async () => {
    const client = createMockClient()

    const session = await createSessionFromUrl(client, 'plant-app://dashboard')

    expect(client.auth.setSession).not.toHaveBeenCalled()
    expect(session).toBeNull()
  })

  it('throws when the link carries an error code', async () => {
    const client = createMockClient()

    await expect(
      createSessionFromUrl(client, 'plant-app://redirect?errorCode=otp_expired'),
    ).rejects.toThrow('otp_expired')
    expect(client.auth.setSession).not.toHaveBeenCalled()
  })

  it('propagates an error from setSession without swallowing it', async () => {
    const client = createMockClient()
    jest.mocked(client.auth.setSession).mockResolvedValueOnce({
      data: { session: null },
      error: { name: 'AuthApiError', message: 'Invalid token' } as never,
    })

    await expect(
      createSessionFromUrl(client, 'plant-app://redirect?access_token=abc&refresh_token=def'),
    ).rejects.toMatchObject({ message: 'Invalid token' })
  })
})
