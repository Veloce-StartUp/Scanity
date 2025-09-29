"use client"

import { useState, useRef, useEffect } from "react"
import { useAuth, AuthProvider } from "@/hooks/use-auth"
import { LoginForm } from "@/components/auth/login-form"
import { QRScanner } from "@/components/scanner/qr-scanner"
import { ScanResult } from "@/components/scanner/scan-result"
import { ScanHistory } from "@/components/dashboard/scan-history"
import { DashboardStats } from "@/components/dashboard/dashboard-stats"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { User, Settings, Menu, Camera, CheckCircle } from "lucide-react"
import { ScanHistoryItem } from "@/lib/types"
import { useToast } from "@/components/ui/toast-provider"
import { webSocketService, ScanRequest } from "@/lib/websocket"
import { Badge } from "@/components/ui/badge"
import { UserData } from "@/lib/types"
import { Footer } from "@/components/ui/footer"

function AppContent() {
  const { user, login, logout, isLoading } = useAuth()
  const { success, info, warning, error: showError } = useToast()
  const [scanResult, setScanResult] = useState<string | null>(null)
  const [scanHistory, setScanHistory] = useState<ScanHistoryItem[]>([])
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [cameraActive, setCameraActive] = useState(false)
  const [timeLeft, setTimeLeft] = useState(60)
  const [isProcessing, setIsProcessing] = useState(false)
  const [webSocketConnected, setWebSocketConnected] = useState(false)
  const [scanCompleted, setScanCompleted] = useState(false)
  const cameraTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const countdownRef = useRef<NodeJS.Timeout | null>(null)

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
    
    // Validate hash value
    if (!result || result.trim() === '') {
      showError("Invalid QR code: No hash value found", "Scan Error")
      return
    }

    if (!webSocketConnected) {
      showError("WebSocket not connected. Please wait for connection.", "Connection Error")
      return
    }

    try {
      setIsProcessing(true)
      // Only show processing message for non-user QR codes
      try {
        const decoded = atob(result)
        const data = JSON.parse(decoded)
        if (data.userID && data.email) {
          // It's a user QR code, don't show processing message
          setIsProcessing(false)
          setScanResult(result)
          setScanCompleted(true)
          setCameraActive(false)
          return
        }
      } catch (e) {
        // Not a user QR code, show processing message
        info("Processing QR code...", "Scan Processing")
      }

      // Create scan request
      const scanRequest: ScanRequest = {
        userId: user?.userID || 0,
        hash: result,
        deviceId: 'qr-scanner-web-001'
      }

      // Send scan request via WebSocket
      await webSocketService.sendScanRequest(scanRequest)
      
      // Add to scan history for non-user QR codes
      const newScan: ScanHistoryItem = {
        result,
        timestamp: new Date(),
        type: getResultType(result),
        scanStatus: 'completed'
      }
      setScanHistory((prev) => [newScan, ...prev])
      
      // Mark scan as completed and disable camera
      setScanCompleted(true)
      setCameraActive(false)
      setIsProcessing(false)
      
      // Show success message only for non-user QR codes
      success("QR code processed successfully!", "Scan Complete")
      
    } catch (error) {
      console.error("Scan processing error:", error)
      setIsProcessing(false)
      showError("Failed to process scan request", "Scan Error")
      
      // Add failed scan to history
      const failedScan: ScanHistoryItem = {
        result,
        timestamp: new Date(),
        type: getResultType(result),
        scanStatus: 'failed',
        errorMessage: 'Failed to process scan request'
      }
      setScanHistory((prev) => [failedScan, ...prev])
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
          return 0
        }
        return prev - 1
      })
    }, 1000)
    
    // Set new timeout for 1 minute
    cameraTimeoutRef.current = setTimeout(() => {
      setCameraActive(false)
      setTimeLeft(0)
      // Only show timeout message if camera was active
      if (cameraActive) {
        info("Camera deactivated due to inactivity", "Camera Timeout")
      }
    }, 60000) // 1 minute
  }

  const enableCamera = () => {
    setCameraActive(true)
    setScanCompleted(false)
    resetCameraTimeout()
    success("Camera activated! Ready to scan.", "Camera Enabled")
  }

  const startNewScan = () => {
    setScanCompleted(false)
    setCameraActive(true)
    resetCameraTimeout()
    // Don't show toast for new scan, just enable camera
  }

  const completeProcess = () => {
    setScanCompleted(false)
    setCameraActive(false)
    // Don't show toast for process completion
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
    const setupWebSocket = async () => {
      try {
        // Set up WebSocket callbacks
        webSocketService.setCallbacks({
          onConnected: (sessionId) => {
            console.log('WebSocket connected with session:', sessionId)
            setWebSocketConnected(true)
            // Only show connection message once
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
            setIsProcessing(false)
            // Don't show duplicate success messages
          },
          onScanError: (message) => {
            console.log('Scan error received:', message)
            setIsProcessing(false)
            showError(message, 'Scan Error')
          },
        })

        // Connect to WebSocket
        await webSocketService.connect()
      } catch (error) {
        console.error('Failed to setup WebSocket:', error)
        showError('Failed to connect to WebSocket', 'Connection Error')
      }
    }

    if (user) {
      setupWebSocket()
    }

    // Cleanup WebSocket on unmount
    return () => {
      webSocketService.disconnect()
    }
  }, [user])

  // Periodic token validation and WebSocket health check
  useEffect(() => {
    if (!user || !webSocketConnected) return

    const healthCheckInterval = setInterval(async () => {
      try {
        // Check if token is still valid
        if (!webSocketService.isTokenValid()) {
          console.log('Token expired, attempting to reconnect...')
          await webSocketService.reconnect()
        }
      } catch (error) {
        console.error('Health check failed:', error)
      }
    }, 30000) // Check every 30 seconds

    return () => clearInterval(healthCheckInterval)
  }, [user, webSocketConnected])

  const handleNewScan = () => {
    setScanResult(null)
    setScanCompleted(false)
    setCameraActive(true)
    resetCameraTimeout()
    // Don't show toast for new scan
  }

  const handleScanResultClose = () => {
    setScanResult(null)
    setScanCompleted(false)
    setCameraActive(false)
    // Don't show toast for closing scan result
  }

  const handleItemIssued = (userData: UserData) => {
    // Update scan history with item issuance details
    const updatedScan = scanHistory.find(scan => 
      scan.result === scanResult && scan.type === "User QR"
    )
    
    if (updatedScan) {
      const updatedHistory = scanHistory.map(scan => 
        scan === updatedScan 
          ? {
              ...scan,
              userData,
              itemsIssued: {
                lunchCoupon: userData.lunchCouponIssued || false,
                bag: userData.bagIssued || false
              },
              scanStatus: 'completed' as const
            }
          : scan
      )
      setScanHistory(updatedHistory)
    }
  }

  const handleClearHistory = () => {
    setScanHistory([])
    info("Scan history cleared", "History")
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
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

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-card sticky top-0 z-40">
        <div className="container mx-auto px-4 py-3 sm:py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="bg-white p-1 rounded-md shadow-sm">
                <img
                  src="https://res.cloudinary.com/djxtjt1uf/image/upload/v1754552918/Veloce_logo_yrybjn.png"
                  alt="VELOCE Logo"
                  className="h-8 w-8 sm:h-10 sm:w-10 object-contain"
                />
              </div>
              <h1 className="text-lg sm:text-xl font-bold text-primary">SCANITY</h1>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-2">
              <ScanHistory history={scanHistory} onClearHistory={handleClearHistory} />
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

          {/* Mobile Navigation */}
          {mobileMenuOpen && (
            <div className="md:hidden mt-4 pt-4 border-t space-y-2">
              <div className="flex items-center gap-2 px-2 py-1">
                <User className="h-4 w-4 text-primary" />
                <span className="text-sm text-primary">{user.displayName}</span>
              </div>
              <ScanHistory history={scanHistory} onClearHistory={handleClearHistory} />
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
          <DashboardStats history={scanHistory} />

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
                          webSocketConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          <div className={`w-2 h-2 rounded-full ${
                            webSocketConnected ? 'bg-green-500' : 'bg-red-500'
                          }`}></div>
                          {webSocketConnected ? 'Connected' : 'Disconnected'}
                        </div>
                        
                        {!webSocketConnected && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              try {
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
                  {scanHistory.length === 0 ? (
                    <div className="text-center py-6 sm:py-8 text-muted-foreground">
                      <div className="p-4 bg-white rounded-full w-fit mx-auto mb-4 shadow-sm">
                        <img
                          src="https://res.cloudinary.com/djxtjt1uf/image/upload/v1754552918/Veloce_logo_yrybjn.png"
                          alt="VELOCE Logo"
                          className="h-12 w-12 sm:h-16 sm:w-16 object-contain opacity-60"
                        />
                      </div>
                      <p className="text-sm sm:text-base">No scans yet. Start scanning QR codes!</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {scanHistory.slice(0, 5).map((scan, index) => (
                        <div key={index} className="p-3 bg-muted rounded-lg border">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded font-medium">
                                {scan.type}
                              </span>
                              <Badge className={`text-xs ${getStatusColor(scan.scanStatus)}`}>
                                {scan.scanStatus}
                              </Badge>
                            </div>
                            <span className="text-xs text-muted-foreground">{scan.timestamp.toLocaleTimeString()}</span>
                          </div>
                          <p className="text-xs sm:text-sm font-mono text-card-foreground truncate">
                            {scan.type === "User QR" && scan.userData 
                              ? `${scan.userData.displayName || `${scan.userData.firstName} ${scan.userData.lastName}`}`
                              : scan.result
                            }
                          </p>
                          {scan.itemsIssued && (
                            <div className="flex gap-2 mt-2">
                              <Badge variant={scan.itemsIssued.lunchCoupon ? "default" : "secondary"} className="text-xs">
                                {scan.itemsIssued.lunchCoupon ? "Lunch ✓" : "Lunch Pending"}
                              </Badge>
                              <Badge variant={scan.itemsIssued.bag ? "default" : "secondary"} className="text-xs">
                                {scan.itemsIssued.bag ? "Bag ✓" : "Bag Pending"}
                              </Badge>
                            </div>
                          )}
                        </div>
                      ))}
                      {scanHistory.length > 5 && (
                        <div className="text-center pt-2">
                          <p className="text-xs sm:text-sm text-muted-foreground">
                            +{scanHistory.length - 5} more in history
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

      {/* Footer */}
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
