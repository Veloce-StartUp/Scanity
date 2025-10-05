"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Copy, X, CheckCircle, User, Coffee, ShoppingBag, Loader2, AlertCircle, Check, XCircle } from "lucide-react"
import { decodeQRData, getUserData, markItemIssued } from "@/lib/api"
import { UserData, ScanResultProps, ItemIssuanceResponse, ItemType } from "@/lib/types"
import { useToast } from "@/components/ui/toast-provider"
import { webSocketService } from "@/lib/websocket";

export function ScanResult({ result, onClose, onNewScan, onItemIssued }: ScanResultProps) {
  const [copied, setCopied] = useState(false)
  const [userData, setUserData] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [updating, setUpdating] = useState(false)
  const [issuanceStatus, setIssuanceStatus] = useState<{
    lunchCoupon: 'pending' | 'success' | 'error' | null
    bag: 'pending' | 'success' | 'error' | null
  }>({ lunchCoupon: null, bag: null })
  const { success, error: showError } = useToast()

  useEffect(() => {
    processQRData()
  }, [result])

  const processQRData = async () => {
    setLoading(true)
    setError(null)

    try {
      const qrData = decodeQRData(result)

      if (qrData) {
        const user = await getUserData(qrData.userID)
        if (user) {
          setUserData(user)
        } else {
          setError(`User not found for ID: ${qrData.userID}`)
        }
      } else {
        setError("Invalid QR code format")
      }
    } catch (err) {
      setError("Failed to process QR code data")
    } finally {
      setLoading(false)
    }
  }

  const handleMarkItemIssued = async (itemType: ItemType) => {
    if (!userData || !webSocketService.isConnectedToWebSocket()) return

    setUpdating(true)
    const statusKey = itemType === ItemType.LUNCH_COUPON ? 'lunchCoupon' : 'bag'
    setIssuanceStatus(prev => ({ ...prev, [statusKey]: 'pending' }))

    try {
      const response: ItemIssuanceResponse = await markItemIssued(
          userData.userID,
          itemType,
          new Date().toISOString().split('T')[0]
      )

      if (response.success) {
        setIssuanceStatus(prev => ({ ...prev, [statusKey]: 'success' }))

        // Update local user data to reflect the change
        const updatedUser = {
          ...userData,
          [itemType === ItemType.LUNCH_COUPON ? 'lunchCouponIssued' : 'bagIssued']: true
        }
        setUserData(updatedUser)

        success(`${itemType === ItemType.LUNCH_COUPON ? 'Lunch Coupon' : 'Conference Bag'} marked as issued successfully!`, 'Item Updated')

        // Call the callback to update scan history
        if (onItemIssued) {
          onItemIssued()
        }

        // Reset success status after 2 seconds
        setTimeout(() => {
          setIssuanceStatus(prev => ({ ...prev, [statusKey]: null }))
        }, 2000)
      } else {
        setIssuanceStatus(prev => ({ ...prev, [statusKey]: 'error' }))
        showError(response.error || `Failed to mark ${itemType.toLowerCase()} as issued`, 'Issuance Error')

        // Reset error status after 3 seconds
        setTimeout(() => {
          setIssuanceStatus(prev => ({ ...prev, [statusKey]: null }))
        }, 3000)
      }
    } catch (err) {
      setIssuanceStatus(prev => ({ ...prev, [statusKey]: 'error' }))
      showError(`Failed to mark ${itemType.toLowerCase()} as issued`, 'Issuance Error')

      // Reset error status after 3 seconds
      setTimeout(() => {
        setIssuanceStatus(prev => ({ ...prev, [statusKey]: null }))
      }, 3000)
    } finally {
      setUpdating(false)
    }
  }

  const getStatusIcon = (itemType: ItemType) => {
    const statusKey = itemType === ItemType.LUNCH_COUPON ? 'lunchCoupon' : 'bag'
    const status = issuanceStatus[statusKey]
    if (status === 'success') return <Check className="h-4 w-4 text-green-500" />
    if (status === 'error') return <XCircle className="h-4 w-4 text-red-500" />
    if (status === 'pending') return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
    return null
  }

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(result)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Failed to copy:", err)
    }
  }

  const isAlreadyProcessed = userData && userData.lunchCouponIssued && userData.bagIssued

  return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <CardTitle className="text-base sm:text-lg">QR Code Scanned</CardTitle>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>

          <CardContent className="space-y-4">
            {loading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <span className="ml-2 text-sm">Processing QR code...</span>
                </div>
            )}

            {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-sm">{error}</AlertDescription>
                </Alert>
            )}

            {userData && (
                <>
                  {isAlreadyProcessed && (
                      <Alert>
                        <CheckCircle className="h-4 w-4" />
                        <AlertDescription className="text-sm">
                          This user has already been processed. All items have been issued.
                        </AlertDescription>
                      </Alert>
                  )}

                  <div className="space-y-3">
                    <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                      <User className="h-4 w-4 text-primary" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{userData.displayName || `${userData.firstName} ${userData.lastName}`}</p>
                        <p className="text-xs text-muted-foreground truncate">{userData.email}</p>
                        <p className="text-xs text-muted-foreground">ID: {userData.userID}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div className="flex items-center gap-2">
                          <Coffee className="h-4 w-4 text-orange-500" />
                          <span className="text-sm font-medium">Lunch Coupon</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={userData.lunchCouponIssued ? "default" : "secondary"} className="text-xs">
                            {userData.lunchCouponIssued ? "Issued" : "Pending"}
                          </Badge>
                          {getStatusIcon(ItemType.LUNCH_COUPON)}
                          <Button
                              size="sm"
                              variant={userData.lunchCouponIssued ? "outline" : "default"}
                              onClick={() => handleMarkItemIssued(ItemType.LUNCH_COUPON)}
                              disabled={updating || userData.lunchCouponIssued}
                              className="text-xs px-2 py-1 h-7"
                          >
                            {updating ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                            ) : userData.lunchCouponIssued ? (
                                "Issued"
                            ) : (
                                "Mark Issued"
                            )}
                          </Button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div className="flex items-center gap-2">
                          <ShoppingBag className="h-4 w-4 text-blue-500" />
                          <span className="text-sm font-medium">Conference Bag</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={userData.bagIssued ? "default" : "secondary"} className="text-xs">
                            {userData.bagIssued ? "Issued" : "Pending"}
                          </Badge>
                          {getStatusIcon(ItemType.BAG)}
                          <Button
                              size="sm"
                              variant={userData.bagIssued ? "outline" : "default"}
                              onClick={() => handleMarkItemIssued(ItemType.BAG)}
                              disabled={updating || userData.bagIssued}
                              className="text-xs px-2 py-1 h-7"
                          >
                            {updating ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                            ) : userData.bagIssued ? (
                                "Issued"
                            ) : (
                                "Mark Issued"
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>

                    {userData.lastScanTime && (
                        <div className="text-xs text-muted-foreground text-center">
                          Last scanned: {new Date(userData.lastScanTime).toLocaleString()}
                        </div>
                    )}
                  </div>
                </>
            )}

            {!loading && !userData && !error && (
                <>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      Raw Data
                    </Badge>
                  </div>

                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-xs font-mono break-all">{result}</p>
                  </div>

                  <Button
                      variant="outline"
                      size="sm"
                      onClick={copyToClipboard}
                      className="w-full gap-2 bg-transparent text-sm"
                  >
                    <Copy className="h-4 w-4" />
                    {copied ? "Copied!" : "Copy"}
                  </Button>
                </>
            )}

            <Button onClick={onNewScan} className="w-full text-sm">
              Scan Another Code
            </Button>
          </CardContent>
        </Card>
      </div>
  )
}