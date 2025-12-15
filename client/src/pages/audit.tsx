"use client"

import type React from "react"
import { useState, useMemo, useEffect, useCallback, useRef } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Lock,
  Settings,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Database,
  Trash2,
  Edit,
  Cloud,
  Upload,
  Download,
  Check,
  XCircle,
  Loader2,
  Users,
  Key,
  Cpu,
  Wifi,
  WifiOff,
  Receipt,
  CreditCard,
  Package,
  Activity,
  Clock,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { queryClient } from "@/lib/queryClient"
import type { Settings as AppSettings } from "@shared/schema"

// Custom hook for authenticated API calls
function useAuditApiRequest() {
  const [auditToken, setAuditToken] = useState<string | null>(null)

  useEffect(() => {
    const storedToken = sessionStorage.getItem("auditToken")
    if (storedToken) {
      setAuditToken(storedToken)
    }
  }, [])

  const authenticatedRequest = async (url: string, options: RequestInit = {}) => {
    const token = auditToken || sessionStorage.getItem("auditToken")
    if (!token) {
      throw new Error("No audit token available")
    }

    const headers = {
      "Content-Type": "application/json",
      "X-Audit-Token": token,
      ...options.headers,
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      })

      if (response.status === 401) {
        sessionStorage.removeItem("auditToken")
        sessionStorage.removeItem("auditVerified")
        setAuditToken(null)
        throw new Error("Authentication failed. Please re-enter your PIN.")
      }

      if (!response.ok) {
        let errorMessage = `Request failed with status ${response.status}`
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage
        } catch (e) {
          const text = await response.text()
          if (text) errorMessage = `${errorMessage}: ${text}`
        }
        throw new Error(errorMessage)
      }

      return response.json()
    } catch (error: any) {
      console.error(`API Request Error for ${url}:`, error)
      throw error
    }
  }

  return { authenticatedRequest, auditToken, setAuditToken }
}

