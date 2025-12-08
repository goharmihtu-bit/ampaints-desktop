import { Clock, Phone, Smartphone } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface LicenseBlockedScreenProps {
  reason: string | null
  deviceId: string | null
  onRetry: () => void
}

export function LicenseBlockedScreen({ reason, deviceId, onRetry }: LicenseBlockedScreenProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 dark:from-amber-950/20 dark:via-orange-950/20 dark:to-yellow-950/20 flex items-center justify-center p-4">
      <Card className="max-w-lg w-full border-2 border-amber-200 dark:border-amber-800 shadow-2xl">
        <CardHeader className="text-center space-y-4 pb-2">
          <div className="mx-auto w-20 h-20 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center">
            <Clock className="h-10 w-10 text-amber-600 dark:text-amber-400" />
          </div>
          <CardTitle className="text-2xl font-bold text-amber-600 dark:text-amber-400">
            License Renewal Required
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800 dark:text-amber-200">Subscription Status</p>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                  {reason || "Your subscription needs to be renewed. Please contact your service provider to continue using the software."}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm text-slate-600 dark:text-slate-400 text-center">
              To renew your subscription, please contact your provider with the following details:
            </p>
            
            <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-3">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Device ID:</p>
              <p className="font-mono text-sm text-slate-700 dark:text-slate-300 select-all" data-testid="text-device-id">
                {deviceId || "Unknown"}
              </p>
            </div>
          </div>

          <div className="bg-gradient-to-r from-primary/5 to-primary/10 dark:from-primary/10 dark:to-primary/20 rounded-lg p-4 border border-primary/20">
            <div className="text-center space-y-2">
              <p className="text-sm font-medium text-foreground">RAYOUX INNOVATIONS PRIVATE LIMITED</p>
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Phone className="h-4 w-4" />
                <span>0300-1204190</span>
              </div>
              <p className="text-xs text-muted-foreground">CEO: AHSAN KAMRAN</p>
            </div>
          </div>

          <Button 
            onClick={onRetry} 
            variant="default" 
            className="w-full"
            data-testid="button-retry-license"
          >
            <Smartphone className="h-4 w-4 mr-2" />
            Check Subscription Status
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
