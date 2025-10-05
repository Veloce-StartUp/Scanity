import SockJS from 'sockjs-client'
import { Client, Message, StompSubscription } from '@stomp/stompjs'
import { config } from './config'

export interface ScanRequest {
  userId: number
  scannerUserId: number
  hash: string
  deviceId: string
  scanDate: string
}

export interface ScanResponse {
  success: boolean
  message: string
  data?: any
}

export interface WebSocketCallbacks {
  onScanSuccess?: (message: string) => void
  onScanError?: (message: string) => void
  onConnected?: (sessionId: string | null) => void
  onDisconnected?: () => void
}

class WebSocketService {
  private stompClient: Client | null = null
  private socket: any = null
  private isConnected = false
  private sessionId: string | null = null
  private callbacks: WebSocketCallbacks = {}
  private scanResultsSubscription: StompSubscription | null = null
  private errorsSubscription: StompSubscription | null = null
  private connectionPromise: Promise<void> | null = null // Track connection promise

  constructor() {
    this.sessionId = `scanner-${Date.now()}-${Math.random().toString(36).substring(2)}`
  }

  setCallbacks(callbacks: WebSocketCallbacks) {
    this.callbacks = callbacks
  }

  async connect(): Promise<void> {
    // Return existing connection promise if connecting
    if (this.connectionPromise) {
      return this.connectionPromise
    }

    this.connectionPromise = this._connect()
    return this.connectionPromise
  }

  private async _connect(): Promise<void> {
    try {
      const token = this.getStoredToken()
      if (!token) {
        throw new Error('No authorization token available')
      }

      // Validate token before connecting
      if (!this.isTokenValid(token)) {
        throw new Error('Token is invalid or expired')
      }

      this.disconnect()

      console.log('Connecting to WebSocket with token:', token.substring(0, 20) + '...')

      // Add token to URL for handshake authentication
      const wsUrl = `${config.api.baseUrlWithoutVersion}/ws?token=${encodeURIComponent(token)}`

      this.socket = new SockJS(wsUrl, null, {
        transports: ['websocket', 'xhr-streaming', 'xhr-polling']
      })

      this.stompClient = new Client({
        webSocketFactory: () => this.socket!,
        debug: (str) => {
          if (str.toLowerCase().includes('error')) {
            console.error('STOMP Error:', str)
          }
        },
        reconnectDelay: 5000,
        heartbeatIncoming: 4000,
        heartbeatOutgoing: 4000,
        connectHeaders: {
          'Authorization': `Bearer ${token}`,
          'X-Device-Type': 'qr-scanner-web',
          'X-Session-Id': this.sessionId || '',
        },
      })

      this.stompClient.onConnect = (frame) => {
        console.log('WebSocket Connected! Session ID:', this.sessionId)
        this.isConnected = true
        this.connectionPromise = null

        this.subscribeToChannels()
        this.callbacks.onConnected?.(this.sessionId)
      }

      this.stompClient.onDisconnect = () => {
        console.log('WebSocket Disconnected')
        this.isConnected = false
        this.connectionPromise = null
        this.callbacks.onDisconnected?.()
      }

      this.stompClient.onStompError = (frame) => {
        console.error('STOMP Error:', frame)
        this.isConnected = false
        this.connectionPromise = null
        this.callbacks.onDisconnected?.()

        // If it's an authentication error, clear token
        if (frame.headers?.message?.includes('Access Denied') ||
            frame.headers?.message?.includes('Authentication')) {
          this.clearStoredToken()
        }
      }

      this.stompClient.onWebSocketError = (event) => {
        console.error('WebSocket Error:', event)
        this.isConnected = false
        this.connectionPromise = null
      }

      await this.stompClient.activate()

    } catch (error) {
      console.error('Failed to connect to WebSocket:', error)
      this.connectionPromise = null
      throw error
    }
  }

  private subscribeToChannels() {
    if (!this.stompClient || !this.isConnected) return

    try {
      // Unsubscribe first if already subscribed
      if (this.scanResultsSubscription) {
        this.scanResultsSubscription.unsubscribe()
      }
      if (this.errorsSubscription) {
        this.errorsSubscription.unsubscribe()
      }

      this.scanResultsSubscription = this.stompClient.subscribe(
          '/user/queue/scan-results',
          (message: Message) => {
            console.log('Scan result received:', message.body)
            this.callbacks.onScanSuccess?.(message.body)
          }
      )

      this.errorsSubscription = this.stompClient.subscribe(
          '/user/queue/errors',
          (message: Message) => {
            console.log('Error received:', message.body)
            this.callbacks.onScanError?.(message.body)
          }
      )

      console.log('Subscribed to WebSocket channels')
    } catch (error) {
      console.error('Failed to subscribe to channels:', error)
    }
  }

  async sendScanRequest(scanData: ScanRequest): Promise<void> {
    if (!this.isConnected || !this.sessionId) {
      throw new Error('WebSocket not connected')
    }

    try {
      const response = await fetch(`${config.api.baseUrl}/checkin/scan`, {
        method: 'POST',
        headers: {
          'X-Socket-SessionId': this.sessionId,
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getStoredToken()}`,
        },
        body: JSON.stringify(scanData),
      })

      if (!response.ok) {
        if (response.status === 401) {
          this.clearStoredToken()
          throw new Error('Authentication failed. Please login again.')
        }
        throw new Error(`Scan request failed: ${response.status}`)
      }

      console.log('Scan request sent successfully')
    } catch (error) {
      console.error('Failed to send scan request:', error)
      throw error
    }
  }

  private getStoredToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('qr_scanner_access_token')
    }
    return null
  }

  private clearStoredToken(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('qr_scanner_access_token')
    }
  }

  disconnect(): void {
    try {
      this.connectionPromise = null

      if (this.scanResultsSubscription) {
        this.scanResultsSubscription.unsubscribe()
        this.scanResultsSubscription = null
      }

      if (this.errorsSubscription) {
        this.errorsSubscription.unsubscribe()
        this.errorsSubscription = null
      }

      if (this.stompClient) {
        this.stompClient.deactivate()
        this.stompClient = null
      }

      if (this.socket) {
        this.socket.close()
        this.socket = null
      }

      this.isConnected = false
      console.log('WebSocket disconnected')
    } catch (error) {
      console.error('Error disconnecting WebSocket:', error)
    }
  }

  isConnectedToWebSocket(): boolean {
    return this.isConnected && this.stompClient?.connected === true
  }

  getSessionId(): string | null {
    return this.sessionId
  }

  isTokenValid(token?: string): boolean {
    const tokenToValidate = token || this.getStoredToken()
    if (!tokenToValidate) return false

    try {
      const payload = JSON.parse(atob(tokenToValidate.split('.')[1]))
      const currentTime = Math.floor(Date.now() / 1000)
      // Check if token expires in more than 30 seconds
      return payload.exp > (currentTime + 30)
    } catch (error) {
      console.error('Token validation error:', error)
      return false
    }
  }

  async reconnect(): Promise<void> {
    console.log('Forcing WebSocket reconnection...')
    this.disconnect()
    // Small delay before reconnecting
    await new Promise(resolve => setTimeout(resolve, 1000))
    await this.connect()
  }
}

export const webSocketService = new WebSocketService()