export default function Audit() {
	const { toast } = useToast()
	const { authenticatedRequest, auditToken, setAuditToken } = useAuditApiRequest()

	const [isVerified, setIsVerified] = useState(false)
	const [pinInput, setPinInput] = useState(["", "", "", ""])
	const [pinError, setPinError] = useState("")
	const [isDefaultPin, setIsDefaultPin] = useState(false)
	const [showPinDialog, setShowPinDialog] = useState(true)

	// Settings Tabs State
	const [settingsTab, setSettingsTab] = useState("pin")
	const [currentPin, setCurrentPin] = useState("")
	const [newPin, setNewPin] = useState("")
	const [confirmPin, setConfirmPin] = useState("")
	const [showCurrentPin, setShowCurrentPin] = useState(false)
	const [showNewPin, setShowNewPin] = useState(false)
	const [showConfirmPin, setShowConfirmPin] = useState(false)

	// Cloud Sync State - Optimized for silent operation
	const [cloudUrl, setCloudUrl] = useState("")
	const [showCloudUrl, setShowCloudUrl] = useState(false)
	const [cloudConnectionStatus, setCloudConnectionStatus] = useState<"idle" | "testing" | "success" | "error">("idle")
	const [cloudSyncStatus, setCloudSyncStatus] = useState<"idle" | "exporting" | "importing">("idle")
	const [lastExportCounts, setLastExportCounts] = useState<any>(null)
	const [lastImportCounts, setLastImportCounts] = useState<any>(null)
	
	const { data: hasPin } = useQuery<{ hasPin: boolean; isDefault?: boolean }>({
		queryKey: ["/api/audit/has-pin"],
		enabled: !isVerified,
		refetchOnWindowFocus: false
	})

	const { data: appSettings } = useQuery<AppSettings>({
		queryKey: ["/api/settings"],
		enabled: isVerified,
		staleTime: 10 * 60 * 1000,
		refetchOnWindowFocus: false,
		refetchOnMount: false,
		gcTime: 30 * 60 * 1000,
	})

	const updatePermissionsMutation = useMutation({
		mutationFn: async (permissions: Partial<AppSettings>) => {
			const response = await authenticatedRequest("/api/settings", {
				method: "PATCH",
				body: JSON.stringify(permissions),
			})
			return response
		},
		onSuccess: () => {
			queryClient.setQueryData(["/api/settings"], (old: AppSettings) => ({
				...old,
				...updatePermissionsMutation.variables
			}))
			
			toast({
				title: "Permissions Updated",
				description: "Access control settings have been saved.",
			})
		},
		onError: () => {
			toast({
				title: "Failed to Update",
				description: "Could not save permission settings.",
				variant: "destructive",
			})
		},
	})

	const handlePermissionChange = useCallback((key: keyof AppSettings, value: boolean) => {
		updatePermissionsMutation.mutate({ [key]: value })
	}, [updatePermissionsMutation])

	const verifyPinMutation = useMutation({
		mutationFn: async (pin: string) => {
			const response = await fetch("/api/audit/verify", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ pin }),
			})
			if (!response.ok) {
				const errorData = await response.json()
				throw new Error(errorData.error || "PIN verification failed")
			}
			return response.json()
		},
		onSuccess: (data: { ok: boolean; isDefault?: boolean; auditToken?: string }) => {
			if (data.ok && data.auditToken) {
				setIsVerified(true)
				setAuditToken(data.auditToken)
				setShowPinDialog(false)
				setIsDefaultPin(data.isDefault || false)
				setPinError("")
				if (data.isDefault) {
					toast({
						title: "Default PIN Used",
						description: "Please change your PIN in the Settings tab for security.",
						variant: "destructive",
					})
				}
				sessionStorage.setItem("auditVerified", "true")
				sessionStorage.setItem("auditToken", data.auditToken)
			}
		},
		onError: (error: Error) => {
			setPinError(error.message || "Invalid PIN. Please try again.")
			setPinInput(["", "", "", ""])
		},
	})

	const changePinMutation = useMutation({
		mutationFn: async ({ currentPin, newPin }: { currentPin: string; newPin: string }) => {
			const response = await authenticatedRequest("/api/audit/pin", {
				method: "PATCH",
				body: JSON.stringify({ currentPin, newPin }),
			})
			return response
		},
		onSuccess: () => {
			toast({
				title: "PIN Changed",
				description: "Your audit PIN has been successfully updated.",
			})
			setCurrentPin("")
			setNewPin("")
			setConfirmPin("")
			setIsDefaultPin(false)
		},
		onError: (error: Error) => {
			toast({
				title: "PIN Change Failed",
				description: error.message || "Failed to change PIN. Please check your current PIN.",
				variant: "destructive",
			})
		},
	})

	// Cloud Sync Functions - Optimized for silent operation
	const handleTestConnection = useCallback(async () => {
		if (!cloudUrl.trim()) {
			toast({
				title: "Connection URL Required",
				description: "Please enter a PostgreSQL connection URL.",
				variant: "destructive",
			})
			return
		}

		if (!cloudUrl.includes('postgresql://') || !cloudUrl.includes('@')) {
			setCloudConnectionStatus("error")
			toast({
				title: "Invalid Format",
				description: "URL must be in format: postgresql://user:password@host/database",
				variant: "destructive",
			})
			return
		}

		setCloudConnectionStatus("testing")
		try {
			const response = await authenticatedRequest("/api/cloud/test-connection", {
				method: "POST",
				body: JSON.stringify({ connectionUrl: cloudUrl }),
			})
			
			if (response.ok) {
				setCloudConnectionStatus("success")
				
				await authenticatedRequest("/api/cloud/save-settings", {
					method: "POST",
					body: JSON.stringify({ connectionUrl: cloudUrl, syncEnabled: true }),
				})
				
				toast({
					title: "Connection Successful",
					description: response.message || "Connected to cloud database successfully.",
				})
			} else {
				setCloudConnectionStatus("error")
				toast({
					title: "Connection Failed",
					description: response.error || response.details || "Could not connect to cloud database.",
					variant: "destructive",
				})
			}
		} catch (error: any) {
			setCloudConnectionStatus("error")
			toast({
				title: "Connection Failed",
				description: error.message || "Could not connect to cloud database.",
				variant: "destructive",
			})
		}
	}, [cloudUrl, authenticatedRequest, toast])

	// --- NEW: Persist UI state to survive reloads ---
	const UI_STATE_KEY = "audit:uiState";
	const saveUiStateDebounceRef = useRef<number | null>(null);

	const saveUiState = useCallback(() => {
		if (saveUiStateDebounceRef.current) {
			clearTimeout(saveUiStateDebounceRef.current);
		}
		// debounce small changes to avoid frequent writes
		saveUiStateDebounceRef.current = (window.setTimeout(() => {
			const state = {
				settingsTab,
				pinInput,
				pinError,
				isDefaultPin,
				showPinDialog,
				cloudUrl,
				cloudConnectionStatus,
				cloudSyncStatus,
			};
			try {
				sessionStorage.setItem(UI_STATE_KEY, JSON.stringify(state));
			} catch (e) {
				// ignore storage errors
			}
		}, 200) as unknown) as number;
	}, [settingsTab, pinInput, pinError, isDefaultPin, showPinDialog, cloudUrl, cloudConnectionStatus, cloudSyncStatus]);

	const restoreUiState = useCallback(() => {
		try {
			const raw = sessionStorage.getItem(UI_STATE_KEY);
			if (!raw) return;
			const parsed = JSON.parse(raw);
			if (parsed.settingsTab) setSettingsTab(parsed.settingsTab);
			if (Array.isArray(parsed.pinInput)) setPinInput(parsed.pinInput);
			if (parsed.pinError) setPinError(parsed.pinError);
			if (parsed.isDefaultPin) setIsDefaultPin(parsed.isDefaultPin);
			if (typeof parsed.showPinDialog === "boolean") setShowPinDialog(parsed.showPinDialog);
			if (parsed.cloudUrl) setCloudUrl(parsed.cloudUrl);
			if (parsed.cloudConnectionStatus) setCloudConnectionStatus(parsed.cloudConnectionStatus);
			if (parsed.cloudSyncStatus) setCloudSyncStatus(parsed.cloudSyncStatus);
		} catch (e) {
			// ignore JSON parse errors
		}
	}, []);

	useEffect(() => {
		restoreUiState();
		// save on state changes
		saveUiState();
		return () => {
			// persist before unmount
			saveUiState();
			if (saveUiStateDebounceRef.current) {
				clearTimeout(saveUiStateDebounceRef.current);
			}
		};
		// intentionally omit saveUiState from deps to avoid frequent rebinds
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [restoreUiState]);

	// also save when important UI pieces change
	useEffect(() => { saveUiState(); }, [settingsTab, pinInput, showPinDialog, cloudUrl, cloudConnectionStatus, cloudSyncStatus]);

	// --- CHANGES: make cloud actions set cloudSyncInProgress flag and only selectively invalidate queries ---
	const handleExportToCloud = useCallback(async () => {
		if (!cloudUrl.trim() || cloudSyncStatus !== "idle") return
		setCloudSyncStatus("exporting")
		try {
			const response = await authenticatedRequest("/api/cloud/export", { method: "POST" })
			if (response.ok) {
				setLastExportCounts(response.counts || {})
				toast({ title: "Export Complete", description: response.message || "Data exported to cloud successfully." })
			} else {
				toast({ title: "Export Failed", description: response.error || "Could not export data to cloud.", variant: "destructive" })
			}
		} catch (error: any) {
			toast({ title: "Export Failed", description: error.message || "Could not export data to cloud.", variant: "destructive" })
		} finally {
			setCloudSyncStatus("idle")
		}
	}, [cloudUrl, cloudSyncStatus, authenticatedRequest, toast])

	const handleImportFromCloud = useCallback(async () => {
		if (!cloudUrl.trim()) {
			toast({ title: "Connection URL Required", description: "Please enter and save a PostgreSQL connection URL first.", variant: "destructive" })
			return
		}
		setCloudSyncStatus("importing")
		try {
			const response = await authenticatedRequest("/api/cloud/import", { method: "POST" })
			if (response.ok) {
				setLastImportCounts(response.counts || {})
				toast({ title: "Import Complete", description: response.message || "Data imported from cloud successfully." })
			} else {
				toast({ title: "Import Failed", description: response.error || "Could not import data from cloud.", variant: "destructive" })
			}
		} catch (error: any) {
			toast({ title: "Import Failed", description: error.message || "Could not import data from cloud.", variant: "destructive" })
		} finally {
			setCloudSyncStatus("idle")
		}
	}, [cloudUrl, authenticatedRequest, toast])


	useEffect(() => {
		const storedToken = sessionStorage.getItem("auditToken")
		const storedVerified = sessionStorage.getItem("auditVerified")

		if (storedVerified === "true" && storedToken) {
			setIsVerified(true)
			setAuditToken(storedToken)
			setShowPinDialog(false)
		}
	}, [])

	useEffect(() => {
		if (appSettings?.cloudDatabaseUrl && !cloudUrl) {
			setCloudUrl(appSettings.cloudDatabaseUrl)
			if (appSettings.cloudSyncEnabled) {
				setCloudConnectionStatus("success")
			}
		}
	}, [appSettings?.cloudDatabaseUrl, appSettings?.cloudSyncEnabled])

	const handlePinInput = (index: number, value: string) => {
		if (!/^\d*$/.test(value)) return

		const newPinInput = [...pinInput]
		newPinInput[index] = value.slice(-1)
		setPinInput(newPinInput)
		setPinError("")

		if (value && index < 3) {
			const nextInput = document.getElementById(`pin-${index + 1}`)
			nextInput?.focus()
		}

		if (index === 3 && value) {
			const fullPin = newPinInput.join("")
			if (fullPin.length === 4) {
				verifyPinMutation.mutate(fullPin)
			}
		}
	}

	const handlePinKeyDown = (index: number, e: React.KeyboardEvent) => {
		if (e.key === "Backspace" && !pinInput[index] && index > 0) {
			const prevInput = document.getElementById(`pin-${index - 1}`)
			prevInput?.focus()
		}
	}

	const handlePinChange = () => {
		if (newPin !== confirmPin) {
			toast({
				title: "PIN Mismatch",
				description: "New PIN and confirmation do not match.",
				variant: "destructive",
			})
			return
		}

		if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
			toast({
				title: "Invalid PIN",
				description: "PIN must be exactly 4 digits.",
				variant: "destructive",
			})
			return
		}

		changePinMutation.mutate({
			currentPin: currentPin || "0000",
			newPin: newPin,
		})
	}

	if (showPinDialog) {
		return (
			<Dialog open={showPinDialog} onOpenChange={() => {}}>
				<DialogContent
					className="sm:max-w-md"
					onPointerDownOutside={(e) => e.preventDefault()}
				>
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2 justify-center text-xl">
							<ShieldCheck className="h-6 w-6 text-primary" />
							Audit PIN Verification
						</DialogTitle>
						<DialogDescription className="text-center">
							Enter your 4-digit PIN to access Audit Reports
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-6 py-4">
						{hasPin && !hasPin.hasPin && (
							<div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-md">
								<AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
								<p className="text-sm text-yellow-700 dark:text-yellow-300">
									Default PIN is <strong>0000</strong>. Please change it after login.
								</p>
							</div>
						)}

						<div className="flex justify-center gap-3">
							{[0, 1, 2, 3].map((index) => (
								<input
									key={index}
									id={`pin-${index}`}
									type="text"
									inputMode="numeric"
									pattern="[0-9]*"
									maxLength={1}
									value={pinInput[index]}
									onChange={(e) => handlePinInput(index, e.target.value)}
									onKeyDown={(e) => handlePinKeyDown(index, e)}
									className="w-14 h-14 text-center text-2xl font-bold border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
									autoFocus={index === 0}
									autoComplete="off"
								/>
							))}
						</div>

						{pinError && <p className="text-center text-sm text-destructive">{pinError}</p>}

						{verifyPinMutation.isPending && (
							<div className="flex justify-center">
								<RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
							</div>
						)}
					</div>
				</DialogContent>
			</Dialog>
		)
	}

	return (
		<div className="flex flex-col h-full overflow-hidden">
			<div className="m-4 mb-0 p-4">
				<div className="flex items-center justify-between gap-4 flex-wrap">
					<div className="flex items-center gap-2">
						<ShieldCheck className="h-6 w-6 text-primary" />
						<h1 className="text-2xl font-bold">Audit Settings</h1>
					</div>
				</div>

				<div className="mt-4 border-t pt-4">
					<div className="flex items-center gap-2">
						<Settings className="h-5 w-5 text-muted-foreground" />
						<span className="text-sm font-medium">Audit Settings & Cloud Sync</span>
					</div>
				</div>
			</div>

			<div className="flex-1 overflow-hidden mt-4">
				<div className="h-full overflow-hidden">
					<div className="h-full overflow-auto p-4">
						<div className="max-w-4xl mx-auto">
							<Tabs value={settingsTab} onValueChange={setSettingsTab} className="w-full">
								<TabsList className="grid grid-cols-4 mb-6">
									<TabsTrigger value="pin" className="flex items-center gap-2">
										<Key className="h-4 w-4" />
										PIN
									</TabsTrigger>
									<TabsTrigger value="permissions" className="flex items-center gap-2">
										<Users className="h-4 w-4" />
										Permissions
									</TabsTrigger>
									<TabsTrigger value="cloud" className="flex items-center gap-2">
										<Cloud className="h-4 w-4" />
										Cloud Sync
									</TabsTrigger>
									<TabsTrigger value="system" className="flex items-center gap-2">
										<Cpu className="h-4 w-4" />
										System
									</TabsTrigger>
								</TabsList>

								{/* PIN SETTINGS TAB */}
								<TabsContent value="pin" className="space-y-6">
									<Card>
										<CardHeader>
											<CardTitle className="flex items-center gap-2">
												<Lock className="h-5 w-5" />
												Change Audit PIN
											</CardTitle>
										</CardHeader>
										<CardContent className="space-y-4">
											{isDefaultPin && (
												<div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-md">
													<AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
													<p className="text-sm text-yellow-700 dark:text-yellow-300">
														You are using the default PIN. Please change it for security.
													</p>
												</div>
											)}

											<div className="space-y-2">
												<Label htmlFor="currentPin">Current PIN</Label>
												<div className="relative">
													<Input
														id="currentPin"
														type={showCurrentPin ? "text" : "password"}
														value={currentPin}
														onChange={(e) => setCurrentPin(e.target.value)}
														placeholder={isDefaultPin ? "Default: 0000" : "Enter current PIN"}
														maxLength={4}
													/>
													<Button
														type="button"
														variant="ghost"
														size="icon"
														className="absolute right-0 top-0"
														onClick={() => setShowCurrentPin(!showCurrentPin)}
													>
														{showCurrentPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
													</Button>
												</div>
											</div>

											<div className="space-y-2">
												<Label htmlFor="newPin">New PIN</Label>
												<div className="relative">
													<Input
														id="newPin"
														type={showNewPin ? "text" : "password"}
														value={newPin}
														onChange={(e) => setNewPin(e.target.value)}
														placeholder="Enter new 4-digit PIN"
														maxLength={4}
													/>
													<Button
														type="button"
														variant="ghost"
														size="icon"
														className="absolute right-0 top-0"
														onClick={() => setShowNewPin(!showNewPin)}
													>
														{showNewPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
													</Button>
												</div>
											</div>

											<div className="space-y-2">
												<Label htmlFor="confirmPin">Confirm New PIN</Label>
												<div className="relative">
													<Input
														id="confirmPin"
														type={showConfirmPin ? "text" : "password"}
														value={confirmPin}
														onChange={(e) => setConfirmPin(e.target.value)}
														placeholder="Confirm new PIN"
														maxLength={4}
													/>
													<Button
														type="button"
														variant="ghost"
														size="icon"
														className="absolute right-0 top-0"
														onClick={() => setShowConfirmPin(!showConfirmPin)}
													>
														{showConfirmPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
													</Button>
												</div>
											</div>

											<Button
												onClick={handlePinChange}
												className="w-full"
												disabled={changePinMutation.isPending}
											>
												{changePinMutation.isPending ? (
													<RefreshCw className="h-4 w-4 mr-2 animate-spin" />
												) : (
													<Lock className="h-4 w-4 mr-2" />
												)}
												Change PIN
											</Button>
										</CardContent>
									</Card>
								</TabsContent>

								{/* PERMISSIONS TAB */}
								<TabsContent value="permissions" className="space-y-6">
									<Card>
										<CardHeader>
											<CardTitle className="flex items-center gap-2">
												<ShieldCheck className="h-5 w-5" />
												Access Control Permissions
											</CardTitle>
										</CardHeader>
										<CardContent className="space-y-6">
											<p className="text-sm text-muted-foreground">
												Control which actions are allowed in the application. Disabled actions will be hidden throughout
												the software.
											</p>

											<div className="space-y-4">
												<div className="border-b pb-3">
													<h4 className="font-medium flex items-center gap-2 mb-3">
														<Package className="h-4 w-4" />
														Stock Management
													</h4>
													<div className="space-y-3 pl-6">
														<div className="flex items-center justify-between">
															<div className="space-y-0.5">
																<Label className="flex items-center gap-2">
																	<Edit className="h-4 w-4 text-blue-500" />
																	Edit Products/Variants/Colors
																</Label>
																<p className="text-xs text-muted-foreground">Allow editing stock items</p>
															</div>
															<Switch
																checked={appSettings?.permStockEdit ?? true}
																onCheckedChange={(checked) => handlePermissionChange("permStockEdit", checked)}
															/>
														</div>
														<div className="flex items-center justify-between">
															<div className="space-y-0.5">
																<Label className="flex items-center gap-2">
																	<Trash2 className="h-4 w-4 text-red-500" />
																	Delete Products/Variants/Colors
																</Label>
																<p className="text-xs text-muted-foreground">Allow deleting stock items</p>
															</div>
															<Switch
																checked={appSettings?.permStockDelete ?? true}
																onCheckedChange={(checked) => handlePermissionChange("permStockDelete", checked)}
															/>
														</div>
													</div>
												</div>

												<div className="border-b pb-3">
													<h4 className="font-medium flex items-center gap-2 mb-3">
														<Receipt className="h-4 w-4" />
														Sales / Bills
													</h4>
													<div className="space-y-3 pl-6">
														<div className="flex items-center justify-between">
															<div className="space-y-0.5">
																<Label className="flex items-center gap-2">
																	<Edit className="h-4 w-4 text-blue-500" />
																	Edit Bills
																</Label>
																<p className="text-xs text-muted-foreground">Allow editing sales bills</p>
															</div>
															<Switch
																checked={appSettings?.permSalesEdit ?? true}
																onCheckedChange={(checked) => handlePermissionChange("permSalesEdit", checked)}
															/>
														</div>
														<div className="flex items-center justify-between">
															<div className="space-y-0.5">
																<Label className="flex items-center gap-2">
																	<Trash2 className="h-4 w-4 text-red-500" />
																	Delete Bills
																</Label>
																<p className="text-xs text-muted-foreground">Allow deleting sales bills</p>
															</div>
															<Switch
																checked={appSettings?.permSalesDelete ?? true}
																onCheckedChange={(checked) => handlePermissionChange("permSalesDelete", checked)}
															/>
														</div>
													</div>
												</div>

												<div className="border-b pb-3">
													<h4 className="font-medium flex items-center gap-2 mb-3">
														<CreditCard className="h-4 w-4" />
														Payments
													</h4>
													<div className="space-y-3 pl-6">
														<div className="flex items-center justify-between">
															<div className="space-y-0.5">
																<Label className="flex items-center gap-2">
																	<Edit className="h-4 w-4 text-blue-500" />
																	Edit Payments
																</Label>
																<p className="text-xs text-muted-foreground">Allow editing payment records</p>
															</div>
															<Switch
																checked={appSettings?.permPaymentEdit ?? true}
																onCheckedChange={(checked) => handlePermissionChange("permPaymentEdit", checked)}
															/>
														</div>
														<div className="flex items-center justify-between">
															<div className="space-y-0.5">
																<Label className="flex items-center gap-2">
																	<Trash2 className="h-4 w-4 text-red-500" />
																	Delete Payments
																</Label>
																<p className="text-xs text-muted-foreground">Allow deleting payment records</p>
															</div>
															<Switch
																checked={appSettings?.permPaymentDelete ?? true}
																onCheckedChange={(checked) => handlePermissionChange("permPaymentDelete", checked)}
															/>
														</div>
													</div>
												</div>
											</div>
										</CardContent>
									</Card>
								</TabsContent>

								{/* CLOUD SYNC TAB */}
								<TabsContent value="cloud" className="space-y-6">
									<Card>
										<CardHeader>
											<CardTitle className="flex items-center gap-2">
												<Cloud className="h-5 w-5 text-blue-500" />
												Cloud Database Sync
											</CardTitle>
										</CardHeader>
										<CardContent className="space-y-6">
											<div className="text-sm text-muted-foreground">
												Connect to a cloud PostgreSQL database (Neon, Supabase) to sync your data across multiple devices.
											</div>

											<div className="space-y-4">
												<div className="space-y-2">
													<Label htmlFor="cloudUrl" className="flex items-center gap-2">
														<Database className="h-4 w-4" />
														PostgreSQL Connection URL
													</Label>
													<div className="relative">
														<Input
															id="cloudUrl"
															type={showCloudUrl ? "text" : "password"}
															value={cloudUrl}
															onChange={(e) => {
																setCloudUrl(e.target.value)
																setCloudConnectionStatus("idle")
															}}
															placeholder="postgresql://user:password@host/database"
															className="pr-20"
														/>
														<div className="absolute right-0 top-0 flex">
															<Button
																type="button"
																variant="ghost"
																size="icon"
																onClick={() => setShowCloudUrl(!showCloudUrl)}
															>
																{showCloudUrl ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
															</Button>
															{cloudConnectionStatus === "success" && (
																<div className="flex items-center text-green-500 pr-2">
																	<Check className="h-4 w-4" />
																</div>
															)}
															{cloudConnectionStatus === "error" && (
																<div className="flex items-center text-red-500 pr-2">
																	<XCircle className="h-4 w-4" />
																</div>
															)}
														</div>
													</div>
													<p className="text-xs text-muted-foreground">
														Example: postgresql://username:password@hostname/database
													</p>
												</div>

												<Button
													onClick={handleTestConnection}
													variant="outline"
													className="w-full bg-transparent"
													disabled={cloudConnectionStatus === "testing" || !cloudUrl.trim()}
												>
													{cloudConnectionStatus === "testing" ? (
														<Loader2 className="h-4 w-4 mr-2 animate-spin" />
													) : cloudConnectionStatus === "success" ? (
														<Check className="h-4 w-4 mr-2 text-green-500" />
													) : cloudConnectionStatus === "error" ? (
														<XCircle className="h-4 w-4 mr-2 text-red-500" />
													) : (
														<Database className="h-4 w-4 mr-2" />
													)}
													{cloudConnectionStatus === "testing"
														? "Testing..."
														: cloudConnectionStatus === "success"
															? "Connected"
															: cloudConnectionStatus === "error"
																? "Connection Failed"
																: "Test Connection"}
												</Button>
												<div className="border-t pt-4">
													<h4 className="font-medium mb-3 flex items-center gap-2">
														<RefreshCw className="h-4 w-4" />
														Manual Sync Actions
													</h4>

													<div className="grid grid-cols-2 gap-3">
														<Button
															onClick={handleExportToCloud}
															variant="default"
															disabled={cloudSyncStatus !== "idle" || !cloudUrl.trim()}
															className="flex items-center gap-2"
														>
															{cloudSyncStatus === "exporting" ? (
																<Loader2 className="h-4 w-4 animate-spin" />
															) : (
																<Upload className="h-4 w-4" />
															)}
															{cloudSyncStatus === "exporting" ? "Exporting..." : "Export to Cloud"}
														</Button>

														<Button
															onClick={handleImportFromCloud}
															variant="outline"
															disabled={cloudSyncStatus !== "idle" || !cloudUrl.trim()}
															className="flex items-center gap-2 bg-transparent"
														>
															{cloudSyncStatus === "importing" ? (
																<Loader2 className="h-4 w-4 animate-spin" />
															) : (
																<Download className="h-4 w-4" />
															)}
															{cloudSyncStatus === "importing" ? "Importing..." : "Import from Cloud"}
														</Button>
													</div>
												</div>

												<div className="border-t pt-4">
													<h4 className="font-medium mb-3 flex items-center gap-2">
														<Activity className="h-4 w-4" />
														Export/Import History
													</h4>

													<div className="space-y-3">
														{lastExportCounts && (
															<div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
																<div className="flex items-center gap-2 mb-2">
																	<Upload className="h-4 w-4 text-blue-500" />
																	<span className="text-sm font-medium text-blue-700 dark:text-blue-300">Last Export</span>
																</div>
																<div className="grid grid-cols-3 gap-2 text-xs">
																	{lastExportCounts.products !== undefined && (
																		<div className="text-center">
																			<div className="font-bold text-blue-600">{lastExportCounts.products}</div>
																			<div className="text-muted-foreground">Products</div>
																		</div>
																	)}
																	{lastExportCounts.colors !== undefined && (
																		<div className="text-center">
																			<div className="font-bold text-blue-600">{lastExportCounts.colors}</div>
																			<div className="text-muted-foreground">Colors</div>
																		</div>
																	)}
																	{lastExportCounts.sales !== undefined && (
																		<div className="text-center">
																			<div className="font-bold text-blue-600">{lastExportCounts.sales}</div>
																			<div className="text-muted-foreground">Sales</div>
																		</div>
																	)}
																</div>
															</div>
														)}

														{lastImportCounts && (
															<div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
																<div className="flex items-center gap-2 mb-2">
																	<Download className="h-4 w-4 text-purple-500" />
																	<span className="text-sm font-medium text-purple-700 dark:text-purple-300">Last Import</span>
																</div>
																<div className="grid grid-cols-3 gap-2 text-xs">
																	{lastImportCounts.products !== undefined && (
																		<div className="text-center">
																			<div className="font-bold text-purple-600">{lastImportCounts.products}</div>
																			<div className="text-muted-foreground">Products</div>
																		</div>
																	)}
																	{lastImportCounts.colors !== undefined && (
																		<div className="text-center">
																			<div className="font-bold text-purple-600">{lastImportCounts.colors}</div>
																			<div className="text-muted-foreground">Colors</div>
																		</div>
																	)}
																	{lastImportCounts.sales !== undefined && (
																		<div className="text-center">
																			<div className="font-bold text-purple-600">{lastImportCounts.sales}</div>
																			<div className="text-muted-foreground">Sales</div>
																		</div>
																	)}
																</div>
															</div>
														)}
													</div>
												</div>
											</div>
										</CardContent>
									</Card>
								</TabsContent>

								{/* SYSTEM TAB */}
								<TabsContent value="system" className="space-y-6">
									<Card>
										<CardHeader>
											<CardTitle className="flex items-center gap-2">
												<Cpu className="h-5 w-5" />
												System Information
											</CardTitle>
										</CardHeader>
										<CardContent>
											<div className="grid grid-cols-2 gap-4">
												<div className="space-y-2">
													<Label className="text-sm font-medium">Cloud Status</Label>
													<div className="flex items-center gap-2">
														{cloudConnectionStatus === "success" ? (
															<Check className="h-4 w-4 text-green-500" />
														) : (
															<XCircle className="h-4 w-4 text-red-500" />
														)}
														<span className={cloudConnectionStatus === "success" ? "text-green-600" : "text-red-600"}>
															{cloudConnectionStatus === "success" ? "Connected" : "Not Connected"}
														</span>
													</div>
													<p className="text-xs text-muted-foreground">
														{cloudConnectionStatus === "success" ? "Cloud sync enabled" : "Manual sync only"}
													</p>
												</div>
											</div>

											<div className="border-t pt-4">
												<h4 className="font-medium mb-3">Quick Actions</h4>
												<div className="grid grid-cols-2 gap-3">
													<Button
														variant="outline"
														className="flex items-center gap-2 bg-transparent"
														onClick={() => {
															queryClient.invalidateQueries()
															toast({
																title: "Data Refreshed",
																description: "Data has been refreshed from server.",
															})
														}}
													>
														<RefreshCw className="h-4 w-4" />
														Refresh Data
													</Button>
													<Button 
														variant="outline" 
														className="flex items-center gap-2 bg-transparent"
														onClick={async () => {
															try {
																const response = await fetch("/api/database/export")
																if (response.ok) {
																	const blob = await response.blob()
																	const url = window.URL.createObjectURL(blob)
																	const a = document.createElement("a")
																	a.href = url
																	a.download = `paintpulse-backup-${new Date().toISOString().split("T")[0]}.db`
																	document.body.appendChild(a)
																	a.click()
																	document.body.removeChild(a)
																	window.URL.revokeObjectURL(url)
																	toast({
																		title: "Backup Complete",
																		description: "Database backup has been downloaded.",
																	})
																}
															} catch (error) {
																toast({
																	title: "Backup Failed", 
																	description: "Could not create database backup.",
																	variant: "destructive",
																})
															}
														}}
													>
														<Database className="h-4 w-4" />
														Backup Database
													</Button>
												</div>
											</div>

											<div className="border-t pt-4">
												<div className="bg-gradient-to-r from-primary/5 to-primary/10 dark:from-primary/10 dark:to-primary/20 rounded-lg p-4 border border-primary/20">
													<div className="text-center space-y-3">
														<div>
															<h3 className="text-lg font-bold text-foreground">
																PaintPulse POS System
															</h3>
															<p className="text-sm text-muted-foreground mt-1">
																Point of Sale & Inventory Management
															</p>
														</div>
														<div className="border-t border-primary/20 pt-3">
															<p className="text-xs text-muted-foreground">
																Version 1.0.0 • Cloud Sync Enabled
															</p>
														</div>
													</div>
												</div>
											</div>
										</CardContent>
									</Card>
								</TabsContent>
							</Tabs>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}