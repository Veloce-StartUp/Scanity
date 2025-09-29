// User and Authentication Types
export interface UserData {
  userID: number
  email: string
  nic: string
  mobile: string | null
  firstName: string
  lastName: string
  displayName: string
  password: string | null
  companyId: number
  contactNo: string
  imagePath: string | null
  lastLoginDate: string | null
  lastLogoutDate: string | null
  designation: string
  workplace: string | null
  address: string
  status: string
  rolesIDs: number[]
  discountID: number | null
  packageIDs: string | null
  roles: string[]
  paymentStatus: string | null
  discount: string | null
  accessToken: string
  refreshToken: string
  privileges: string[]
  // New fields for item issuance
  lunchCouponIssued?: boolean
  bagIssued?: boolean
  lastScanTime?: Date
}

export interface User {
  userID: number
  email: string
  displayName: string
  firstName: string
  lastName: string
  companyId: number
  roles: string[]
  privileges: string[]
}

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  userID: number
  email: string
  nic: string
  mobile: string | null
  firstName: string
  lastName: string
  displayName: string
  password: string | null
  companyId: number
  contactNo: string
  imagePath: string | null
  lastLoginDate: string | null
  lastLogoutDate: string | null
  designation: string
  workplace: string | null
  address: string
  status: string
  rolesIDs: number[]
  discountID: number | null
  packageIDs: string | null
  roles: string[]
  paymentStatus: string | null
  discount: string | null
  accessToken: string
  refreshToken: string
  privileges: string[]
}

// QR Scanner Types
export interface ScanHistoryItem {
  result: string
  timestamp: Date
  type: string
  userData?: UserData
  itemsIssued?: {
    lunchCoupon: boolean
    bag: boolean
  }
  scanStatus: 'pending' | 'completed' | 'failed'
  errorMessage?: string
}

export interface QRScanResult {
  userID: number
  email: string
}

// Item Issuance Types
export enum ItemType {
  LUNCH_COUPON = 'LUNCH_COUPON',
  BAG = 'BAG'
}

export interface ItemIssuanceRequest {
  userId: number
  itemType: ItemType
  deviceId: string
}

export interface ItemIssuanceResponse {
  success: boolean
  message: string
  error?: string
}

// API Response Types
export interface ApiResponse<T> {
  data?: T
  message?: string
  success: boolean
  error?: string
}

export interface ApiErrorResponse {
  errors: string[]
}

// Component Props Types
export interface LoginFormProps {
  onLogin: (email: string, password: string) => Promise<void>
  isLoading?: boolean
  error?: string
}

export interface QRScannerProps {
  onScan: (result: string) => void
  onError: (error: string) => void
  autoStart?: boolean
}

export interface ScanResultProps {
  result: string
  onClose: () => void
  onNewScan: () => void
  onItemIssued?: (userData: UserData) => void
}

export interface ScanHistoryProps {
  history: ScanHistoryItem[]
  onClearHistory: () => void
}

export interface DashboardStatsProps {
  history: ScanHistoryItem[]
}
