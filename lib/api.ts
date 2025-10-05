import {
  ApiErrorResponse,
  ItemIssuanceResponse,
  ItemType,
  LoginRequest,
  LoginResponse,
  ScanHistoryItem,
  ScannerStats,
  UserData
} from './types'
import { config, getApiUrl } from './config'
import { getEncryptedPassword } from './crypto'

// Store tokens in localStorage
const STORAGE_KEYS = config.storage

export function getStoredToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(STORAGE_KEYS.accessToken)
  }
  return null
}

export function getStoredRefreshToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(STORAGE_KEYS.refreshToken)
  }
  return null
}

export function getStoredUserData(): UserData | null {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(STORAGE_KEYS.userData)
    return stored ? JSON.parse(stored) : null
  }
  return null
}

export function storeUserData(userData: UserData): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEYS.accessToken, userData.accessToken)
    localStorage.setItem(STORAGE_KEYS.refreshToken, userData.refreshToken)
    localStorage.setItem(STORAGE_KEYS.userData, JSON.stringify(userData))
  }
}

export function clearStoredData(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEYS.accessToken)
    localStorage.removeItem(STORAGE_KEYS.refreshToken)
    localStorage.removeItem(STORAGE_KEYS.userData)
  }
}

export async function login(credentials: LoginRequest): Promise<UserData> {
  try {
    // Encrypt password before sending to backend
    const encryptedCredentials = {
      email: credentials.email,
      password: getEncryptedPassword(credentials.password)
    }
    
    const response = await fetch(getApiUrl(config.api.endpoints.auth), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(encryptedCredentials),
    })

    if (!response.ok) {
      try {
        const errorData: ApiErrorResponse = await response.json()
        const errorMessage = errorData.errors && errorData.errors.length > 0 
          ? errorData.errors[0] 
          : `Login failed: ${response.status}`
        throw new Error(errorMessage)
      } catch (parseError) {
        throw new Error(`Login failed: ${response.status}`)
      }
    }

    const userData: LoginResponse = await response.json()
    
    // Store the user data and tokens
    storeUserData(userData)
    
    return userData
  } catch (error) {
    console.error('Login error:', error)
    throw error
  }
}

export async function logout(): Promise<void> {
  try {
    const token = getStoredToken();

    // Disconnect WebSocket first
    if (typeof window !== 'undefined') {
      const { webSocketService } = await import('./websocket');
      webSocketService.disconnect();
    }

    if (token) {
      // Call logout endpoint to invalidate token on server
      // await fetch(getApiUrl(config.api.endpoints.logout), {
      //   method: 'POST',
      //   headers: {
      //     'Authorization': `Bearer ${token}`,
      //   },
      // }).catch(error => {
      //   console.warn('Logout API call failed, but continuing with local cleanup:', error);
      // });
    }
  } catch (error) {
    console.error('Logout error:', error);
  } finally {
    // Always clear stored data
    clearStoredData();
  }
}

export async function refreshAccessToken(): Promise<string | null> {
  try {
    const refreshTokenValue = getStoredRefreshToken()
    
    if (!refreshTokenValue) {
      return null
    }

    const response = await fetch(getApiUrl(config.api.endpoints.authRefresh), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken: refreshTokenValue }),
    })

    if (!response.ok) {
      throw new Error('Token refresh failed')
    }

    const data = await response.json()
    const newAccessToken = data.accessToken
    
    // Update stored token
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.accessToken, newAccessToken)
    }
    
    return newAccessToken
  } catch (error) {
    console.error('Token refresh error:', error)
    // If refresh fails, clear all stored data
    clearStoredData()
    return null
  }
}

