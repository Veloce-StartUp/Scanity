import SockJS from 'sockjs-client'
import { Client, Message, StompSubscription } from '@stomp/stompjs'
import { config } from './config'

export interface ScanRequest {
  userId: number
  hash: string
  deviceId: string
}

export interface ScanResponse {
  success: boolean
  message: string
  data?: any
}

export interface WebSocketCallbacks {
  onScanSuccess?: (message: string) => void
  onScanError?: (message: string) => void
  onConnected?: (sessionId: string) => void
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

  constructor() {
    this.sessionId = `scanner-${Date.now()}-${Math.random().toString(36).substring(2)}`
  }

  setCallbacks(callbacks: WebSocketCallbacks) {
    this.callbacks = callbacks
  }

  async connect(): Promise<void> {
    try {
      const token = this.getStoredToken()
      if (!token) {
        throw new Error('No authorization token available')
      }

      this.disconnect()

      console.log('Connecting to WebSocket with token:', token.substring(0, 20) + '...')

      this.socket = new SockJS(`${config.api.baseUrlWithoutVersion}/ws`, null, {
        transports: ['websocket', 'xhr-streaming', 'xhr-polling']
      })
      
      this.stompClient = new Client({
        webSocketFactory: () => this.socket!,
        debug: (str) => {
          console.log('STOMP Debug:', str)
        },
        reconnectDelay: 5000,
        heartbeatIncoming: 4000,
        heartbeatOutgoing: 4000,
        connectHeaders: {
          'X-Auth-Token': token, // ✅ FIXED: Use the correct header name
          'Authorization': `Bearer ${token}`, // ✅ Keep as backup
          'X-Device-Type': 'qr-scanner-web',
          'X-Session-Id': this.sessionId || '',
        },
      })

      this.stompClient.onConnect = (frame) => {
        console.log('WebSocket Connected! Session ID:', this.sessionId)
        this.isConnected = true
        this.sessionId = frame.headers['user-name'] || this.sessionId || 'unknown'
        
        this.subscribeToChannels()
        this.callbacks.onConnected?.(this.sessionId)
      }

      this.stompClient.onDisconnect = () => {
        console.log('WebSocket Disconnected')
        this.isConnected = false
        this.callbacks.onDisconnected?.()
      }

      this.stompClient.onStompError = (frame) => {
        console.error('STOMP Error:', frame)
        this.isConnected = false
        this.callbacks.onDisconnected?.()
      }

      await this.stompClient.activate()
      
    } catch (error) {
      console.error('Failed to connect to WebSocket:', error)
      throw error
    }
  }

  private subscribeToChannels() {
    if (!this.stompClient || !this.isConnected) return

    try {
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
        console.log('Getting stored token')
        console.log(localStorage.getItem('qr_scanner_access_token'))
      return localStorage.getItem('qr_scanner_access_token')
    }
    return null
  }

  disconnect(): void {
    try {
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
    return this.isConnected
  }

  getSessionId(): string | null {
    return this.sessionId
  }

  isTokenValid(): boolean {
    const token = this.getStoredToken()
    if (!token) return false
    
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      const currentTime = Math.floor(Date.now() / 1000)
      return payload.exp > (currentTime + 300)
    } catch (error) {
      console.error('Token validation error:', error)
      return false
    }
  }

  async reconnect(): Promise<void> {
    console.log('Forcing WebSocket reconnection...')
    await this.connect()
  }
}

export const webSocketService = new WebSocketService()