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
import { User, Settings, Menu, Camera, CheckCircle, RefreshCw, LogOut } from "lucide-react"
import { useToast } from "@/components/ui/toast-provider"
import { webSocketService, ScanRequest } from "@/lib/websocket"
import { Badge } from "@/components/ui/badge"
import { Footer } from "@/components/ui/footer"
import { VELOCE_BLACK_LOG } from "@/constants/constants";
import { RootState, AppDispatch } from '@/store'
import { fetchScannerStats, incrementScanCount } from '@/store/slices/scannerSlice'
import { fetchScannerHistory, addHistoryItem } from '@/store/slices/historySlice'
import { DecodeQRUser } from "@/lib/types";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"

// Cache for processed QR codes to prevent duplicate scans
const processedQRCache = new Set<string>();
const CACHE_CLEAR_INTERVAL = 30000; // Clear cache every 30 seconds

function AppContent() {
  const dispatch = useDispatch<AppDispatch>()

  const { stats, loading: statsLoading } = useSelector((state: RootState) => state.scanner)
  const { items: historyItems, loading: historyLoading } = useSelector((state: RootState) => state.history)

  const { user, login, logout, isLoading } = useAuth()
  const { success, info, warning, error: showError } = useToast()
  const [scanResult, setScanResult] = useState<string | null>(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [timeLeft, setTimeLeft] = useState(60)
  const [isProcessing, setIsProcessing] = useState(false)
  const [webSocketConnected, setWebSocketConnected] = useState(false)
  const [scanCompleted, setScanCompleted] = useState(false)
  const [lastScannedQR, setLastScannedQR] = useState<string | null>(null)
  const cameraTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const countdownRef = useRef<NodeJS.Timeout | null>(null)
  const setupCompleteRef = useRef(false)
  const cacheClearRef = useRef<NodeJS.Timeout | null>(null)
  const errorToastShownRef = useRef(false); // Prevent duplicate error toasts

  // Clear QR cache periodically
  useEffect(() => {
    cacheClearRef.current = setInterval(() => {
      processedQRCache.clear();
      console.log('QR cache cleared');
    }, CACHE_CLEAR_INTERVAL);

    return () => {
      if (cacheClearRef.current) clearInterval(cacheClearRef.current);
    }
  }, []);

  useEffect(() => {
    if (user?.userID) {
      dispatch(fetchScannerStats(user.userID))
      dispatch(fetchScannerHistory({ scannerUserId: user.userID, page: 0 }))
    }
  }, [user, dispatch])

  // Memoized callbacks that don't change
  const handleScanSuccess = useCallback((scanData: any) => {
    console.log("Processing scan success:", scanData)
    setIsProcessing(false)
    setScanCompleted(true)
    setCameraActive(false)
    errorToastShownRef.current = false; // Reset error flag on success

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

      success("QR code processed successfully!", "Scan Complete")
    }
  }, [user, dispatch, success])

  const handleScanError = useCallback((errorMessage: string) => {
    console.log("Scan error received:", errorMessage)
    setIsProcessing(false)
    dispatch(incrementScanCount({ successful: false }))

    // Remove from cache on error
    if (lastScannedQR) {
      processedQRCache.delete(lastScannedQR);
    }

    // Prevent duplicate error toasts
    if (!errorToastShownRef.current) {
      errorToastShownRef.current = true;
      try {
        const errorData = JSON.parse(errorMessage)
        showError(errorData.message || 'Scan failed', 'Scan Error')
      } catch (e) {
        showError(errorMessage, 'Scan Error')
      }

      // Reset error flag after a delay
      setTimeout(() => {
        errorToastShownRef.current = false;
      }, 3000);
    }
  }, [lastScannedQR, dispatch, showError])

  // WebSocket connection management
  const setupWebSocketCallbacks = useCallback(() => {
    webSocketService.setCallbacks({
      onConnected: (sessionId) => {
        console.log('WebSocket connected with session:', sessionId)
        setWebSocketConnected(true)
        setupCompleteRef.current = true
        errorToastShownRef.current = false
        success('WebSocket connected successfully', 'Connection Established')
      },
      onDisconnected: () => {
        console.log('WebSocket disconnected')
        setWebSocketConnected(false)
        setupCompleteRef.current = false
        if (!errorToastShownRef.current) {
          errorToastShownRef.current = true
          warning('WebSocket disconnected', 'Connection Lost')

          // Reset error flag after a delay
          setTimeout(() => {
            errorToastShownRef.current = false;
          }, 5000);
        }
      },
      onScanSuccess: (message) => {
        console.log('Scan success received:', message)
        try {
          const scanData = JSON.parse(message)
          handleScanSuccess(scanData)
        } catch (e) {
          console.error('Failed to parse scan success message:', e)
          if (!errorToastShownRef.current) {
            errorToastShownRef.current = true
            showError('Invalid scan response format', 'Scan Error')
            setTimeout(() => {
              errorToastShownRef.current = false;
            }, 3000);
          }
        }
      },
      onScanError: (errorMessage) => {
        handleScanError(errorMessage)
      }
    })
  }, [handleScanSuccess, handleScanError, success, warning, showError])

  // WebSocket setup - only runs when user changes
  useEffect(() => {
    if (!user) {
      return
    }

    const initializeWebSocket = async () => {
      try {
        setupWebSocketCallbacks()

        // Only connect if not already connected
        if (!webSocketService.isConnectedToWebSocket()) {
          await webSocketService.connect()
        } else {
          // If already connected, just update the state
          setWebSocketConnected(true)
          setupCompleteRef.current = true
        }
      } catch (error) {
        console.error('Failed to setup WebSocket:', error)
        setupCompleteRef.current = false
        if (error instanceof Error && error.message.includes('Access Denied')) {
          showError('Authentication failed. Please login again.', 'Access Denied')
          logout()
        } else {
          showError('Failed to connect to WebSocket', 'Connection Error')
        }
      }
    }

    initializeWebSocket()

    // Cleanup function
    return () => {
      // Don't disconnect WebSocket here to maintain connection during app usage
    }
  }, [user, setupWebSocketCallbacks, logout, showError])

  // WebSocket health check and auto-reconnect
  useEffect(() => {
    if (!user || !setupCompleteRef.current) return

    const healthCheckInterval = setInterval(async () => {
      if (!webSocketService.isConnectedToWebSocket() && setupCompleteRef.current) {
        console.log('WebSocket disconnected, attempting to reconnect...')
        try {
          await webSocketService.reconnect()
        } catch (error) {
          console.error('WebSocket reconnection failed:', error)
        }
      }
    }, 10000) // Check every 10 seconds

    return () => clearInterval(healthCheckInterval)
  }, [user])

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

    // Basic validation
    if (!result || result.trim() === '') {
      if (!errorToastShownRef.current) {
        errorToastShownRef.current = true
        showError("Invalid QR code: No hash value found.", "Scan Error")
        setTimeout(() => {
          errorToastShownRef.current = false
        }, 3000)
      }
      return
    }

    // Check if this QR was recently processed
    if (processedQRCache.has(result)) {
      console.log("QR code already processed recently, skipping...")
      if (!errorToastShownRef.current) {
        errorToastShownRef.current = true
        info("This QR code was already scanned recently", "Duplicate Scan")
        setTimeout(() => {
          errorToastShownRef.current = false
        }, 3000)
      }
      return
    }

    if (!webSocketConnected) {
      if (!errorToastShownRef.current) {
        errorToastShownRef.current = true
        showError("WebSocket not connected. Please wait for connection.", "Connection Error")
        setTimeout(() => {
          errorToastShownRef.current = false
        }, 3000)
      }
      return
    }

    if (!user) {
      if (!errorToastShownRef.current) {
        errorToastShownRef.current = true
        showError("Your session has expired. Please log in again to continue!", "Session Expired")
        setTimeout(() => {
          errorToastShownRef.current = false
        }, 3000)
      }
      return
    }

    // Prevent multiple simultaneous processing
    if (isProcessing) {
      console.log("Already processing a scan, skipping...")
      return
    }

    try {
      setIsProcessing(true)
      setLastScannedQR(result)
      errorToastShownRef.current = false

      let userData: DecodeQRUser | null = null

      try {
        const decoded = atob(result)
        const data = JSON.parse(decoded)

        if (data?.userID && data?.email) {
          userData = data
        } else {
          throw new Error("Invalid QR code format")
        }
      } catch (decodeError) {
        console.error("QR decode error:", decodeError)
        if (!errorToastShownRef.current) {
          errorToastShownRef.current = true
          showError("Invalid or unreadable QR code. Please try again.", "Scan Error")
          setTimeout(() => {
            errorToastShownRef.current = false
          }, 3000)
        }
        setIsProcessing(false)
        return
      }

      if (!userData?.userID) {
        throw new Error("Missing user ID in QR code.")
      }

      const today = new Date()
      const localDate = today.toISOString().split('T')[0]

      const scanRequest: ScanRequest = {
        userId: userData.userID,
        scannerUserId: user.userID || 0,
        hash: result,
        deviceId: 'qr-scanner-web-001',
        scanDate: localDate,
      }

      console.log("Sending scan request:", scanRequest)

      // Add to cache immediately to prevent duplicate scans
      processedQRCache.add(result);

      await webSocketService.sendScanRequest(scanRequest)

      setScanResult(result)
      setCameraActive(false)
    } catch (error) {
      console.error("Scan processing error:", error)
      if (!errorToastShownRef.current) {
        errorToastShownRef.current = true
        showError("Failed to process scan request. Please try again.", "Scan Error")
        setTimeout(() => {
          errorToastShownRef.current = false
        }, 3000)
      }
      dispatch(incrementScanCount({ successful: false }))
      setIsProcessing(false)

      // Remove from cache if failed
      if (lastScannedQR) {
        processedQRCache.delete(lastScannedQR);
      }
    }
  }

  const resetCameraTimeout = () => {
    if (cameraTimeoutRef.current) {
      clearTimeout(cameraTimeoutRef.current)
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current)
    }

    setTimeLeft(60)

    countdownRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    cameraTimeoutRef.current = setTimeout(() => {
      setCameraActive(false)
      setTimeLeft(0)
      if (countdownRef.current) clearInterval(countdownRef.current)
      if (cameraActive) {
        info("Camera deactivated due to inactivity", "Camera Timeout")
      }
    }, 60000)
  }

  const enableCamera = () => {
    setCameraActive(true)
    setScanCompleted(false)
    setScanResult(null)
    setLastScannedQR(null)
    errorToastShownRef.current = false
    resetCameraTimeout()
  }

  const startNewScan = () => {
    setScanCompleted(false)
    setScanResult(null)
    setLastScannedQR(null)
    setCameraActive(true)
    errorToastShownRef.current = false
    resetCameraTimeout()
  }

  const completeProcess = () => {
    setScanCompleted(false)
    setScanResult(null)
    setLastScannedQR(null)
    setCameraActive(false)
    errorToastShownRef.current = false
  }

  useEffect(() => {
    resetCameraTimeout()
    return () => {
      if (cameraTimeoutRef.current) clearTimeout(cameraTimeoutRef.current)
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [])

  const handleNewScan = () => {
    setScanResult(null)
    setScanCompleted(false)
    setLastScannedQR(null)
    setCameraActive(true)
    errorToastShownRef.current = false
    resetCameraTimeout()
  }

  const handleScanResultClose = () => {
    setScanResult(null)
    setScanCompleted(false)
    setLastScannedQR(null)
    setCameraActive(false)
    errorToastShownRef.current = false
  }

  const handleItemIssued = () => {
    // Refetch history to get updated item issuance status
    if (user?.userID) {
      dispatch(fetchScannerHistory({ scannerUserId: user.userID, page: 0 }))
    }
  }

  const handleClearHistory = () => {
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
        <header className="border-b bg-card sticky top-0 z-40 shadow-sm">
          <div className="container mx-auto px-3 sm:px-4 py-2 sm:py-3">
            <div className="flex justify-between items-center">
              {/* Logo and Brand */}
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="bg-white p-1 rounded-md shadow-sm">
                  <img
                      src={VELOCE_BLACK_LOG}
                      alt="VELOCE Logo"
                      className="h-6 w-6 sm:h-8 sm:w-8 object-contain"
                  />
                </div>
                <div>
                  <h1 className="text-base sm:text-lg font-bold text-primary leading-tight">SCANITY</h1>
                  {stats && (
                      <div className="hidden xs:flex items-center gap-1 text-xs text-muted-foreground">
                        <span>Scans: {stats.totalScans}</span>
                        <span>•</span>
                        <span>{stats.successRate}% success</span>
                      </div>
                  )}
                </div>
              </div>

              {/* Desktop Navigation */}
              <div className="hidden md:flex items-center gap-2">
                {/* WebSocket Status */}
                <div className="flex items-center gap-2 mr-2">
                  <div className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
                      wsStatus.connected ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    <div className={`w-2 h-2 rounded-full ${
                        wsStatus.connected ? 'bg-green-500' : 'bg-yellow-500'
                    }`}></div>
                    {wsStatus.text}
                  </div>
                </div>

                <ScanHistory history={historyItems} onClearHistory={handleClearHistory} />

                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => user?.userID && dispatch(fetchScannerStats(user.userID))}
                    disabled={statsLoading}
                    className="gap-1"
                >
                  <RefreshCw className={`h-3 w-3 ${statsLoading ? 'animate-spin' : ''}`} />
                  <span className="hidden lg:inline">Refresh</span>
                </Button>

                <Button variant="ghost" size="sm" className="gap-1">
                  <Settings className="h-4 w-4" />
                  <span className="hidden lg:inline">Settings</span>
                </Button>

                <div className="flex items-center gap-2 px-2 py-1 text-sm text-muted-foreground">
                  <User className="h-4 w-4" />
                  <span className="max-w-[120px] truncate">{user.displayName}</span>
                </div>

                <Button
                    variant="outline"
                    size="sm"
                    onClick={logout}
                    className="gap-1 border-primary text-primary hover:bg-primary hover:text-white"
                >
                  <LogOut className="h-3 w-3" />
                  <span className="hidden lg:inline">Sign Out</span>
                </Button>
              </div>

              {/* Mobile Navigation */}
              <div className="flex md:hidden items-center gap-2">
                {/* WebSocket Status Badge */}
                <div className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
                    wsStatus.connected ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                }`}>
                  <div className={`w-2 h-2 rounded-full ${
                      wsStatus.connected ? 'bg-green-500' : 'bg-yellow-500'
                  }`}></div>
                </div>

                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="sm" className="p-2">
                      <Menu className="h-4 w-4" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-[280px] sm:w-[350px]">
                    <div className="flex flex-col h-full">
                      {/* User Info */}
                      <div className="flex items-center gap-3 p-4 border-b">
                        <User className="h-8 w-8 text-primary" />
                        <div>
                          <p className="font-medium text-sm">{user.displayName}</p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        </div>
                      </div>

                      {/* Navigation Items */}
                      <div className="flex-1 py-4 space-y-2">
                        <ScanHistory history={historyItems} onClearHistory={handleClearHistory} />

                        <Button
                            variant="ghost"
                            className="w-full justify-start gap-2"
                            onClick={() => user?.userID && dispatch(fetchScannerStats(user.userID))}
                            disabled={statsLoading}
                        >
                          <RefreshCw className={`h-4 w-4 ${statsLoading ? 'animate-spin' : ''}`} />
                          Refresh Stats
                        </Button>

                        <Button variant="ghost" className="w-full justify-start gap-2">
                          <Settings className="h-4 w-4" />
                          Settings
                        </Button>
                      </div>

                      {/* Footer */}
                      <div className="p-4 border-t">
                        <Button
                            variant="outline"
                            className="w-full gap-2"
                            onClick={logout}
                        >
                          <LogOut className="h-4 w-4" />
                          Sign Out
                        </Button>
                      </div>
                    </div>
                  </SheetContent>
                </Sheet>
              </div>
            </div>

            {/* Mobile Stats Bar */}
            {stats && (
                <div className="md:hidden mt-2 pt-2 border-t">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Total: {stats.totalScans}</span>
                    <span>Success: {stats.successRate}%</span>
                    {stats.lastScanTime && (
                        <span>Last: {new Date(stats.lastScanTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    )}
                  </div>
                </div>
            )}
          </div>
        </header>

        <main className="flex-1 container mx-auto px-3 sm:px-4 py-4 sm:py-6">
          <div className="max-w-6xl mx-auto">
            <DashboardStats stats={stats} history={historyItems} />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
              {/* Scanner Card */}
              <div className="order-1">
                <Card className="overflow-hidden shadow-lg border-0">
                  <CardHeader className="pb-4 bg-gradient-to-r from-primary/5 to-secondary/5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <Camera className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-lg sm:text-xl text-primary">QR Scanner</CardTitle>
                          <p className="text-xs text-muted-foreground mt-1">
                            {cameraActive
                                ? `Camera Active - ${timeLeft}s remaining`
                                : scanCompleted
                                    ? 'Scan Completed'
                                    : 'Ready to Scan'
                            }
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
                              onError={(error) => {
                                console.error("Scanner error:", error)
                                if (!errorToastShownRef.current) {
                                  errorToastShownRef.current = true
                                  showError("Camera error: " + error, "Scanner Error")
                                  setTimeout(() => {
                                    errorToastShownRef.current = false
                                  }, 3000)
                                }
                                setCameraActive(false)
                              }}
                              autoStart={true}
                          />
                        </div>
                    ) : scanCompleted ? (
                        <div className="text-center py-8 sm:py-12 px-4">
                          <div className="p-3 sm:p-4 bg-green-100 rounded-full w-fit mx-auto mb-4">
                            <CheckCircle className="h-8 w-8 sm:h-12 sm:w-12 text-green-600" />
                          </div>
                          <h3 className="text-base sm:text-lg font-semibold text-green-800 mb-2">Scan Completed!</h3>
                          <p className="text-xs sm:text-sm text-muted-foreground mb-4 sm:mb-6">
                            QR code processed successfully.
                          </p>
                          <div className="flex flex-col sm:flex-row gap-2 justify-center">
                            <Button onClick={completeProcess} variant="outline" className="gap-2 text-xs sm:text-sm">
                              <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4" />
                              Complete
                            </Button>
                            <Button onClick={startNewScan} className="gap-2 text-xs sm:text-sm">
                              <Camera className="h-3 w-3 sm:h-4 sm:w-4" />
                              Scan Another
                            </Button>
                          </div>
                        </div>
                    ) : (
                        <div className="text-center py-8 sm:py-12 px-4">
                          <div className="p-3 sm:p-4 bg-muted rounded-full w-fit mx-auto mb-4">
                            <Camera className="h-8 w-8 sm:h-12 sm:w-12 text-muted-foreground" />
                          </div>
                          <h3 className="text-base sm:text-lg font-semibold text-muted-foreground mb-2">Ready to Scan</h3>
                          <p className="text-xs sm:text-sm text-muted-foreground mb-4 sm:mb-6">
                            Activate camera to start scanning QR codes.
                          </p>
                          <Button
                              onClick={enableCamera}
                              className="gap-2 text-sm sm:text-lg px-6 sm:px-8 py-2 sm:py-3"
                              size="lg"
                          >
                            <Camera className="h-4 w-4 sm:h-5 sm:w-5" />
                            Activate Camera
                          </Button>
                        </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Recent Scans Card */}
              <div className="order-2">
                <Card className="border-0 shadow-lg">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-lg sm:text-xl text-primary">Recent Scans</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-6">
                    {historyItems.length === 0 ? (
                        <div className="text-center py-6 sm:py-8 text-muted-foreground">
                          <div className="p-3 sm:p-4 bg-white rounded-full w-fit mx-auto mb-4 shadow-sm">
                            <img
                                src={VELOCE_BLACK_LOG}
                                alt="VELOCE Logo"
                                className="h-10 w-10 sm:h-16 sm:w-16 object-contain opacity-60"
                            />
                          </div>
                          <p className="text-xs sm:text-sm">No scans yet. Start scanning QR codes!</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                          {historyItems.slice(0, 5).map((scan, index) => (
                              <div key={scan.id || index} className="p-3 bg-muted rounded-lg border">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded font-medium truncate max-w-[120px]">
                                      {scan.packageName}
                                    </span>
                                    <Badge className={`text-xs ${getStatusColor(scan.status)}`}>
                                      {scan.status}
                                    </Badge>
                                  </div>
                                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                                    {new Date(scan.checkedInAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                  </span>
                                </div>
                                <p className="text-xs sm:text-sm font-medium text-card-foreground truncate">
                                  {scan.userName}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {scan.userEmail}
                                </p>
                                <div className="flex gap-2 mt-2 flex-wrap">
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