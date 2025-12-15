import { useState } from "react"
import { Clock, Phone, Smartphone, Key, Eye, EyeOff } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"

interface LicenseBlockedScreenProps {
  reason: string | null
  deviceId: string | null
  onRetry: () => Promise<boolean> | void
}

export function LicenseBlockedScreen({ reason, deviceId, onRetry }: LicenseBlockedScreenProps) {
  const [showReactivationDialog, setShowReactivationDialog] = useState(false)
  const [secretKey, setSecretKey] = useState("")
  const [showSecretKey, setShowSecretKey] = useState(false)
  const [isActivating, setIsActivating] = useState(false)
  const [activationError, setActivationError] = useState("")

  const handleReactivate = async () => {
    if (!secretKey.trim()) {
      setActivationError("Please enter your secret key")
      return
    }

    setIsActivating(true)
    setActivationError("")

    try {
      const response = await fetch("/api/license/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secretKey }),
      })

      if (response.ok) {
        setShowReactivationDialog(false)
        setSecretKey("")
        // Reload the app after successful reactivation
        setTimeout(() => window.location.reload(), 1000)
      } else {
        const error = await response.json()
        setActivationError(error.error || "Invalid secret key. Please try again.")
      }
    } catch (error) {
      setActivationError("Failed to connect to server. Please try again.")
    } finally {
      setIsActivating(false)
    }
  }

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

          <Button 
            onClick={() => setShowReactivationDialog(true)} 
            variant="outline" 
            className="w-full"
            data-testid="button-reactivate-license"
          >
            <Key className="h-4 w-4 mr-2" />
            Reactivate with Secret Key
          </Button>
        </CardContent>
      </Card>

      {/* Reactivation Dialog */}
      <Dialog open={showReactivationDialog} onOpenChange={setShowReactivationDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Reactivate License
            </DialogTitle>
            <DialogDescription>
              Enter your secret key to reactivate the software license
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="secret-key">Secret Key (10 digits)</Label>
              <div className="relative mt-2">
                <Input
                  id="secret-key"
                  type={showSecretKey ? "text" : "password"}
                  value={secretKey}
                  onChange={(e) => setSecretKey(e.target.value)}
                  placeholder="Enter your secret key"
                  className="pr-10"
                  disabled={isActivating}
                  data-testid="input-license-secret-key"
                />
                <button
                  type="button"
                  onClick={() => setShowSecretKey(!showSecretKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  disabled={isActivating}
                >
                  {showSecretKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Your secret key is a numeric code used to reactivate an expired or deactivated license
              </p>
            </div>

            {activationError && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400">{activationError}</p>
              </div>
            )}

            <div className="flex gap-2 justify-end pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowReactivationDialog(false)
                  setSecretKey("")
                  setActivationError("")
                }}
                disabled={isActivating}
                data-testid="button-cancel-reactivation"
              >
                Cancel
              </Button>
              <Button
                onClick={handleReactivate}
                disabled={isActivating || !secretKey.trim()}
                className="bg-amber-600 hover:bg-amber-700"
                data-testid="button-confirm-reactivation"
              >
                {isActivating ? "Activating..." : "Activate"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>    </div>
  )
}