export class BishConnectNotConfiguredError extends Error {
  constructor() {
    super(
      'BishConnect is not configured: set BISHCONNECT_API_URL, BISHCONNECT_AUTH_URL, BISHCONNECT_CLIENT_ID and BISHCONNECT_CLIENT_SECRET'
    )
    this.name = 'BishConnectNotConfiguredError'
  }
}

export class MediaServiceError extends Error {
  constructor(status: number, body: string) {
    super(`Media service error: ${status} ${body}`)
    this.name = 'MediaServiceError'
  }
}