export async function makeAuthenticatedRequest<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  let token = getStoredToken()
  
  if (!token) {
    throw new Error('No access token available')
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })

    if (response.status === 401) {
      // Token expired, try to refresh
      const newToken = await refreshAccessToken()
      if (newToken) {
        // Retry with new token
        const retryResponse = await fetch(url, {
          ...options,
          headers: {
            ...options.headers,
            'Authorization': `Bearer ${newToken}`,
            'Content-Type': 'application/json',
          },
        })
        
        if (!retryResponse.ok) {
          throw new Error(`Request failed: ${retryResponse.status}`)
        }
        
        return await retryResponse.json()
      } else {
        throw new Error('Authentication failed')
      }
    }

    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Authenticated request error:', error)
    throw error
  }
}

export async function getUserData(userID: number): Promise<UserData | null> {
  try {
    return await makeAuthenticatedRequest<UserData>(getApiUrl(`${config.api.endpoints.users}/${userID}`))
  } catch (error) {
    console.error('Failed to get user data:', error)
    return null
  }
}

export async function updateUserStatus(
  userID: number,
  updates: Partial<Pick<UserData, "lastLoginDate" | "lastLogoutDate" | "lunchCouponIssued" | "bagIssued" | "lastScanTime">>,
): Promise<UserData | null> {
  try {
    return await makeAuthenticatedRequest<UserData>(getApiUrl(`${config.api.endpoints.users}/${userID}`), {
      method: 'PATCH',
      body: JSON.stringify(updates),
    })
  } catch (error) {
    console.error('Failed to update user status:', error)
    return null
  }
}

export async function getScanHistory(): Promise<ScanHistoryItem[]> {
  try {
    return await makeAuthenticatedRequest<ScanHistoryItem[]>(getApiUrl(config.api.endpoints.scanHistory))
  } catch (error) {
    console.error('Failed to get scan history:', error)
    return []
  }
}

export async function markItemIssued(
    userId: number,
    itemType: ItemType,
    eventDay: string = new Date().toISOString().split('T')[0],
    deviceId: string = 'qr-scanner-web-001',
): Promise<ItemIssuanceResponse> {
  try {
    const requestData = {
      userId,
      itemType,
      eventDay,
      issuedBy: deviceId,
      scannerUserId: getStoredUserData()?.userID || 0
    };

    return await makeAuthenticatedRequest<ItemIssuanceResponse>(
        getApiUrl(config.api.endpoints.markItem),
        {
          method: 'POST',
          headers: {
            'X-Device-Id': deviceId,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestData),
        }
    );
  } catch (error) {
    console.error('Failed to mark item as issued:', error);
    return {
      success: false,
      message: 'Failed to mark item as issued',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export function decodeQRData(base64Data: string): { userID: number; email: string } | null {
  try {
    const decoded = atob(base64Data)
    const data = JSON.parse(decoded)

    if (data.userID && data.email) {
      return { userID: data.userID, email: data.email }
    }

    return null
  } catch (error) {
    console.error("Failed to decode QR data:", error)
    return null
  }
}

export async function getScannerStats(scannerUserId: number): Promise<ScannerStats> {
  try {
    return await makeAuthenticatedRequest<ScannerStats>(
        getApiUrl(`${config.api.endpoints.scannerStats}/${scannerUserId}/today`)
    );
  } catch (error) {
    console.error('Failed to get scanner stats:', error);
    throw error;
  }
}

export async function getScannerHistory(scannerUserId: number, page: number = 0, size: number = 50): Promise<ScanHistoryItem[]> {
  try {
    return await makeAuthenticatedRequest<ScanHistoryItem[]>(
        getApiUrl(`${config.api.endpoints.scannerStats}/${scannerUserId}/history?page=${page}&size=${size}`)
    );
  } catch (error) {
    console.error('Failed to get scanner history:', error);
    return [];
  }
}

export async function getScannerSummary(scannerUserId: number): Promise<ScannerStats> {
  try {
    return await makeAuthenticatedRequest<ScannerStats>(
        getApiUrl(`${config.api.endpoints.scannerStats}/${scannerUserId}/summary`)
    );
  } catch (error) {
    console.error('Failed to get scanner summary:', error);
    throw error;
  }
}
