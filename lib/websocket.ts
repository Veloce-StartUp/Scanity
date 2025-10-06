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

export interface WebSocketCallbacks {
  onScanSuccess?: (message: string) => void
  onScanError?: (message: string) => void
  onConnected?: (sessionId: string | null) => void
  onDisconnected?: () => void
}

class WebSocketService {
  private stompClient: Client | null = null
  private isConnected = false
  private sessionId: string | null = null
  private callbacks: WebSocketCallbacks = {}
  private scanResultsSubscription: StompSubscription | null = null
  private errorsSubscription: StompSubscription | null = null
  private connectionPromise: Promise<void> | null = null
  private connectionResolve: (() => void) | null = null
  private connectionReject: ((error: Error) => void) | null = null
  private reconnectAttempts = 0
  private maxReconnectDelay = 30000 // 30s max backoff

  constructor() {
    this.generateSessionId()
  }

  private generateSessionId() {
    this.sessionId = `scanner-${Date.now()}-${Math.random().toString(36).substring(2)}`
    console.log('🔑 New session ID generated:', this.sessionId)
  }

  setCallbacks(callbacks: WebSocketCallbacks) {
    this.callbacks = callbacks
  }

  async connect(): Promise<void> {
    // Return existing connection promise if already connecting
    if (this.connectionPromise) {
      console.log('⏳ Already connecting, waiting on promise...')
      return this.connectionPromise
    }

    this.connectionPromise = new Promise((resolve, reject) => {
      this.connectionResolve = resolve
      this.connectionReject = reject

      try {
        const token = this.getStoredToken()
        if (!token) {
          throw new Error('No authorization token available')
        }

        this.disconnect()

        console.log('🔌 Connecting to WebSocket...')

        // Use HTTP URL for SockJS (NOT ws://)
        const wsUrl = `${config.api.baseUrlWithoutVersion}/ws`

        // Force ONLY xhr-polling to avoid any WebSocket/streaming attempts
        const sockJs = new SockJS(wsUrl, null, {
          transports: ['xhr-polling'] // Strict polling only - no WS or streaming
        })

        this.stompClient = new Client({
          // Remove brokerURL when using webSocketFactory
          webSocketFactory: () => sockJs,
          debug: (str) => {
            if (this.isStompError(str)) {
              console.error('❌ STOMP Error:', str)
            } else {
              console.debug('🔧 STOMP Debug:', str)
            }
          },
          reconnectDelay: 5000,
          heartbeatIncoming: 10000, // Increased for stability
          heartbeatOutgoing: 10000,
          connectHeaders: {
            'X-Auth-Token': token,
            'Authorization': `Bearer ${token}`,
            'X-Device-Type': 'qr-scanner-web',
            'X-Session-Id': this.sessionId || '',
          },
          onConnect: (frame) => {
            console.log('✅ WebSocket Connected! Session:', this.sessionId)
            this.isConnected = true
            this.reconnectAttempts = 0 // Reset on success
            this.subscribeToChannels()
            this.callbacks.onConnected?.(this.sessionId)
            this.connectionResolve?.()
            this.clearConnectionPromise()
          },
          onStompError: (frame) => {
            console.error('❌ STOMP Connection Error:', frame)
            this.isConnected = false
            this.callbacks.onDisconnected?.()
            const error = new Error(frame.headers?.message || 'STOMP connection failed')
            this.connectionReject?.(error)
            this.clearConnectionPromise()
          },
          onWebSocketError: (event) => {
            console.error('❌ WebSocket Connection Error:', event)
            this.isConnected = false
            this.callbacks.onDisconnected?.()
            const error = new Error('WebSocket connection failed')
            this.connectionReject?.(error)
            this.clearConnectionPromise()
          },
          onDisconnect: () => {
            console.log('🔌 WebSocket Disconnected')
            this.isConnected = false
            this.callbacks.onDisconnected?.()
            this.clearConnectionPromise()
          }
        })

        this.stompClient.activate()

      } catch (error) {
        console.error('Failed to connect to WebSocket:', error)
        this.connectionReject?.(error as Error)
        this.clearConnectionPromise()
      }
    })

    return this.connectionPromise
  }

