"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Copy,
  History,
  Trash2,
  User,
  Coffee,
  ShoppingBag,
  CheckCircle,
  XCircle,
  Clock,
  Building,
  ChevronLeft,
  ChevronRight,
  Filter,
  Search
} from "lucide-react"
import { ScanHistoryItem } from "@/lib/types"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface ScanHistoryProps {
  history: ScanHistoryItem[]
  onClearHistory: () => void
}

const ITEMS_PER_PAGE = 10

export function ScanHistory({ history, onClearHistory }: ScanHistoryProps) {
  const [copied, setCopied] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")

  // Filter history based on search and filters
  const filteredHistory = history.filter(scan => {
    const matchesSearch =
        scan.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        scan.userEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
        scan.packageName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        scan.scannerName.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = statusFilter === "all" || scan.status.toLowerCase() === statusFilter.toLowerCase()

    return matchesSearch && matchesStatus
  })

  // Pagination calculations
  const totalPages = Math.ceil(filteredHistory.length / ITEMS_PER_PAGE)
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const paginatedHistory = filteredHistory.slice(startIndex, startIndex + ITEMS_PER_PAGE)

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(text)
      setTimeout(() => setCopied(null), 2000)
    } catch (err) {
      console.error("Failed to copy:", err)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
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
    switch (status.toLowerCase()) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getPackageColor = (packageName: string) => {
    const packageColors: { [key: string]: string } = {
      'full conference': 'bg-blue-100 text-blue-800 border-blue-200',
      'inauguration ceremony': 'bg-purple-100 text-purple-800 border-purple-200',
      'conference day 01': 'bg-orange-100 text-orange-800 border-orange-200',
      'conference day 02': 'bg-green-100 text-green-800 border-green-200',
    }
    return packageColors[packageName.toLowerCase()] || 'bg-gray-100 text-gray-800 border-gray-200'
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    // Scroll to top when changing pages
    const scrollArea = document.querySelector('[data-radix-scroll-area-viewport]')
    scrollArea?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const clearFilters = () => {
    setSearchTerm("")
    setStatusFilter("all")
    setCurrentPage(1)
  }

  // Generate display text for the result field
  const getDisplayResult = (scan: ScanHistoryItem) => {
    return `User: ${scan.userName} (${scan.userEmail}) - ${scan.packageName} - Checked in: ${new Date(scan.checkedInAt).toLocaleString()}`
  }

  return (
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <History className="h-4 w-4" />
            History
            {history.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 min-w-5 flex items-center justify-center">
                  {history.length}
                </Badge>
            )}
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-6xl max-h-[90vh] w-[95vw] p-0">
          <DialogHeader className="px-6 py-4 border-b">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <DialogTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Scan History
              </DialogTitle>
              <div className="flex items-center gap-2">
                {history.length > 0 && (
                    <Button variant="outline" size="sm" onClick={onClearHistory} className="gap-2">
                      <Trash2 className="h-4 w-4" />
                      Clear All
                    </Button>
                )}
              </div>
            </div>
          </DialogHeader>

          {/* Filters Section */}
          {history.length > 0 && (
              <div className="px-6 py-4 border-b bg-muted/30 space-y-3">
                <div className="flex flex-col sm:flex-row gap-3">
                  {/* Search Input */}
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by name, email, package, scanner..."
                        value={searchTerm}
                        onChange={(e) => {
                          setSearchTerm(e.target.value)
                          setCurrentPage(1)
                        }}
                        className="pl-9"
                    />
                  </div>

                  {/* Status Filter */}
                  <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setCurrentPage(1) }}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Clear Filters */}
                  {(searchTerm || statusFilter !== "all") && (
                      <Button variant="ghost" size="sm" onClick={clearFilters} className="whitespace-nowrap">
                        Clear Filters
                      </Button>
                  )}
                </div>

                {/* Results Count */}
                <div className="flex justify-between items-center text-sm text-muted-foreground">
              <span>
                Showing {paginatedHistory.length} of {filteredHistory.length} scans
                {filteredHistory.length !== history.length && ` (filtered from ${history.length} total)`}
              </span>
                </div>
              </div>
          )}

          <ScrollArea className="max-h-[60vh]">
            {history.length === 0 ? (
                <div className="text-center py-12 px-6">
                  <History className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-medium mb-2">No scan history</h3>
                  <p className="text-muted-foreground">Scanned QR codes will appear here for future reference.</p>
                </div>
            ) : filteredHistory.length === 0 ? (
                <div className="text-center py-12 px-6">
                  <Search className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-medium mb-2">No matching scans</h3>
                  <p className="text-muted-foreground mb-4">Try adjusting your search or filters.</p>
                  <Button variant="outline" onClick={clearFilters}>
                    Clear Filters
                  </Button>
                </div>
            ) : (
                <div className="p-6 space-y-4">
                  {paginatedHistory.map((scan) => (
                      <Card key={scan.id} className="p-4 hover:shadow-md transition-shadow duration-200">
                        <div className="space-y-4">
                          {/* Header Section */}
                          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                            <div className="flex items-center gap-3 flex-wrap">
                              {getStatusIcon(scan.status)}
                              <Badge variant="outline" className={`text-xs ${getStatusColor(scan.status)}`}>
                                {scan.status}
                              </Badge>
                              <Badge variant="outline" className={`text-xs ${getPackageColor(scan.packageName)}`}>
                                {scan.packageName}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span>{new Date(scan.checkedInAt).toLocaleString()}</span>
                              <span className="hidden sm:inline">•</span>
                              <span className="hidden sm:inline">Scanner: {scan.scannerName}</span>
                            </div>
                          </div>

                          {/* User Information */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                                <User className="h-4 w-4 text-primary flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{scan.userName}</p>
                                  <p className="text-xs text-muted-foreground truncate">{scan.userEmail}</p>
                                  <p className="text-xs text-muted-foreground">ID: {scan.userId}</p>
                                </div>
                              </div>

                              {/* Package Info */}
                              <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg text-xs">
                                <span className="font-medium">Package:</span>
                                <span>{scan.packageName} ({scan.packageCode})</span>
                              </div>
                            </div>

                            {/* Items Issued Status */}
                            <div className="grid grid-cols-2 gap-3">
                              <div className={`flex items-center gap-2 p-3 rounded-lg border ${
                                  scan.lunchCouponIssued ? 'bg-green-50 border-green-200' : 'bg-muted'
                              }`}>
                                <Coffee className={`h-4 w-4 ${scan.lunchCouponIssued ? 'text-green-600' : 'text-orange-500'}`} />
                                <div className="flex-1">
                                  <span className="text-xs font-medium">Lunch Coupon</span>
                                  <Badge
                                      variant={scan.lunchCouponIssued ? "default" : "secondary"}
                                      className="text-xs ml-2"
                                  >
                                    {scan.lunchCouponIssued ? "Issued" : "Pending"}
                                  </Badge>
                                </div>
                              </div>
                              <div className={`flex items-center gap-2 p-3 rounded-lg border ${
                                  scan.bagIssued ? 'bg-green-50 border-green-200' : 'bg-muted'
                              }`}>
                                <ShoppingBag className={`h-4 w-4 ${scan.bagIssued ? 'text-green-600' : 'text-blue-500'}`} />
                                <div className="flex-1">
                                  <span className="text-xs font-medium">Conference Bag</span>
                                  <Badge
                                      variant={scan.bagIssued ? "default" : "secondary"}
                                      className="text-xs ml-2"
                                  >
                                    {scan.bagIssued ? "Issued" : "Pending"}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Event Details */}
                          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between p-3 bg-muted rounded-lg">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-mono break-all">{getDisplayResult(scan)}</p>
                            </div>
                            <div className="flex gap-1 flex-shrink-0">
                              <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => copyToClipboard(getDisplayResult(scan))}
                                  className="h-8 w-8 p-0"
                                  title="Copy to clipboard"
                              >
                                <Copy className="h-3 w-3" />
                                {copied === getDisplayResult(scan) && (
                                    <span className="absolute -top-2 -right-2 text-xs bg-green-500 text-white rounded-full px-1">
                              ✓
                            </span>
                                )}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </Card>
                  ))}
                </div>
            )}
          </ScrollArea>

          {/* Pagination */}
          {totalPages > 1 && (
              <div className="px-6 py-4 border-t">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="gap-1"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <div className="flex gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum
                        if (totalPages <= 5) {
                          pageNum = i + 1
                        } else if (currentPage <= 3) {
                          pageNum = i + 1
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i
                        } else {
                          pageNum = currentPage - 2 + i
                        }
                        return (
                            <Button
                                key={pageNum}
                                variant={currentPage === pageNum ? "default" : "outline"}
                                size="sm"
                                onClick={() => handlePageChange(pageNum)}
                                className="w-8 h-8 p-0"
                            >
                              {pageNum}
                            </Button>
                        )
                      })}
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="gap-1"
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
          )}
        </DialogContent>
      </Dialog>
  )
}