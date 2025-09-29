"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { QrCode, Calendar, Clock, TrendingUp } from "lucide-react"

interface ScanHistoryItem {
  result: string
  timestamp: Date
  type: string
}

interface DashboardStatsProps {
  history: ScanHistoryItem[]
}

export function DashboardStats({ history }: DashboardStatsProps) {
  const today = new Date()
  const todayScans = history.filter((scan) => scan.timestamp.toDateString() === today.toDateString()).length

  const thisWeekScans = history.filter((scan) => {
    const scanDate = scan.timestamp
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
    return scanDate >= weekAgo
  }).length

  const getTypeStats = () => {
    const types: Record<string, number> = {}
    history.forEach((scan) => {
      const type = getResultType(scan.result)
      types[type] = (types[type] || 0) + 1
    })
    return Object.entries(types).sort(([, a], [, b]) => b - a)[0] || ["None", 0]
  }

  const getResultType = (text: string): string => {
    if (text.startsWith("http://") || text.startsWith("https://")) return "URL"
    if (text.startsWith("WiFi:")) return "WiFi"
    if (text.includes("@") && text.includes(".")) return "Email"
    if (text.startsWith("tel:")) return "Phone"
    if (text.startsWith("sms:")) return "SMS"
    return "Text"
  }

  const [mostCommonType] = getTypeStats()

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Scans</CardTitle>
          <QrCode className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{history.length}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Today</CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{todayScans}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">This Week</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{thisWeekScans}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Most Common</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-xs">{mostCommonType}</div>
        </CardContent>
      </Card>
    </div>
  )
}