  private clearConnectionPromise() {
    this.connectionPromise = null
    this.connectionResolve = null
    this.connectionReject = null
  }

  private isStompError(str: string): boolean {
    const errorIndicators = [
      'ERROR',
      'error:',
      'failed',
      'exception',
      'rejected',
      'unauthorized',
      'access denied'
    ]

    const normalCommands = [
      '>>> CONNECT',
      '>>> SUBSCRIBE',
      '>>> SEND',
      '>>> UNSUBSCRIBE',
      '>>> DISCONNECT',
      '<<< CONNECTED',
      '<<< MESSAGE',
      '<<< ERROR',
      '<<< RECEIPT'
    ]

    const lowerStr = str.toLowerCase()

    const isNormalCommand = normalCommands.some(cmd => str.startsWith(cmd))
    if (isNormalCommand) {
      return str.startsWith('<<< ERROR')
    }

    return errorIndicators.some(indicator => lowerStr.includes(indicator))
  }

  private subscribeToChannels() {
    if (!this.stompClient || !this.isConnected) return

    try {
      // Unsubscribe first if already subscribed
      this.scanResultsSubscription?.unsubscribe()
      this.errorsSubscription?.unsubscribe()

      // Subscribe to scan results
      this.scanResultsSubscription = this.stompClient.subscribe(
          '/user/queue/scan-results',
          (message: Message) => {
            console.log('📨 Scan result received:', message.body)
            this.callbacks.onScanSuccess?.(message.body)
          }
      )

      // Subscribe to errors
      this.errorsSubscription = this.stompClient.subscribe(
          '/user/queue/errors',
          (message: Message) => {
            console.log('❌ Backend error received:', message.body)
            this.callbacks.onScanError?.(message.body)
          }
      )

      console.log('✅ Subscribed to WebSocket channels:')
      console.log('   - /user/queue/scan-results')
      console.log('   - /user/queue/errors')

    } catch (error) {
      console.error('Failed to subscribe to channels:', error)
    }
  }

  async sendScanRequest(scanData: ScanRequest): Promise<void> {
    if (!this.isConnected) {
      throw new Error('WebSocket not connected')
    }

    try {
      const response = await fetch(`${config.api.baseUrl}/checkin/scan`, {
        method: 'POST',
        headers: {
          'X-Socket-SessionId': this.sessionId || '',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getStoredToken()}`,
        },
        body: JSON.stringify(scanData),
      })

      if (!response.ok) {
        throw new Error(`Scan request failed: ${response.status}`)
      }

      console.log('✅ Scan request sent successfully')
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

  disconnect(): void {
    try {
      this.scanResultsSubscription?.unsubscribe()
      this.errorsSubscription?.unsubscribe()

      this.scanResultsSubscription = null
      this.errorsSubscription = null

      if (this.stompClient) {
        this.stompClient.deactivate()
        this.stompClient = null
      }

      this.isConnected = false
      this.clearConnectionPromise()
      console.log('🔌 WebSocket disconnected')
    } catch (error) {
      console.error('Error disconnecting WebSocket:', error)
    }
  }

  isConnectedToWebSocket(): boolean {
    const connected = this.isConnected && this.stompClient?.connected === true
    if (!connected) {
      console.log('🔍 Connection check: isConnected=false or stompClient not active')
    }
    return connected
  }

  async reconnect(): Promise<void> {
    console.log('🔄 Forcing WebSocket reconnection... (attempt', this.reconnectAttempts + 1, ')')
    this.generateSessionId() // Fresh session for clean reconnect
    this.disconnect()

    // Exponential backoff delay
    const delay = Math.min(2000 * Math.pow(2, this.reconnectAttempts), this.maxReconnectDelay)
    await new Promise(resolve => setTimeout(resolve, delay))
    this.reconnectAttempts++

    try {
      await this.connect()
      console.log('✅ Reconnect successful')
    } catch (error) {
      console.error('❌ Reconnect failed:', error)
      // Optionally, throw or let health check retry
    }
  }
}

export const webSocketService = new WebSocketService()