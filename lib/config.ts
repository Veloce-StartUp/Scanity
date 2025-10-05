// Environment configuration
export const config = {
  // API Configuration
  api: {
    baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8081/api/v1',
    baseUrlWithoutVersion: process.env.NEXT_PUBLIC_API_BASE_URL_WITHOUT_VERSION || 'http://localhost:8081',
    endpoints: {
      auth: '/auth',
      authRefresh: '/auth/refresh',
      users: '/users',
      logout: '/logout',
      markItem: '/checkin/mark-item',
      scanHistory: '/scans/history',
      scannerStats: '/statistics/scanner',
    },
  },
  
  // App Configuration
  app: {
    name: 'SCANITY',
    version: '1.0.0',
  },
  
  // Storage Keys
  storage: {
    accessToken: 'qr_scanner_access_token',
    refreshToken: 'qr_scanner_refresh_token',
    userData: 'qr_scanner_user_data',
  },
} as const

// Helper function to get full API URL
export function getApiUrl(endpoint: string): string {
  return `${config.api.baseUrl}${endpoint}`
}
