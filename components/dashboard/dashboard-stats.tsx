import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScannerStats, ScanHistoryItem } from "@/lib/types"
import { Users, CheckCircle, XCircle, Package } from "lucide-react"

interface DashboardStatsProps {
  stats: ScannerStats | null
  history: ScanHistoryItem[]
}

export function DashboardStats({ stats, history }: DashboardStatsProps) {
  if (!stats) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                  <div className="h-6 bg-muted rounded w-1/2"></div>
                </CardContent>
              </Card>
          ))}
        </div>
    )
  }

  const statCards = [
    {
      title: "Total Scans",
      value: stats.totalScans,
      icon: Users,
      description: "Scans today",
      color: "text-blue-600"
    },
    {
      title: "Successful",
      value: stats.successfulScans,
      icon: CheckCircle,
      description: `${stats.successRate}% success rate`,
      color: "text-green-600"
    },
    {
      title: "Failed",
      value: stats.failedScans,
      icon: XCircle,
      description: "Failed scans",
      color: "text-red-600"
    },
    {
      title: "Packages",
      value: stats.fullPackageScans + stats.inaugurationScans + stats.day1Scans + stats.day2Scans,
      icon: Package,
      description: "Package scans",
      color: "text-purple-600"
    }
  ]

  return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {statCards.map((stat, index) => (
            <Card key={index} className="relative overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground">{stat.description}</p>
              </CardContent>
            </Card>
        ))}
      </div>
  )
}