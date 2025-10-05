"use client"

import {useState, useRef, useEffect, useCallback} from "react"
import { useDispatch, useSelector } from 'react-redux'
import { useAuth, AuthProvider } from "@/hooks/use-auth"
import { LoginForm } from "@/components/auth/login-form"
import { QRScanner } from "@/components/scanner/qr-scanner"
import { ScanResult } from "@/components/scanner/scan-result"
import { ScanHistory } from "@/components/dashboard/scan-history"
import { DashboardStats } from "@/components/dashboard/dashboard-stats"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { User, Settings, Menu, Camera, CheckCircle, RefreshCw } from "lucide-react"
import { useToast } from "@/components/ui/toast-provider"
import { webSocketService, ScanRequest } from "@/lib/websocket"
import { Badge } from "@/components/ui/badge"
import { Footer } from "@/components/ui/footer"
import { VELOCE_BLACK_LOG } from "@/constants/constants";
import { RootState, AppDispatch } from '@/store'
import { fetchScannerStats, incrementScanCount } from '@/store/slices/scannerSlice'
import { fetchScannerHistory, addHistoryItem } from '@/store/slices/historySlice'
import {DecodeQRUser} from "@/lib/types";

function AppContent() {
  const dispatch = useDispatch<AppDispatch>()

  const { stats, loading: statsLoading } = useSelector((state: RootState) => state.scanner)
  const { items: historyItems, loading: historyLoading } = useSelector((state: RootState) => state.history)

  const { user, login, logout, isLoading } = useAuth()
  const { success, info, warning, error: showError } = useToast()
  const [scanResult, setScanResult] = useState<string | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [cameraActive, setCameraActive] = useState(false)
  const [timeLeft, setTimeLeft] = useState(60)
  const [isProcessing, setIsProcessing] = useState(false)
  const [webSocketConnected, setWebSocketConnected] = useState(false)
  const [scanCompleted, setScanCompleted] = useState(false)
  const cameraTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const countdownRef = useRef<NodeJS.Timeout | null>(null)
  const setupCompleteRef = useRef(false)

  useEffect(() => {
    if (user?.userID) {
      dispatch(fetchScannerStats(user.userID))
      dispatch(fetchScannerHistory({ scannerUserId: user.userID, page: 0 }))
    }
  }, [user, dispatch])

  const getResultType = (text: string): string => {
    try {
      const decoded = atob(text)
      const data = JSON.parse(decoded)
      if (data.userID && data.email) return "User QR"
    } catch (e) {
      // Not base64 or not user data, continue with other checks
    }

    if (text.startsWith("http://") || text.startsWith("https://")) return "URL"
    if (text.startsWith("WiFi:")) return "WiFi"
    if (text.includes("@") && text.includes(".")) return "Email"
    if (text.startsWith("tel:") || text.startsWith("sms:")) return "Contact"
    return "Text"
  }

  const handleScan = async (result: string) => {
    console.log("QR Scan detected:", result)

    if (!result || result.trim() === '') {
      showError("Invalid QR code: No hash value found.", "Scan Error")
      return
    }

    if (!webSocketConnected) {
      showError("WebSocket not connected. Please wait for connection.", "Connection Error")
      return
    }

    if (!user) {
      showError("Your session has expired. Please log in again to continue!", "Session Expired")
      return
    }

    try {
      setIsProcessing(true)

      let isUserQR = false
      let userData: DecodeQRUser | null = null

      try {
        const decoded = atob(result)
        const data = JSON.parse(decoded)

        console.log(data)
        if (data?.userID && data?.email) {
          isUserQR = true
          userData = data
        } else {
          throw new Error("Missing required fields")
        }
      } catch (decodeError) {
        console.error("QR decode error:", decodeError)
        showError("Invalid or unreadable QR code. Please try again.", "Scan Error")
        return
      }

      console.log("QR Scan detected:", isUserQR)
      console.log(userData)
      console.log(userData?.userID)

      if (userData?.userID == null){
        throw new Error("Missing user ID in SCAN qr.")
      }

      const today = new Date()
      const localDate = today.toISOString().split('T')[0] // YYYY-MM-DD

      const scanRequest: ScanRequest = {
        userId: userData.userID || 0,
        scannerUserId: user.userID || 0,
        hash: result,
        deviceId: 'qr-scanner-web-001',
        scanDate: localDate,
      }

      await webSocketService.sendScanRequest(scanRequest)

      setScanResult(result)

      setScanCompleted(true)
      setCameraActive(false)
      success("QR code processed successfully!", "Scan Complete")
    } catch (error) {
      console.error("Scan processing error:", error)
      showError("Failed to process scan request. Please try again.", "Scan Error")
      dispatch(incrementScanCount({ successful: false }))
    } finally {
      setIsProcessing(false)
    }
  }

  const handleScanSuccess = (scanData: any) => {
    // This will be called when WebSocket receives success message
    setIsProcessing(false)

    if (scanData.userId) {
      // Add to Redux history
      const newScan = {
        id: Date.now(),
        userId: scanData.userId,
        userName: scanData.userName || 'Unknown User',
        userEmail: scanData.userEmail || '',
        packageId: scanData.packageId,
        packageName: scanData.packageName,
        packageCode: scanData.packageCode,
        eventDay: new Date().toISOString().split('T')[0],
        checkedInAt: new Date().toISOString(),
        lunchCouponIssued: scanData.lunchCouponIssued || false,
        bagIssued: scanData.bagIssued || false,
        status: 'Completed',
        scannerName: user?.displayName || 'Unknown'
      }
      dispatch(addHistoryItem(newScan))

      // Update stats
      dispatch(incrementScanCount({
        successful: true,
        packageCode: scanData.packageCode
      }))
    }
  }

  const resetCameraTimeout = () => {
    // Clear existing timeout and countdown
    if (cameraTimeoutRef.current) {
      clearTimeout(cameraTimeoutRef.current)
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current)
    }

    // Reset countdown to 60 seconds
    setTimeLeft(60)

    // Start countdown timer
    countdownRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    // Set new timeout for 1 minute
    cameraTimeoutRef.current = setTimeout(() => {
      setCameraActive(false)
      setTimeLeft(0)
      if (countdownRef.current) clearInterval(countdownRef.current)
      // Only show timeout message if camera was active
      if (cameraActive) {
        info("Camera deactivated due to inactivity", "Camera Timeout")
      }
    }, 60000) // 1 minute
  }

  const enableCamera = () => {
    setCameraActive(true)
    setScanCompleted(false)
    setScanResult(null)
    resetCameraTimeout()
    success("Camera activated! Ready to scan.", "Camera Enabled")
  }

  const startNewScan = () => {
    setScanCompleted(false)
    setScanResult(null)
    setCameraActive(true)
    resetCameraTimeout()
  }

  const completeProcess = () => {
    setScanCompleted(false)
    setScanResult(null)
    setCameraActive(false)
  }

  // Start camera timeout when component mounts
  useEffect(() => {
    resetCameraTimeout()

    // Cleanup timeout and countdown on unmount
    return () => {
      if (cameraTimeoutRef.current) {
        clearTimeout(cameraTimeoutRef.current)
      }
      if (countdownRef.current) {
        clearInterval(countdownRef.current)
      }
    }
  }, [])

  // WebSocket connection and setup
  useEffect(() => {
    // Prevent multiple setups
    if (setupCompleteRef.current || !user) {
      return
    }

    const setupWebSocket = async () => {
      try {
        // Set callbacks first
        webSocketService.setCallbacks({
          onConnected: (sessionId) => {
            console.log('WebSocket connected with session:', sessionId)
            setWebSocketConnected(true)
            if (!webSocketConnected) {
              success('WebSocket connected successfully', 'Connection Established')
            }
          },
          onDisconnected: () => {
            console.log('WebSocket disconnected')
            setWebSocketConnected(false)
            warning('WebSocket disconnected', 'Connection Lost')
          },
          onScanSuccess: (message) => {
            console.log('Scan success received:', message)
            try {
              const scanData = JSON.parse(message)
              handleScanSuccess(scanData)
            } catch (e) {
              console.error('Failed to parse scan success message:', e)
            }
          },
          onScanError: (message) => {
            console.log('Scan error received:', message)
            setIsProcessing(false)
            dispatch(incrementScanCount({ successful: false }))
            showError(message, 'Scan Error')
          },
          onItemIssuanceSuccess: (message) => {
            console.log('Item issuance success:', message)
            try {
              const issuanceData = JSON.parse(message)
              handleItemIssuanceSuccess(issuanceData)
            } catch (e) {
              console.error('Failed to parse item issuance message:', e)
            }
          },
          onItemIssuanceError: (message) => {
            console.log('Item issuance error:', message)
            showError(message, 'Issuance Error')
          }
        })

        // Connect only if not already connected
        if (!webSocketService.isConnectedToWebSocket()) {
          await webSocketService.connect()
        }

        setupCompleteRef.current = true

      } catch (error) {
        console.error('Failed to setup WebSocket:', error)
        if (error instanceof Error && error.message.includes('Access Denied')) {
          showError('Authentication failed. Please login again.', 'Access Denied')
          logout()
        } else {
          showError('Failed to connect to WebSocket', 'Connection Error')
        }
      }
    }

    setupWebSocket()

    // Cleanup function
    return () => {
      setupCompleteRef.current = false
    }
  }, [user])

  // Periodic token validation and WebSocket health check
  // useEffect(() => {
  //   if (!user || !webSocketConnected) return
  //
  //   const healthCheckInterval = setInterval(async () => {
  //     try {
  //       // Check if token is still valid
  //       if (!webSocketService.isTokenValid()) {
  //         console.log('Token expired, attempting to reconnect...')
  //         await webSocketService.reconnect()
  //       }
  //     } catch (error) {
  //       console.error('Health check failed:', error)
  //     }
  //   }, 30000) // Check every 30 seconds
  //
  //   return () => clearInterval(healthCheckInterval)
  // }, [user, webSocketConnected])

  const handleItemIssuanceSuccess = useCallback((issuanceData: any) => {
    if (!issuanceData.userId) return

    // Update Redux history with the new item issuance status
    const updatedScan = {
      id: Date.now(),
      userId: issuanceData.userId,
      userName: issuanceData.userName || 'Unknown User',
      userEmail: issuanceData.userEmail || '',
      packageId: issuanceData.packageId,
      packageName: issuanceData.packageName,
      packageCode: issuanceData.packageCode,
      eventDay: new Date().toISOString().split('T')[0],
      checkedInAt: new Date().toISOString(),
      lunchCouponIssued: issuanceData.lunchCouponIssued || false,
      bagIssued: issuanceData.bagIssued || false,
      status: 'Completed',
      scannerName: user?.displayName || 'Unknown'
    }

    dispatch(addHistoryItem(updatedScan))

    // Refresh stats but don't wait for it
    if (user?.userID) {
      dispatch(fetchScannerStats(user.userID))
    }

    const itemType = issuanceData.itemType === 'LUNCH_COUPON' ? 'Lunch Coupon' : 'Conference Bag'
    success(`${itemType} issued successfully!`, 'Item Updated')
  }, [user, dispatch, success])

  const handleNewScan = () => {
    setScanResult(null)
    setScanCompleted(false)
    setCameraActive(true)
    resetCameraTimeout()
  }

  const handleScanResultClose = () => {
    setScanResult(null)
    setScanCompleted(false)
    setCameraActive(false)
  }

  const handleItemIssued = () => {
    // Refetch history to get updated item issuance status
    if (user?.userID) {
      dispatch(fetchScannerHistory({ scannerUserId: user.userID, page: 0 }))
    }
  }

  const handleClearHistory = () => {
    // This would need to be implemented in the history slice
    info("Clear history functionality would be implemented here", "History")
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completed':
        return 'bg-green-100 text-green-800'
      case 'failed':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (!user) {
    return <LoginForm onLogin={login} isLoading={isLoading} />
  }

  const getWebSocketStatus = () => {
    if (webSocketService.isConnectedToWebSocket()) {
      return { connected: true, text: 'Connected' }
    } else if (setupCompleteRef.current) {
      return { connected: false, text: 'Reconnecting...' }
    } else {
      return { connected: false, text: 'Disconnected' }
    }
  }

  const wsStatus = getWebSocketStatus()

  return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="border-b bg-card sticky top-0 z-40">
          <div className="container mx-auto px-4 py-3 sm:py-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="bg-white p-1 rounded-md shadow-sm">
                    <img
                        src={VELOCE_BLACK_LOG}
                        alt="VELOCE Logo"
                        className="h-8 w-8 sm:h-10 sm:w-10 object-contain"
                    />
                  </div>
                  <h1 className="text-lg sm:text-xl font-bold text-primary">SCANITY</h1>
                </div>

                {stats && (
                    <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground">
                      <span>Scans Today: {stats.totalScans}</span>
                      <span>•</span>
                      <span>Success: {stats.successRate}%</span>
                      {stats.lastScanTime && (
                          <>
                            <span>•</span>
                            <span>Last: {new Date(stats.lastScanTime).toLocaleTimeString()}</span>
                          </>
                      )}
                    </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                {/* Stats Refresh Button */}
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => user?.userID && dispatch(fetchScannerStats(user.userID))}
                    disabled={statsLoading}
                    className="gap-2 hidden sm:flex"
                >
                  <RefreshCw className={`h-4 w-4 ${statsLoading ? 'animate-spin' : ''}`} />
                  Refresh Stats
                </Button>

                {/* Desktop Navigation */}
                <div className="hidden md:flex items-center gap-2">
                  <ScanHistory history={historyItems} onClearHistory={handleClearHistory} />
                  <Button variant="ghost" size="sm" className="gap-2 text-primary hover:text-primary hover:bg-primary/10">
                    <Settings className="h-4 w-4" />
                    Settings
                  </Button>
                  <Button variant="ghost" size="sm" className="gap-2 text-primary hover:text-primary hover:bg-primary/10">
                    <User className="h-4 w-4" />
                    <span className="hidden lg:inline">{user.displayName}</span>
                  </Button>
                  <Button
                      variant="outline"
                      size="sm"
                      onClick={logout}
                      className="border-primary text-primary hover:bg-primary hover:text-white bg-transparent"
                  >
                    Sign Out
                  </Button>
                </div>

                {/* Mobile Menu Button */}
                <div className="md:hidden">
                  <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                      className="text-primary"
                  >
                    <Menu className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Mobile Stats */}
            {stats && (
                <div className="md:hidden mt-3 pt-3 border-t">
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>Scans: {stats.totalScans}</span>
                    <span>Success: {stats.successRate}%</span>
                    {stats.lastScanTime && (
                        <span>Last: {new Date(stats.lastScanTime).toLocaleTimeString()}</span>
                    )}
                  </div>
                </div>
            )}

            {/* Mobile Navigation */}
            {mobileMenuOpen && (
                <div className="md:hidden mt-4 pt-4 border-t space-y-2">
                  <div className="flex items-center gap-2 px-2 py-1">
                    <User className="h-4 w-4 text-primary" />
                    <span className="text-sm text-primary">{user.displayName}</span>
                  </div>
                  <ScanHistory history={historyItems} onClearHistory={handleClearHistory} />
                  <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-primary hover:bg-primary/10">
                    <Settings className="h-4 w-4" />
                    Settings
                  </Button>
                  <Button
                      variant="outline"
                      size="sm"
                      onClick={logout}
                      className="w-full bg-transparent border-primary text-primary hover:bg-primary hover:text-white"
                  >
                    Sign Out
                  </Button>
                </div>
            )}
          </div>
        </header>

        <main className="flex-1 container mx-auto px-4 py-4 sm:py-8">
          <div className="max-w-6xl mx-auto">
            <DashboardStats stats={stats} history={historyItems} />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
              <div className="order-1">
                <Card className="overflow-hidden shadow-lg">
                  <CardHeader className="pb-4 bg-gradient-to-r from-primary/5 to-secondary/5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <Camera className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-lg sm:text-xl text-primary">QR Code Scanner</CardTitle>
                          <p className="text-xs text-muted-foreground mt-1">
                            {cameraActive ? 'Camera Active' : 'Camera Inactive'}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {/* WebSocket Status */}
                        <div className="flex items-center gap-2">
                          <div className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
                              wsStatus.connected ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            <div className={`w-2 h-2 rounded-full ${
                                wsStatus.connected ? 'bg-green-500' : 'bg-yellow-500'
                            }`}></div>
                            {wsStatus.text}
                          </div>

                          {!wsStatus.connected && (
                              <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={async () => {
                                    try {
                                      setupCompleteRef.current = false
                                      await webSocketService.reconnect()
                                    } catch (error) {
                                      showError('Failed to reconnect', 'Connection Error')
                                    }
                                  }}
                                  className="text-xs h-6 px-2"
                              >
                                Reconnect
                              </Button>
                          )}
                        </div>

                        {cameraActive && (
                            <div className="flex items-center gap-2">
                              <div className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                                {timeLeft}s
                              </div>
                              <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={resetCameraTimeout}
                                  className="text-xs"
                              >
                                Reset
                              </Button>
                            </div>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    {cameraActive ? (
                        <div className="relative">
                          {isProcessing && (
                              <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
                                <div className="bg-white p-4 rounded-lg flex items-center gap-3 shadow-lg">
                                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                                  <span className="text-sm font-medium">Processing QR Code...</span>
                                </div>
                              </div>
                          )}
                          <QRScanner
                              onScan={handleScan}
                              onError={(error) => console.error("Scanner error:", error)}
                              autoStart={true}
                          />
                        </div>
                    ) : scanCompleted ? (
                        <div className="text-center py-12 px-4">
                          <div className="p-4 bg-green-100 rounded-full w-fit mx-auto mb-4">
                            <CheckCircle className="h-12 w-12 text-green-600" />
                          </div>
                          <h3 className="text-lg font-semibold text-green-800 mb-2">Scan Completed!</h3>
                          <p className="text-sm text-muted-foreground mb-6">
                            QR code has been processed successfully. Complete the process to scan another code.
                          </p>
                          <div className="flex flex-col sm:flex-row gap-2 justify-center">
                            <Button onClick={completeProcess} variant="outline" className="gap-2">
                              <CheckCircle className="h-4 w-4" />
                              Complete Process
                            </Button>
                            <Button onClick={startNewScan} className="gap-2">
                              <Camera className="h-4 w-4" />
                              Scan Another
                            </Button>
                          </div>
                        </div>
                    ) : (
                        <div className="text-center py-12 px-4">
                          <div className="p-4 bg-muted rounded-full w-fit mx-auto mb-4">
                            <Camera className="h-12 w-12 text-muted-foreground" />
                          </div>
                          <h3 className="text-lg font-semibold text-muted-foreground mb-2">Ready to Scan</h3>
                          <p className="text-sm text-muted-foreground mb-6">
                            Click the button below to activate the camera and start scanning QR codes.
                          </p>
                          <Button onClick={enableCamera} className="gap-2 text-lg px-8 py-3">
                            <Camera className="h-5 w-5" />
                            Scan QR Code
                          </Button>
                        </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="order-2">
                <Card>
                  <CardHeader className="pb-4">
                    <CardTitle className="text-lg sm:text-xl text-primary">Recent Scans</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {historyItems.length === 0 ? (
                        <div className="text-center py-6 sm:py-8 text-muted-foreground">
                          <div className="p-4 bg-white rounded-full w-fit mx-auto mb-4 shadow-sm">
                            <img
                                src={VELOCE_BLACK_LOG}
                                alt="VELOCE Logo"
                                className="h-12 w-12 sm:h-16 sm:w-16 object-contain opacity-60"
                            />
                          </div>
                          <p className="text-sm sm:text-base">No scans yet. Start scanning QR codes!</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                          {historyItems.slice(0, 5).map((scan, index) => (
                              <div key={scan.id || index} className="p-3 bg-muted rounded-lg border">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                              <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded font-medium">
                                {scan.packageName}
                              </span>
                                    <Badge className={`text-xs ${getStatusColor(scan.status)}`}>
                                      {scan.status}
                                    </Badge>
                                  </div>
                                  <span className="text-xs text-muted-foreground">
                              {new Date(scan.checkedInAt).toLocaleTimeString()}
                            </span>
                                </div>
                                <p className="text-xs sm:text-sm font-medium text-card-foreground truncate">
                                  {scan.userName}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {scan.userEmail}
                                </p>
                                <div className="flex gap-2 mt-2">
                                  <Badge variant={scan.lunchCouponIssued ? "default" : "secondary"} className="text-xs">
                                    {scan.lunchCouponIssued ? "Lunch ✓" : "Lunch Pending"}
                                  </Badge>
                                  <Badge variant={scan.bagIssued ? "default" : "secondary"} className="text-xs">
                                    {scan.bagIssued ? "Bag ✓" : "Bag Pending"}
                                  </Badge>
                                </div>
                              </div>
                          ))}
                          {historyItems.length > 5 && (
                              <div className="text-center pt-2">
                                <p className="text-xs sm:text-sm text-muted-foreground">
                                  +{historyItems.length - 5} more in history
                                </p>
                              </div>
                          )}
                        </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </main>

        <Footer />

        {/* Scan Result Modal for Item Issuance */}
        {scanResult && (
            <ScanResult
                result={scanResult}
                onClose={handleScanResultClose}
                onNewScan={handleNewScan}
                onItemIssued={handleItemIssued}
            />
        )}
      </div>
  )
}

export default function Page() {
  return (
      <AuthProvider>
        <AppContent />
      </AuthProvider>
  )
}