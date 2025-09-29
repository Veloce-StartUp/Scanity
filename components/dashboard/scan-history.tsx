"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Copy, ExternalLink, History, Trash2, User, Coffee, ShoppingBag, CheckCircle, XCircle, Clock } from "lucide-react"
import { ScanHistoryItem } from "@/lib/types"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface ScanHistoryProps {
  history: ScanHistoryItem[]
  onClearHistory: () => void
}

export function ScanHistory({ history, onClearHistory }: ScanHistoryProps) {
  const [copied, setCopied] = useState<string | null>(null)

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(text)
      setTimeout(() => setCopied(null), 2000)
    } catch (err) {
      console.error("Failed to copy:", err)
    }
  }

  const openLink = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer")
  }

  const isUrl = (text: string): boolean => {
    try {
      new URL(text)
      return true
    } catch {
      return text.startsWith("http://") || text.startsWith("https://")
    }
  }

  const getResultType = (text: string): string => {
    if (text.startsWith("WiFi:")) return "WiFi"
    if (text.includes("@") && text.includes(".")) return "Email"
    if (text.startsWith("tel:")) return "Phone"
    if (text.startsWith("sms:")) return "SMS"
    return "Text"
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />
      default:
        return <Clock className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-700'
      case 'failed':
        return 'bg-red-100 text-red-700'
      case 'pending':
        return 'bg-yellow-100 text-yellow-700'
      default:
        return 'bg-gray-100 text-gray-700'
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <History className="h-4 w-4" />
          History ({history.length})
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Scan History</DialogTitle>
            {history.length > 0 && (
              <Button variant="outline" size="sm" onClick={onClearHistory} className="gap-2 bg-transparent">
                <Trash2 className="h-4 w-4" />
                Clear All
              </Button>
            )}
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          {history.length === 0 ? (
            <div className="text-center py-8">
              <History className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No scans yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((scan, index) => (
                <Card key={index} className="p-4">
                  <div className="space-y-3">
                    {/* Header with status and timestamp */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(scan.scanStatus)}
                        <Badge variant="secondary" className="text-xs">
                          {scan.type}
                        </Badge>
                        <Badge className={`text-xs ${getStatusColor(scan.scanStatus)}`}>
                          {scan.scanStatus}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">{scan.timestamp.toLocaleString()}</span>
                    </div>

                    {/* User Information */}
                    {scan.userData && (
                      <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                        <User className="h-4 w-4 text-primary" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {scan.userData.displayName || `${scan.userData.firstName} ${scan.userData.lastName}`}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">{scan.userData.email}</p>
                          <p className="text-xs text-muted-foreground">ID: {scan.userData.userID}</p>
                        </div>
                      </div>
                    )}

                    {/* Items Issued Status */}
                    {scan.itemsIssued && (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                          <Coffee className="h-4 w-4 text-orange-500" />
                          <span className="text-xs">Lunch Coupon</span>
                          <Badge variant={scan.itemsIssued.lunchCoupon ? "default" : "secondary"} className="text-xs">
                            {scan.itemsIssued.lunchCoupon ? "Issued" : "Pending"}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                          <ShoppingBag className="h-4 w-4 text-blue-500" />
                          <span className="text-xs">Bag</span>
                          <Badge variant={scan.itemsIssued.bag ? "default" : "secondary"} className="text-xs">
                            {scan.itemsIssued.bag ? "Issued" : "Pending"}
                          </Badge>
                        </div>
                      </div>
                    )}

                    {/* Error Message */}
                    {scan.errorMessage && (
                      <Alert variant="destructive" className="text-xs">
                        <XCircle className="h-4 w-4" />
                        <AlertDescription>{scan.errorMessage}</AlertDescription>
                      </Alert>
                    )}

                    {/* Raw Data */}
                    <div className="p-2 bg-muted rounded-lg">
                      <p className="text-xs font-mono break-all">{scan.result}</p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-1 justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(scan.result)}
                        className="h-8 w-8 p-0"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                      {isUrl(scan.result) && (
                        <Button variant="ghost" size="sm" onClick={() => openLink(scan.result)} className="h-8 w-8 p-0">
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
