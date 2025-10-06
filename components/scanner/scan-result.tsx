"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Copy, X, CheckCircle, User, Coffee, ShoppingBag, Loader2, AlertCircle, Check, XCircle, Building } from "lucide-react"
import { decodeQRData, getUserAttendanceData, getUserData, markItemIssued } from "@/lib/api"
import { ScanResultProps, ItemType, UserAttendanceData } from "@/lib/types"
import { useToast } from "@/components/ui/toast-provider"

// Package mapping configuration
const PACKAGE_CONFIG = {
  1: { name: "Full Conference", badgeVariant: "default" as const },
  2: { name: "Inauguration Ceremony", badgeVariant: "secondary" as const },
  3: { name: "Conference Day 01", badgeVariant: "secondary" as const },
  4: { name: "Conference Day 02", badgeVariant: "secondary" as const }
} as const

export function ScanResult({ result, onClose, onNewScan, onItemIssued }: ScanResultProps) {
  const [copied, setCopied] = useState(false)
  const [userData, setUserData] = useState<UserAttendanceData | null>(null)
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
    setUserData(null)

    try {
      const qrData = decodeQRData(result)

      if (qrData) {
        const user = await getUserAttendanceData(qrData.userID)

        if (user && Object.keys(user).length > 0) {
          setUserData(user)
        } else {
          setError("User not found or invalid user data")
        }
      } else {
        setError("Invalid QR code format")
      }
    } catch (err) {
      setError("Failed to process QR code data")
      console.error("Error processing QR data:", err)
    } finally {
      setLoading(false)
    }
  }

  // Get package names with Full Conference logic
  const getPackageNames = (packageIDs: number[] = []) => {
    const packageNames: string[] = []

    // Check if user has all packages (2,3,4) which equals Full Conference
    const hasFullConference = [2, 3, 4].every(id => packageIDs.includes(id))

    if (hasFullConference) {
      packageNames.push(PACKAGE_CONFIG[1].name)
    } else {
      // Add individual packages
      packageIDs.forEach(id => {
        if (PACKAGE_CONFIG[id as keyof typeof PACKAGE_CONFIG]) {
          packageNames.push(PACKAGE_CONFIG[id as keyof typeof PACKAGE_CONFIG].name)
        }
      })
    }

    return packageNames
  }

  const handleMarkItemIssued = async (itemType: ItemType) => {
    if (!userData) return;

    const statusKey = itemType === ItemType.LUNCH_COUPON ? "lunchCoupon" : "bag";
    const itemLabel = itemType === ItemType.LUNCH_COUPON ? "Lunch Coupon" : "Conference Kit";

    setUpdating(true);
    setIssuanceStatus((prev) => ({ ...prev, [statusKey]: "pending" }));

    try {
      const response = await markItemIssued(
          userData.userID,
          itemType,
          new Date().toISOString().split("T")[0]
      );

      console.log('Mark item response:', response);

      // Check both success flag AND data field to determine if the operation was truly successful
      const isTrulySuccessful = response.success && response.data === true;

      if (isTrulySuccessful) {
        // Success case - item was marked successfully in database
        setIssuanceStatus((prev) => ({ ...prev, [statusKey]: "success" }));
        success(`${itemLabel} marked as issued successfully!`, "Item Updated");

        const updatedUser = {
          ...userData,
          [itemType === ItemType.LUNCH_COUPON ? "hasLunchIssuedToday" : "hasBagIssued"]: true,
        };
        setUserData(updatedUser);

        if (onItemIssued) {
          // @ts-ignore
          onItemIssued();
        }
      } else {
        if (response.success && response.data === false) {
          setIssuanceStatus((prev) => ({ ...prev, [statusKey]: "error" }));
          showError(`${itemLabel} was not issued. Please try again or contact support.`, "Issuance Failed");
        }
        else if (!response.success) {
          if (response.message === "Item already marked") {
            const updatedUser = {
              ...userData,
              [itemType === ItemType.LUNCH_COUPON ? "hasLunchIssuedToday" : "hasBagIssued"]: true,
            };
            setUserData(updatedUser);

            setIssuanceStatus((prev) => ({ ...prev, [statusKey]: "success" }));
            success(`${itemLabel} was already issued`, "Already Issued");
          } else {
            setIssuanceStatus((prev) => ({ ...prev, [statusKey]: "error" }));
            showError(`${itemLabel} failed: ${response.message}`, "Issuance Error");
          }
        } else {
          throw new Error("Unexpected response format from server");
        }
      }
    } catch (err: any) {
      const backendMessage =
          err?.response?.data?.message || err.message || "An unexpected error occurred";

      setIssuanceStatus((prev) => ({ ...prev, [statusKey]: "error" }));
      showError(`${itemLabel} issuance failed: ${backendMessage}`, "Issuance Error");
    } finally {
      setUpdating(false);
      setTimeout(() => {
        setIssuanceStatus((prev) => ({ ...prev, [statusKey]: null }));
      }, 2500);
    }
  };

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

  const isAlreadyProcessed = userData && userData.hasBagIssued && userData.hasLunchIssuedToday
  const packageNames = userData ? getPackageNames(userData.packageIDs) : []

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
                    {/* User Info Card */}
                    <div className="p-3 bg-muted rounded-lg space-y-2">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-primary" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {userData.displayName || `${userData.firstName} ${userData.lastName}`}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">{userData.email}</p>
                          <p className="text-xs text-muted-foreground">ID: {userData.userID}</p>
                        </div>
                      </div>

                      {/* Company Name */}
                      {userData.companyName && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Building className="h-3 w-3" />
                            <span>{userData.companyName}</span>
                          </div>
                      )}

                      {/* Package Badges */}
                      {packageNames.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {packageNames.map((packageName, index) => (
                                <Badge
                                    key={index}
                                    variant="secondary"
                                    className="text-xs"
                                >
                                  {packageName}
                                </Badge>
                            ))}
                          </div>
                      )}
                    </div>

                    {/* Items Issuance Section */}
                    <div className="grid grid-cols-1 gap-3">
                      {/* Lunch Coupon */}
                      <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div className="flex items-center gap-2">
                          <Coffee className="h-4 w-4 text-orange-500" />
                          <span className="text-sm font-medium">Lunch Coupon</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                              variant={userData.hasLunchIssuedToday ? "default" : "secondary"}
                              className="text-xs"
                          >
                            {userData.hasLunchIssuedToday ? "Issued" : "Pending"}
                          </Badge>
                          {getStatusIcon(ItemType.LUNCH_COUPON)}
                          <Button
                              size="sm"
                              variant={userData.hasLunchIssuedToday ? "outline" : "default"}
                              onClick={() => handleMarkItemIssued(ItemType.LUNCH_COUPON)}
                              disabled={updating || userData.hasLunchIssuedToday}
                              className="text-xs px-2 py-1 h-7 min-w-[85px]"
                          >
                            {updating && issuanceStatus.lunchCoupon === 'pending' ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                            ) : userData.hasLunchIssuedToday ? (
                                "Issued"
                            ) : (
                                "Mark Issued"
                            )}
                          </Button>
                        </div>
                      </div>

                      {/* Conference Bag */}
                      <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div className="flex items-center gap-2">
                          <ShoppingBag className="h-4 w-4 text-blue-500" />
                          <span className="text-sm font-medium">Conference Bag</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                              variant={userData.hasBagIssued ? "default" : "secondary"}
                              className="text-xs"
                          >
                            {userData.hasBagIssued ? "Issued" : "Pending"}
                          </Badge>
                          {getStatusIcon(ItemType.BAG)}
                          <Button
                              size="sm"
                              variant={userData.hasBagIssued ? "outline" : "default"}
                              onClick={() => handleMarkItemIssued(ItemType.BAG)}
                              disabled={updating || userData.hasBagIssued}
                              className="text-xs px-2 py-1 h-7 min-w-[85px]"
                          >
                            {updating && issuanceStatus.bag === 'pending' ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                            ) : userData.hasBagIssued ? (
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

            {/* Raw Data Display for Invalid/Unknown QR Codes */}
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