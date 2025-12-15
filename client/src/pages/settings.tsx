import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Settings2, Receipt, Bluetooth, Printer, Database, Download, Upload, FolderOpen, Palette, CalendarDays, Check, Lock, Eye, EyeOff, ShieldCheck, Key, Calendar, AlertCircle, Zap } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { Settings as UISettings, UpdateSettings } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

type DateFormatType = "DD-MM-YYYY" | "MM-DD-YYYY" | "YYYY-MM-DD";

const dateFormats: { value: DateFormatType; label: string; description: string; example: string }[] = [
  {
    value: "DD-MM-YYYY",
    label: "DD-MM-YYYY",
    description: "Day-Month-Year (Default)",
    example: format(new Date(), "dd-MM-yyyy"),
  },
  {
    value: "MM-DD-YYYY",
    label: "MM-DD-YYYY",
    description: "Month-Day-Year (US Format)",
    example: format(new Date(), "MM-dd-yyyy"),
  },
  {
    value: "YYYY-MM-DD",
    label: "YYYY-MM-DD",
    description: "Year-Month-Day (ISO Format)",
    example: format(new Date(), "yyyy-MM-dd"),
  },
];

export default function Settings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [cloudConn, setCloudConn] = useState("")
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [connections, setConnections] = useState<any[]>([])
  const [connectionsLoading, setConnectionsLoading] = useState(false)
  
  // License settings state
  const [licenseExpiryDate, setLicenseExpiryDate] = useState<string>("");
  const [licenseStatus, setLicenseStatus] = useState<"active" | "expired">("active");
  const [isLicenseActive, setIsLicenseActive] = useState(true);
  const [showSecretKeyInput, setShowSecretKeyInput] = useState(false);
  const [secretKeyInput, setSecretKeyInput] = useState("");
  const [secretKeyVisible, setSecretKeyVisible] = useState(false);
  const [isSettingLicense, setIsSettingLicense] = useState(false);

  const { data: uiSettings, isLoading: isLoadingSettings } = useQuery<UISettings>({
    queryKey: ["/api/settings"],
  });

  const { data: licenseData, isLoading: isLoadingLicense } = useQuery({
    queryKey: ["/api/license/status"],
    refetchInterval: 60000, // Refetch every minute
  });

  // Update license active status based on API response
  useEffect(() => {
    if (licenseData) {
      setIsLicenseActive(licenseData.isActive === true);
    }
  }, [licenseData]);

  const [uiFormData, setUiFormData] = useState<UpdateSettings>({
    storeName: "PaintPulse",
    cardBorderStyle: "shadow",
    cardShadowSize: "sm",
    cardButtonColor: "gray-900",
    cardPriceColor: "blue-600",
    showStockBadgeBorder: false,
    dateFormat: "DD-MM-YYYY",
  });

  useEffect(() => {
    if (uiSettings) {
      setUiFormData({
        storeName: uiSettings.storeName,
        cardBorderStyle: uiSettings.cardBorderStyle,
        cardShadowSize: uiSettings.cardShadowSize,
        cardButtonColor: uiSettings.cardButtonColor,
        cardPriceColor: uiSettings.cardPriceColor,
        showStockBadgeBorder: uiSettings.showStockBadgeBorder,
        dateFormat: uiSettings.dateFormat || "DD-MM-YYYY",
      });
    }
  }, [uiSettings]);

  const updateUiMutation = useMutation({
    mutationFn: async (data: UpdateSettings) => {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update settings");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: "Settings Saved",
        description: "Your settings have been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      });
    },
  });
  
  const [databasePath, setDatabasePath] = useState<string>("");
  const [isElectron, setIsElectron] = useState(false);

  const [isDatabaseUnlocked, setIsDatabaseUnlocked] = useState(false);
  const [showDatabasePinDialog, setShowDatabasePinDialog] = useState(false);
  const [databasePinInput, setDatabasePinInput] = useState(["", "", "", ""]);
  const [databasePinError, setDatabasePinError] = useState("");
  const [showDatabasePin, setShowDatabasePin] = useState(false);
  const [isVerifyingPin, setIsVerifyingPin] = useState(false);

  const handleDatabaseTabClick = () => {
    if (!uiSettings?.permDatabaseAccess) {
      toast({
        title: "Access Denied",
        description: "Database access is disabled in Audit Settings.",
        variant: "destructive",
      });
      return;
    }
    if (!isDatabaseUnlocked) {
      setShowDatabasePinDialog(true);
    }
  };

  const handleDatabasePinInput = (index: number, value: string) => {
    if (value.length > 1) return;
    if (value && !/^\d$/.test(value)) return;

    const newPin = [...databasePinInput];
    newPin[index] = value;
    setDatabasePinInput(newPin);
    setDatabasePinError("");

    if (value && index < 3) {
      const nextInput = document.querySelector(`[data-testid="input-db-pin-${index + 1}"]`) as HTMLInputElement;
      nextInput?.focus();
    }

    if (newPin.every(d => d !== "") && index === 3) {
      verifyDatabasePin(newPin.join(""));
    }
  };

  const verifyDatabasePin = async (pin: string) => {
    setIsVerifyingPin(true);
    try {
      const response = await apiRequest("POST", "/api/audit/verify", { pin });
      if (response.ok) {
        setIsDatabaseUnlocked(true);
        setShowDatabasePinDialog(false);
        setDatabasePinInput(["", "", "", ""]);
        toast({
          title: "Database Unlocked",
          description: "You can now access database management.",
        });
      }
    } catch (error) {
      setDatabasePinError("Invalid PIN. Please try again.");
      setDatabasePinInput(["", "", "", ""]);
      const firstInput = document.querySelector('[data-testid="input-db-pin-0"]') as HTMLInputElement;
      firstInput?.focus();
    } finally {
      setIsVerifyingPin(false);
    }
  };
  
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).electron) {
      setIsElectron(true);
      (window as any).electron.getDatabasePath().then((path: string) => {
        setDatabasePath(path);
      });
    }
    
    try {
      const savedReceiptSettings = localStorage.getItem('posReceiptSettings');
      if (savedReceiptSettings) {
        const settings = JSON.parse(savedReceiptSettings);
        setReceiptBusinessName(settings.businessName || "ALI MUHAMMAD PAINTS");
        setReceiptAddress(settings.address || "Basti Malook, Multan. 0300-868-3395");
        setReceiptDealerText(settings.dealerText || "AUTHORIZED DEALER:");
        setReceiptDealerBrands(settings.dealerBrands || "ICI-DULUX • MOBI PAINTS • WESTER 77");
        setReceiptThankYou(settings.thankYou || "THANKS FOR YOUR BUSINESS");
        setReceiptFontSize(settings.fontSize || "11");
        setReceiptItemFontSize(settings.itemFontSize || "12");
        setReceiptPadding(settings.padding || "12");
      }
    } catch (error) {
      console.error("Error loading receipt settings:", error);
    }
  }, []);

  const [showCompanyName, setShowCompanyName] = useState(true);
  const [showGST, setShowGST] = useState(true);
  const [autoprint, setAutoprint] = useState(false);
  const [billFooter, setBillFooter] = useState("Thank you for your business!");
  
  const [receiptBusinessName, setReceiptBusinessName] = useState("ALI MUHAMMAD PAINTS");
  const [receiptAddress, setReceiptAddress] = useState("Basti Malook, Multan. 0300-868-3395");
  const [receiptDealerText, setReceiptDealerText] = useState("AUTHORIZED DEALER:");
  const [receiptDealerBrands, setReceiptDealerBrands] = useState("ICI-DULUX • MOBI PAINTS • WESTER 77");
  const [receiptThankYou, setReceiptThankYou] = useState("THANKS FOR YOUR BUSINESS");
  const [receiptFontSize, setReceiptFontSize] = useState("11");
  const [receiptItemFontSize, setReceiptItemFontSize] = useState("12");
  const [receiptPadding, setReceiptPadding] = useState("12");

  const [bluetoothEnabled, setBluetoothEnabled] = useState(false);
  const [connectedDevice, setConnectedDevice] = useState<string | null>(null);

  const handleSaveBillSettings = () => {
    const receiptSettings = {
      businessName: receiptBusinessName,
      address: receiptAddress,
      dealerText: receiptDealerText,
      dealerBrands: receiptDealerBrands,
      thankYou: receiptThankYou,
      fontSize: receiptFontSize,
      itemFontSize: receiptItemFontSize,
      padding: receiptPadding,
    };
    localStorage.setItem('posReceiptSettings', JSON.stringify(receiptSettings));
    toast({ title: "Receipt settings saved successfully" });
  };

  const handleConnectBluetooth = async () => {
    try {
      const device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['battery_service']
      });
      
      setConnectedDevice(device.name);
      setBluetoothEnabled(true);
      toast({ title: `Connected to ${device.name}` });
    } catch (error) {
      toast({ 
        title: "Bluetooth connection failed", 
        description: "Make sure Bluetooth is enabled and the device is in pairing mode",
        variant: "destructive" 
      });
    }
  };

  const handleDisconnectBluetooth = () => {
    setConnectedDevice(null);
    setBluetoothEnabled(false);
    toast({ title: "Bluetooth disconnected" });
  };
  
  const handleChangeDatabaseLocation = async () => {
    if (!(window as any).electron) return;
    
    try {
      const newPath = await (window as any).electron.selectDatabaseLocation();
      if (newPath) {
        toast({
          title: "Database Location Changed",
          description: "Application will restart to apply changes.",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to change database location.",
        variant: "destructive",
      });
    }
  };

  const handleExportDatabase = async () => {
    if ((window as any).electron) {
      try {
        const result = await (window as any).electron.exportDatabase();
        if (result.success) {
          toast({
            title: "Export Successful",
            description: `Database exported successfully!`,
          });
        } else {
          toast({
            title: "Export Failed",
            description: result.error || "Unknown error occurred",
            variant: "destructive",
          });
        }
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to export database.",
          variant: "destructive",
        });
      }
    } else {
      try {
        const response = await fetch("/api/database/export");
        if (!response.ok) throw new Error("Export failed");
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `paintpulse-backup-${new Date().toISOString().split('T')[0]}.db`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        toast({
          title: "Export Successful",
          description: "Database backup downloaded successfully!",
        });
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to export database.",
          variant: "destructive",
        });
      }
    }
  };

  const handleImportDatabase = async () => {
    if ((window as any).electron) {
      try {
        const result = await (window as any).electron.importDatabase();
        if (result.success) {
          toast({
            title: "Import Successful",
            description: "Application will restart to apply changes.",
          });
        } else {
          toast({
            title: "Import Failed",
            description: result.error || "Unknown error occurred",
            variant: "destructive",
          });
        }
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to import database.",
          variant: "destructive",
        });
      }
    } else {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.db';
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        
        try {
          const reader = new FileReader();
          reader.onload = async (e) => {
            const arrayBuffer = e.target?.result as ArrayBuffer;
            const base64 = btoa(
              new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
            );
            
            const response = await fetch("/api/database/import", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ fileData: base64 }),
            });
            
            const result = await response.json();
            
            if (response.ok && result.success) {
              toast({
                title: "Import Successful",
                description: "Database imported. Refreshing page...",
              });
              setTimeout(() => window.location.reload(), 1500);
            } else {
              toast({
                title: "Import Failed",
                description: result.error || "Unknown error occurred",
                variant: "destructive",
              });
            }
          };
          reader.readAsArrayBuffer(file);
        } catch (error) {
          toast({
            title: "Error",
            description: "Failed to import database.",
            variant: "destructive",
          });
        }
      };
      input.click();
    }
  };

  // License management handlers
  const handleSetLicenseExpiry = async () => {
    if (!licenseExpiryDate) {
      toast({
        title: "Error",
        description: "Please select an expiration date",
        variant: "destructive",
      });
      return;
    }

    setIsSettingLicense(true);
    try {
      const response = await fetch("/api/license/set-expiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expiryDate: licenseExpiryDate }),
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: `License expiry date set to ${licenseExpiryDate}`,
        });
        queryClient.invalidateQueries({ queryKey: ["/api/license/status"] });
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Failed to set license expiry",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to set license expiry",
        variant: "destructive",
      });
    } finally {
      setIsSettingLicense(false);
    }
  };

  const handleDeactivateLicense = async () => {
    if (!window.confirm("Are you sure you want to deactivate the license? The software will become unusable.")) {
      return;
    }

    setIsSettingLicense(true);
    try {
      const response = await fetch("/api/license/deactivate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (response.ok) {
        toast({
          title: "License Deactivated",
          description: "The software license has been deactivated.",
        });
        setIsLicenseActive(false);
        queryClient.invalidateQueries({ queryKey: ["/api/license/status"] });
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Failed to deactivate license",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to deactivate license",
        variant: "destructive",
      });
    } finally {
      setIsSettingLicense(false);
    }
  };

  const handleActivateLicense = async () => {
    if (!secretKeyInput.trim()) {
      toast({
        title: "Error",
        description: "Please enter your secret key",
        variant: "destructive",
      });
      return;
    }

    setIsSettingLicense(true);
    try {
      const response = await fetch("/api/license/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secretKey: secretKeyInput }),
      });

      if (response.ok) {
        toast({
          title: "License Activated",
          description: "Your license has been successfully reactivated!",
        });
        setSecretKeyInput("");
        setShowSecretKeyInput(false);
        setIsLicenseActive(true);
        queryClient.invalidateQueries({ queryKey: ["/api/license/status"] });
      } else {
        const error = await response.json();
        toast({
          title: "Activation Failed",
          description: error.error || "Invalid secret key",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to activate license",
        variant: "destructive",
      });
    } finally {
      setIsSettingLicense(false);
    }
  };

  const handleTestCloudConnection = async () => {
    if (!cloudConn) return;
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await apiRequest("POST", "/api/cloud-sync/test-connection", { connectionString: cloudConn });
      const json = await res.json();
      if (res.ok && json.ok) {
        setTestResult({ ok: true });
        toast({ title: "Connection Successful", description: "Remote Postgres connection validated." });
      } else {
        setTestResult({ ok: false, error: json.error || "Connection failed" });
        toast({ title: "Connection Failed", description: json.error || "Unable to connect", variant: "destructive" });
      }
    } catch (err: any) {
      setTestResult({ ok: false, error: err.message || String(err) });
      toast({ title: "Connection Error", description: err.message || String(err), variant: "destructive" });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="glass-page p-6 space-y-6 max-w-5xl">
      <div className="glass-surface p-4">
        <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-settings-title">
          Settings
        </h1>
        <p className="text-sm text-muted-foreground">Manage your store, display, and system settings</p>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="glass-tabs-list grid w-full grid-cols-6">
          <TabsTrigger value="general" className="glass-tab" data-testid="tab-general-settings">
            <Settings2 className="h-4 w-4 mr-2" />
            General
          </TabsTrigger>
          <TabsTrigger value="display" className="glass-tab" data-testid="tab-display-settings">
            <Palette className="h-4 w-4 mr-2" />
            Display
          </TabsTrigger>
          <TabsTrigger value="receipts" className="glass-tab" data-testid="tab-receipts-settings">
            <Receipt className="h-4 w-4 mr-2" />
            Receipts
          </TabsTrigger>
          <TabsTrigger value="printer" className="glass-tab" data-testid="tab-printer-settings">
            <Printer className="h-4 w-4 mr-2" />
            Printer
          </TabsTrigger>
          <TabsTrigger value="license" className="glass-tab" data-testid="tab-license-settings">
            <Key className="h-4 w-4 mr-2" />
            License
            {!isLicenseActive && (
              <AlertCircle className="h-3 w-3 ml-1 text-destructive" />
            )}
          </TabsTrigger>
          <TabsTrigger 
            value="database" 
            className="glass-tab"
            data-testid="tab-database-settings"
            onClick={handleDatabaseTabClick}
            disabled={!uiSettings?.permDatabaseAccess}
          >
            <Database className="h-4 w-4 mr-2" />
            Database
            {!isDatabaseUnlocked && uiSettings?.permDatabaseAccess && (
              <Lock className="h-3 w-3 ml-1 text-muted-foreground" />
            )}
          </TabsTrigger>
        </TabsList>

        {/* Database PIN Verification Dialog */}
        <Dialog open={showDatabasePinDialog} onOpenChange={setShowDatabasePinDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                Enter Audit PIN
              </DialogTitle>
              <DialogDescription>
                Database access requires verification. Enter your 4-digit audit PIN.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex justify-center gap-3">
                {[0, 1, 2, 3].map((index) => (
                  <Input
                    key={index}
                    type={showDatabasePin ? "text" : "password"}
                    inputMode="numeric"
                    maxLength={1}
                    value={databasePinInput[index]}
                    onChange={(e) => handleDatabasePinInput(index, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Backspace" && !databasePinInput[index] && index > 0) {
                        const prevInput = document.querySelector(`[data-testid="input-db-pin-${index - 1}"]`) as HTMLInputElement;
                        prevInput?.focus();
                      }
                    }}
                    className="w-14 h-14 text-center text-2xl font-bold"
                    data-testid={`input-db-pin-${index}`}
                    disabled={isVerifyingPin}
                    autoFocus={index === 0}
                  />
                ))}
              </div>

              <div className="flex justify-center">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDatabasePin(!showDatabasePin)}
                  className="flex items-center gap-2"
                >
                  {showDatabasePin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  {showDatabasePin ? "Hide PIN" : "Show PIN"}
                </Button>
              </div>

              {databasePinError && (
                <p className="text-sm text-destructive text-center">{databasePinError}</p>
              )}

              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <ShieldCheck className="h-4 w-4" />
                <span>Default PIN is 0000</span>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* General Settings - UI + Date Format */}
        <TabsContent value="general" className="space-y-4">
          {/* Store Branding */}
          <div className="glass-card p-5">
            <div className="flex items-center gap-2 mb-1">
              <Palette className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <h3 className="font-semibold">Store Branding</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">Customize your store name and appearance</p>
            <div>
              <Label htmlFor="uiStoreName">Store Name</Label>
              <Input
                id="uiStoreName"
                value={uiFormData.storeName}
                onChange={(e) => setUiFormData({ ...uiFormData, storeName: e.target.value })}
                placeholder="Enter store name"
                className="mt-1 glass-input"
                data-testid="input-store-name"
              />
              <p className="text-xs text-muted-foreground mt-1">
                This name appears in the sidebar navigation
              </p>
            </div>
          </div>

          {/* Date Format */}
          <div className="glass-card p-5">
            <div className="flex items-center gap-2 mb-1">
              <CalendarDays className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <h3 className="font-semibold">Date Format</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Choose how dates are displayed across all pages
            </p>
            <RadioGroup
              value={uiFormData.dateFormat || "DD-MM-YYYY"}
              onValueChange={(value) => setUiFormData({ ...uiFormData, dateFormat: value as DateFormatType })}
              className="space-y-3"
            >
              {dateFormats.map((dateFormat) => (
                <div
                  key={dateFormat.value}
                  className={`relative flex items-center space-x-4 rounded-lg border p-3 cursor-pointer transition-all ${
                    uiFormData.dateFormat === dateFormat.value
                      ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 dark:border-blue-400"
                      : "border-border hover:border-muted-foreground/30 bg-white/50 dark:bg-zinc-800/50"
                  }`}
                  onClick={() => setUiFormData({ ...uiFormData, dateFormat: dateFormat.value })}
                  data-testid={`option-${dateFormat.value}`}
                >
                  <RadioGroupItem value={dateFormat.value} id={dateFormat.value} className="sr-only" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Label
                        htmlFor={dateFormat.value}
                        className="font-semibold cursor-pointer"
                      >
                        {dateFormat.label}
                      </Label>
                      {dateFormat.value === "DD-MM-YYYY" && (
                        <Badge variant="secondary" className="text-xs">
                          Default
                        </Badge>
                      )}
                      {uiFormData.dateFormat === dateFormat.value && (
                        <Check className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{dateFormat.description}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground mb-1">Example:</p>
                    <p className="font-mono font-semibold text-blue-600 dark:text-blue-400">
                      {dateFormat.example}
                    </p>
                  </div>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Product Card Design */}
          <div className="glass-card p-5">
            <div className="flex items-center gap-2 mb-1">
              <Settings2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <h3 className="font-semibold">Product Card Design</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">Customize how products appear in POS Sales</p>
            
            <div className="space-y-6">
              <div className="space-y-3">
                <Label>Card Border Style</Label>
                <RadioGroup
                  value={uiFormData.cardBorderStyle}
                  onValueChange={(value: 'shadow' | 'border' | 'none') =>
                    setUiFormData({ ...uiFormData, cardBorderStyle: value })
                  }
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="shadow" id="shadow" />
                    <Label htmlFor="shadow" className="font-normal cursor-pointer">
                      Shadow (Modern)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="border" id="border" />
                    <Label htmlFor="border" className="font-normal cursor-pointer">
                      Border (Classic)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="none" id="none" />
                    <Label htmlFor="none" className="font-normal cursor-pointer">
                      None (Minimal)
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-3">
                <Label htmlFor="shadowSize">Shadow Size</Label>
                <Select
                  value={uiFormData.cardShadowSize}
                  onValueChange={(value: 'sm' | 'md' | 'lg') =>
                    setUiFormData({ ...uiFormData, cardShadowSize: value })
                  }
                >
                  <SelectTrigger id="shadowSize" className="glass-input">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sm">Small</SelectItem>
                    <SelectItem value="md">Medium</SelectItem>
                    <SelectItem value="lg">Large</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label htmlFor="buttonColor">Add to Cart Button Color</Label>
                <Select
                  value={uiFormData.cardButtonColor}
                  onValueChange={(value) => setUiFormData({ ...uiFormData, cardButtonColor: value })}
                >
                  <SelectTrigger id="buttonColor" className="glass-input">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gray-900">Black</SelectItem>
                    <SelectItem value="blue-600">Blue</SelectItem>
                    <SelectItem value="green-600">Green</SelectItem>
                    <SelectItem value="purple-600">Purple</SelectItem>
                    <SelectItem value="red-600">Red</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label htmlFor="priceColor">Price Text Color</Label>
                <Select
                  value={uiFormData.cardPriceColor}
                  onValueChange={(value) => setUiFormData({ ...uiFormData, cardPriceColor: value })}
                >
                  <SelectTrigger id="priceColor" className="glass-input">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="blue-600">Blue</SelectItem>
                    <SelectItem value="green-600">Green</SelectItem>
                    <SelectItem value="purple-600">Purple</SelectItem>
                    <SelectItem value="gray-900">Black</SelectItem>
                    <SelectItem value="orange-600">Orange</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="stockBadgeBorder">Show Stock Badge Border</Label>
                  <p className="text-xs text-muted-foreground">
                    Add border around Low/Out of Stock badges
                  </p>
                </div>
                <Switch
                  id="stockBadgeBorder"
                  checked={uiFormData.showStockBadgeBorder}
                  onCheckedChange={(checked) =>
                    setUiFormData({ ...uiFormData, showStockBadgeBorder: checked })
                  }
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => {
                if (uiSettings) {
                  setUiFormData({
                    storeName: uiSettings.storeName,
                    cardBorderStyle: uiSettings.cardBorderStyle,
                    cardShadowSize: uiSettings.cardShadowSize,
                    cardButtonColor: uiSettings.cardButtonColor,
                    cardPriceColor: uiSettings.cardPriceColor,
                    showStockBadgeBorder: uiSettings.showStockBadgeBorder,
                    dateFormat: uiSettings.dateFormat || "DD-MM-YYYY",
                  });
                }
              }}
            >
              Reset
            </Button>
            <Button onClick={() => updateUiMutation.mutate(uiFormData)} disabled={updateUiMutation.isPending}>
              {updateUiMutation.isPending ? "Saving..." : "Save Settings"}
            </Button>
          </div>
        </TabsContent>

        {/* Display Settings - Theme Controls */}
        <TabsContent value="display" className="space-y-4">
          <div className="glass-card p-5">
            <div className="flex items-center gap-2 mb-1">
              <Palette className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <h3 className="font-semibold">Theme Style</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">Choose your preferred visual theme for the application</p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div 
                className={`p-4 rounded-lg border cursor-pointer transition-all ${
                  uiSettings?.displayTheme === 'glass' || !uiSettings?.displayTheme 
                    ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 dark:border-blue-400' 
                    : 'border-border hover:border-muted-foreground/30 bg-white/50 dark:bg-zinc-800/50'
                }`}
                onClick={() => updateUiMutation.mutate({ displayTheme: 'glass' })}
                data-testid="theme-glass"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-md bg-gradient-to-br from-blue-500/20 to-blue-400/20 backdrop-blur border border-white/20" />
                  <span className="font-medium">Glass</span>
                  {(uiSettings?.displayTheme === 'glass' || !uiSettings?.displayTheme) && (
                    <Check className="h-4 w-4 text-blue-600 dark:text-blue-400 ml-auto" />
                  )}
                </div>
                <p className="text-sm text-muted-foreground">Modern glassmorphism with frosted surfaces</p>
              </div>
              <div 
                className={`p-4 rounded-lg border cursor-pointer transition-all ${
                  uiSettings?.displayTheme === 'flat' 
                    ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 dark:border-blue-400' 
                    : 'border-border hover:border-muted-foreground/30 bg-white/50 dark:bg-zinc-800/50'
                }`}
                onClick={() => updateUiMutation.mutate({ displayTheme: 'flat' })}
                data-testid="theme-flat"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-md bg-card border" />
                  <span className="font-medium">Flat</span>
                  {uiSettings?.displayTheme === 'flat' && (
                    <Check className="h-4 w-4 text-blue-600 dark:text-blue-400 ml-auto" />
                  )}
                </div>
                <p className="text-sm text-muted-foreground">Clean, minimal design with solid backgrounds</p>
              </div>
              <div 
                className={`p-4 rounded-lg border cursor-pointer transition-all ${
                  uiSettings?.displayTheme === 'classic' 
                    ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 dark:border-blue-400' 
                    : 'border-border hover:border-muted-foreground/30 bg-white/50 dark:bg-zinc-800/50'
                }`}
                onClick={() => updateUiMutation.mutate({ displayTheme: 'classic' })}
                data-testid="theme-classic"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-md bg-card border shadow-md" />
                  <span className="font-medium">Classic</span>
                  {uiSettings?.displayTheme === 'classic' && (
                    <Check className="h-4 w-4 text-blue-600 dark:text-blue-400 ml-auto" />
                  )}
                </div>
                <p className="text-sm text-muted-foreground">Traditional card-based layout with shadows</p>
              </div>
            </div>
          </div>

          <div className="glass-card p-5">
            <h3 className="font-semibold mb-1">Shadow Intensity</h3>
            <p className="text-sm text-muted-foreground mb-4">Control the intensity of shadows across the interface</p>
            <RadioGroup
              value={uiSettings?.displayShadowIntensity || 'medium'}
              onValueChange={(value) => updateUiMutation.mutate({ displayShadowIntensity: value })}
              className="flex flex-wrap gap-6"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="light" id="shadow-light" />
                <Label htmlFor="shadow-light" className="cursor-pointer">Light</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="medium" id="shadow-medium" />
                <Label htmlFor="shadow-medium" className="cursor-pointer">Medium</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="strong" id="shadow-strong" />
                <Label htmlFor="shadow-strong" className="cursor-pointer">Strong</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="glass-card p-5">
            <h3 className="font-semibold mb-1">Blur Intensity</h3>
            <p className="text-sm text-muted-foreground mb-4">Control the backdrop blur effect on glass surfaces</p>
            <RadioGroup
              value={uiSettings?.displayBlurIntensity || 'medium'}
              onValueChange={(value) => updateUiMutation.mutate({ displayBlurIntensity: value })}
              className="flex flex-wrap gap-6"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="light" id="blur-light" />
                <Label htmlFor="blur-light" className="cursor-pointer">Light</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="medium" id="blur-medium" />
                <Label htmlFor="blur-medium" className="cursor-pointer">Medium</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="strong" id="blur-strong" />
                <Label htmlFor="blur-strong" className="cursor-pointer">Strong</Label>
              </div>
            </RadioGroup>
          </div>
        </TabsContent>

        {/* Receipts Settings */}
        <TabsContent value="receipts" className="space-y-4">
          <div className="glass-card p-5">
            <div className="flex items-center gap-2 mb-1">
              <Receipt className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <h3 className="font-semibold">Bill Display Settings</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">Customize what appears on printed bills</p>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Show Company Name</Label>
                  <p className="text-sm text-muted-foreground">Display company name on bills</p>
                </div>
                <Switch
                  checked={showCompanyName}
                  onCheckedChange={setShowCompanyName}
                  data-testid="switch-show-company"
                />
              </div>
              <Separator className="opacity-50" />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Show GST</Label>
                  <p className="text-sm text-muted-foreground">Display GST tax on bills</p>
                </div>
                <Switch
                  checked={showGST}
                  onCheckedChange={setShowGST}
                  data-testid="switch-show-gst"
                />
              </div>
              <Separator className="opacity-50" />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Auto-print Bills</Label>
                  <p className="text-sm text-muted-foreground">Automatically print after completing sale</p>
                </div>
                <Switch
                  checked={autoprint}
                  onCheckedChange={setAutoprint}
                  data-testid="switch-autoprint"
                />
              </div>
              <Separator className="opacity-50" />
              <div className="space-y-2">
                <Label htmlFor="billFooter">Bill Footer Message</Label>
                <Input
                  id="billFooter"
                  value={billFooter}
                  onChange={(e) => setBillFooter(e.target.value)}
                  data-testid="input-bill-footer"
                  placeholder="Enter footer message"
                  className="glass-input"
                />
                <p className="text-xs text-muted-foreground">This message appears at the bottom of every bill</p>
              </div>
            </div>
          </div>
          
          <div className="glass-card p-5">
            <div className="flex items-center gap-2 mb-1">
              <Printer className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <h3 className="font-semibold">Thermal Receipt Customization</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">Customize thermal receipt header and footer</p>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="receiptBusinessName">Business Name</Label>
                <Input
                  id="receiptBusinessName"
                  value={receiptBusinessName}
                  onChange={(e) => setReceiptBusinessName(e.target.value)}
                  placeholder="Enter business name"
                  className="glass-input"
                />
                <p className="text-xs text-muted-foreground">Appears at the top of thermal receipt</p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="receiptAddress">Address & Contact</Label>
                <Input
                  id="receiptAddress"
                  value={receiptAddress}
                  onChange={(e) => setReceiptAddress(e.target.value)}
                  placeholder="Enter address and phone"
                  className="glass-input"
                />
                <p className="text-xs text-muted-foreground">Shop address and phone number</p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="receiptDealerText">Dealer Label</Label>
                <Input
                  id="receiptDealerText"
                  value={receiptDealerText}
                  onChange={(e) => setReceiptDealerText(e.target.value)}
                  placeholder="e.g., AUTHORIZED DEALER:"
                  className="glass-input"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="receiptDealerBrands">Dealer Brands</Label>
                <Input
                  id="receiptDealerBrands"
                  value={receiptDealerBrands}
                  onChange={(e) => setReceiptDealerBrands(e.target.value)}
                  placeholder="e.g., ICI-DULUX • MOBI PAINTS • WESTER 77"
                  className="glass-input"
                />
                <p className="text-xs text-muted-foreground">Use bullet to separate brands</p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="receiptThankYou">Thank You Message</Label>
                <Input
                  id="receiptThankYou"
                  value={receiptThankYou}
                  onChange={(e) => setReceiptThankYou(e.target.value)}
                  placeholder="e.g., THANKS FOR YOUR BUSINESS"
                  className="glass-input"
                />
                <p className="text-xs text-muted-foreground">Final message at the bottom of receipt</p>
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="receiptFontSize">General Font Size (px)</Label>
                  <Input
                    id="receiptFontSize"
                    type="number"
                    min="8"
                    max="16"
                    value={receiptFontSize}
                    onChange={(e) => setReceiptFontSize(e.target.value)}
                    placeholder="11"
                    className="glass-input"
                  />
                  <p className="text-xs text-muted-foreground">Base font size</p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="receiptItemFontSize">Item Font Size (px)</Label>
                  <Input
                    id="receiptItemFontSize"
                    type="number"
                    min="10"
                    max="18"
                    value={receiptItemFontSize}
                    onChange={(e) => setReceiptItemFontSize(e.target.value)}
                    placeholder="12"
                    className="glass-input"
                  />
                  <p className="text-xs text-muted-foreground">Item list size</p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="receiptPadding">Padding (px)</Label>
                  <Input
                    id="receiptPadding"
                    type="number"
                    min="0"
                    max="20"
                    value={receiptPadding}
                    onChange={(e) => setReceiptPadding(e.target.value)}
                    placeholder="12"
                    className="glass-input"
                  />
                  <p className="text-xs text-muted-foreground">Side padding</p>
                </div>
              </div>
              
              <Separator className="opacity-50" />
              <div className="flex justify-end">
                <Button onClick={handleSaveBillSettings} data-testid="button-save-bill">
                  Save Receipt Settings
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Printer Settings */}
        <TabsContent value="printer" className="space-y-4">
          <div className="glass-card p-5">
            <div className="flex items-center gap-2 mb-1">
              <Bluetooth className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <h3 className="font-semibold">Bluetooth Printer Connection</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">Connect to Bluetooth thermal printers for wireless printing</p>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border border-border/50 rounded-lg bg-white/50 dark:bg-zinc-800/50">
                <div className="flex items-center gap-3">
                  <Printer className="h-8 w-8 text-muted-foreground" />
                  <div>
                    <p className="font-medium">
                      {connectedDevice ? connectedDevice : "No device connected"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {bluetoothEnabled ? "Connected" : "Not connected"}
                    </p>
                  </div>
                </div>
                {bluetoothEnabled ? (
                  <Button 
                    variant="outline" 
                    onClick={handleDisconnectBluetooth}
                    data-testid="button-disconnect-bluetooth"
                  >
                    Disconnect
                  </Button>
                ) : (
                  <Button 
                    onClick={handleConnectBluetooth}
                    data-testid="button-connect-bluetooth"
                  >
                    <Bluetooth className="h-4 w-4 mr-2" />
                    Connect Printer
                  </Button>
                )}
              </div>

              <div className="p-4 bg-muted/50 rounded-lg">
                <h4 className="text-sm font-medium mb-2">Connection Instructions</h4>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Make sure your Bluetooth printer is turned on</li>
                  <li>Enable pairing mode on your printer</li>
                  <li>Click "Connect Printer" button above</li>
                  <li>Select your printer from the list</li>
                  <li>Wait for connection confirmation</li>
                </ol>
              </div>

              <div className="p-4 border border-amber-500/50 bg-amber-500/10 rounded-lg">
                <p className="text-sm text-amber-900 dark:text-amber-100">
                  <strong>Note:</strong> Bluetooth printing requires a compatible browser (Chrome, Edge) and 
                  a Bluetooth-enabled thermal printer. Make sure your browser has Bluetooth permissions enabled.
                </p>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* License Settings */}
        <TabsContent value="license" className="space-y-4">
          {!isLicenseActive ? (
            /* Deactivated License - Full Screen UI */
            <div className="glass-card p-8" data-testid="card-license-deactivated">
              <div className="py-8">
                <div className="flex flex-col items-center justify-center space-y-6 text-center">
                  <div className="p-6 rounded-full bg-destructive/10">
                    <AlertCircle className="h-12 w-12 text-destructive" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-destructive mb-2">Software Deactivated</h2>
                    <p className="text-muted-foreground max-w-md">
                      Your software license has been deactivated. Enter your secret key below to reactivate and restore full functionality.
                    </p>
                  </div>
                  
                  <div className="w-full max-w-md space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="secretKeyActivation" className="text-left block">Secret Key</Label>
                      <div className="relative">
                        <Input
                          id="secretKeyActivation"
                          type={secretKeyVisible ? "text" : "password"}
                          value={secretKeyInput}
                          onChange={(e) => setSecretKeyInput(e.target.value)}
                          placeholder="Enter your secret activation key"
                          className="glass-input pr-10"
                          data-testid="input-secret-key"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3"
                          onClick={() => setSecretKeyVisible(!secretKeyVisible)}
                        >
                          {secretKeyVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground text-left">
                        Contact your administrator or vendor to get a valid secret key
                      </p>
                    </div>
                    
                    <Button 
                      onClick={handleActivateLicense} 
                      disabled={isSettingLicense || !secretKeyInput.trim()}
                      className="w-full"
                      size="lg"
                    >
                      <Zap className="h-4 w-4 mr-2" />
                      {isSettingLicense ? "Activating..." : "Activate License"}
                    </Button>
                  </div>

                  <div className="p-4 bg-muted/50 rounded-lg text-left w-full max-w-md">
                    <h4 className="font-medium text-sm mb-2">Need Help?</h4>
                    <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                      <li>Contact your software vendor for a new activation key</li>
                      <li>Make sure you're entering the key exactly as provided</li>
                      <li>Check if your subscription or license has been renewed</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Active License - Settings UI */
            <div className="glass-card p-5" data-testid="card-license-active">
              <div className="flex items-center gap-2 mb-1">
                <Key className="h-5 w-5 text-green-600" />
                <h3 className="font-semibold">License Status</h3>
                <Badge variant="default" className="ml-2 bg-green-600">
                  Active
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-6">
                Your software license is active and operational
              </p>

              <div className="space-y-6">
                {/* Current Status Card */}
                <div className="border border-border/50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Zap className="h-5 w-5 text-green-600" />
                      <h4 className="font-semibold">Current Status</h4>
                    </div>
                    <Badge variant="secondary">Operational</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Your software is fully functional. All features are available.
                  </p>
                  {licenseData?.expiryDate && (
                    <p className="text-sm mt-2">
                      <span className="text-muted-foreground">Expires:</span>{" "}
                      <span className="font-medium">{licenseData.expiryDate}</span>
                    </p>
                  )}
                </div>

                {/* Secret Key Activation Section */}
                <div className="border border-border/50 rounded-lg p-4 space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <Key className="h-4 w-4" />
                      Extend License with Secret Key
                    </h4>
                    <p className="text-xs text-muted-foreground mb-3">
                      Enter a valid secret key to extend your license period
                    </p>
                  </div>
                  
                  {showSecretKeyInput ? (
                    <div className="space-y-3">
                      <div className="relative">
                        <Input
                          type={secretKeyVisible ? "text" : "password"}
                          value={secretKeyInput}
                          onChange={(e) => setSecretKeyInput(e.target.value)}
                          placeholder="Enter secret key"
                          className="glass-input pr-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3"
                          onClick={() => setSecretKeyVisible(!secretKeyVisible)}
                        >
                          {secretKeyVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          onClick={handleActivateLicense} 
                          disabled={isSettingLicense || !secretKeyInput.trim()}
                        >
                          {isSettingLicense ? "Activating..." : "Activate"}
                        </Button>
                        <Button 
                          variant="outline" 
                          onClick={() => {
                            setShowSecretKeyInput(false);
                            setSecretKeyInput("");
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button variant="outline" onClick={() => setShowSecretKeyInput(true)}>
                      <Key className="h-4 w-4 mr-2" />
                      Enter Secret Key
                    </Button>
                  )}
                </div>

                {/* License Expiry Settings */}
                <div className="border border-border/50 rounded-lg p-4 space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Set License Expiration
                    </h4>
                    <p className="text-xs text-muted-foreground mb-3">
                      Set a date after which the software will require reactivation
                    </p>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="license-date">Expiration Date</Label>
                      <Input 
                        id="license-date" 
                        type="date" 
                        value={licenseExpiryDate} 
                        onChange={(e) => setLicenseExpiryDate(e.target.value)} 
                        className="mt-1 glass-input" 
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleSetLicenseExpiry} disabled={isSettingLicense}>
                        {isSettingLicense ? 'Saving...' : 'Set Expiry'}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Deactivation Section */}
                <div className="border border-destructive/30 rounded-lg p-4 bg-destructive/5">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="h-4 w-4 text-destructive" />
                    <h4 className="font-semibold text-destructive">Danger Zone</h4>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Deactivating will disable all software functionality until reactivation with a secret key.
                  </p>
                  <Button 
                    variant="destructive" 
                    onClick={handleDeactivateLicense}
                    disabled={isSettingLicense}
                  >
                    Deactivate License
                  </Button>
                </div>
              </div>
            </div>
          )}
        </TabsContent>
        
        {/* Database Settings */}
        <TabsContent value="database" className="space-y-4">
          {!isDatabaseUnlocked ? (
            <div className="glass-card p-5" data-testid="card-database-locked">
              <div className="py-8">
                <div className="flex flex-col items-center justify-center space-y-4 text-center">
                  <div className="p-4 rounded-full bg-muted/50">
                    <Lock className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Database Access Locked</h3>
                    <p className="text-sm text-muted-foreground">
                      Enter your Audit PIN to access database management
                    </p>
                  </div>
                  <Button onClick={() => setShowDatabasePinDialog(true)}>
                    <Lock className="h-4 w-4 mr-2" />
                    Unlock Access
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="glass-card p-5" data-testid="card-database-settings">
              <div className="flex items-center gap-2 mb-1">
                <Database className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <h3 className="font-semibold">Database Management</h3>
                <Badge variant="secondary" className="ml-2">Unlocked</Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-4">Manage your database backups and restore data</p>
              <div className="space-y-4">
                {isElectron && (
                  <>
                    <div className="space-y-2">
                      <Label>Current Database Location</Label>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 p-2 bg-muted/50 rounded-lg text-sm font-mono" data-testid="text-database-path">
                          {databasePath || "Loading..."}
                        </code>
                      </div>
                    </div>
                    <Separator className="opacity-50" />
                  </>
                )}

                <div className="flex flex-wrap gap-3">
                  {isElectron && (
                    <Button 
                      onClick={handleChangeDatabaseLocation}
                      variant="outline"
                      data-testid="button-change-location"
                    >
                      <FolderOpen className="h-4 w-4 mr-2" />
                      Change Location
                    </Button>
                  )}
                  <Button 
                    onClick={handleExportDatabase}
                    variant="outline"
                    data-testid="button-export"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export Backup
                  </Button>
                  <Button 
                    onClick={handleImportDatabase}
                    variant="outline"
                    data-testid="button-import"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Import Database
                  </Button>
                </div>

                <Separator className="opacity-50" />

                <div className="p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-medium text-sm mb-2">Important Notes:</h4>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    {isElectron && <li>Changing database location will restart the application</li>}
                    <li>Export your database regularly to prevent data loss</li>
                    <li>Importing a database will replace your current data</li>
                    <li>Keep your database backups in a safe location</li>
                    <li>Export creates a .db file you can download and save</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
