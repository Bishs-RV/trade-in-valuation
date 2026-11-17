import { getBishConnectTokenResponse } from '@/lib/bishconnect/auth'

export interface AuthTokenResponse {
  access_token: string
  expires_in: number
  token_type: string
}

// Token source for the media-service proxy; the Cognito call and cache live in lib/bishconnect/auth.ts
export async function getAuthToken(): Promise<AuthTokenResponse> {
  const { access_token, expires_in, token_type } = await getBishConnectTokenResponse()
  return { access_token, expires_in, token_type }
}
