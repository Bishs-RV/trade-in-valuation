export const isBishConnectConfigured = () =>
  Boolean(
    process.env.BISHCONNECT_API_URL &&
      process.env.BISHCONNECT_AUTH_URL &&
      process.env.BISHCONNECT_CLIENT_ID &&
      process.env.BISHCONNECT_CLIENT_SECRET
  )
