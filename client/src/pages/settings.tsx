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
import { Settings2, Receipt, Bluetooth, Printer, Database, Download, Upload, FolderOpen, Palette, CalendarDays, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { Settings as UISettings, UpdateSettings } from "@shared/schema";

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

  const { data: uiSettings, isLoading: isLoadingSettings } = useQuery<UISettings>({
    queryKey: ["/api/settings"],
  });

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

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-settings-title">
          Settings
        </h1>
        <p className="text-sm text-muted-foreground">Manage your store, display, and system settings</p>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="general" data-testid="tab-general-settings">
            <Settings2 className="h-4 w-4 mr-2" />
            General
          </TabsTrigger>
          <TabsTrigger value="receipts" data-testid="tab-receipts-settings">
            <Receipt className="h-4 w-4 mr-2" />
            Receipts
          </TabsTrigger>
          <TabsTrigger value="printer" data-testid="tab-printer-settings">
            <Printer className="h-4 w-4 mr-2" />
            Printer
          </TabsTrigger>
          <TabsTrigger value="database" data-testid="tab-database-settings">
            <Database className="h-4 w-4 mr-2" />
            Database
          </TabsTrigger>
        </TabsList>

        {/* General Settings - UI + Date Format */}
        <TabsContent value="general" className="space-y-4">
          {/* Store Branding */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Palette className="h-5 w-5 text-purple-600" />
                <CardTitle>Store Branding</CardTitle>
              </div>
              <CardDescription>Customize your store name and appearance</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="uiStoreName">Store Name</Label>
                <Input
                  id="uiStoreName"
                  value={uiFormData.storeName}
                  onChange={(e) => setUiFormData({ ...uiFormData, storeName: e.target.value })}
                  placeholder="Enter store name"
                  className="mt-1"
                  data-testid="input-store-name"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  This name appears in the sidebar navigation
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Date Format */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-blue-600" />
                <CardTitle>Date Format</CardTitle>
              </div>
              <CardDescription>
                Choose how dates are displayed across all pages
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <RadioGroup
                value={uiFormData.dateFormat || "DD-MM-YYYY"}
                onValueChange={(value) => setUiFormData({ ...uiFormData, dateFormat: value as DateFormatType })}
                className="space-y-3"
              >
                {dateFormats.map((dateFormat) => (
                  <div
                    key={dateFormat.value}
                    className={`relative flex items-center space-x-4 rounded-lg border-2 p-3 cursor-pointer transition-all ${
                      uiFormData.dateFormat === dateFormat.value
                        ? "border-purple-500 bg-purple-50/50"
                        : "border-slate-200 hover:border-slate-300 bg-white/50"
                    }`}
                    onClick={() => setUiFormData({ ...uiFormData, dateFormat: dateFormat.value })}
                    data-testid={`option-${dateFormat.value}`}
                  >
                    <RadioGroupItem value={dateFormat.value} id={dateFormat.value} className="sr-only" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Label
                          htmlFor={dateFormat.value}
                          className="font-semibold text-slate-800 cursor-pointer"
                        >
                          {dateFormat.label}
                        </Label>
                        {dateFormat.value === "DD-MM-YYYY" && (
                          <Badge variant="secondary" className="text-xs">
                            Default
                          </Badge>
                        )}
                        {uiFormData.dateFormat === dateFormat.value && (
                          <Check className="h-4 w-4 text-purple-600" />
                        )}
                      </div>
                      <p className="text-sm text-slate-600">{dateFormat.description}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500 mb-1">Example:</p>
                      <p className="font-mono font-semibold text-purple-600">
                        {dateFormat.example}
                      </p>
                    </div>
                  </div>
                ))}
              </RadioGroup>
            </CardContent>
          </Card>

          {/* Product Card Design */}
          <Card>
            <CardHeader>
              <CardTitle>Product Card Design</CardTitle>
              <CardDescription>Customize how products appear in POS Sales</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
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
                  <SelectTrigger id="shadowSize">
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
                  <SelectTrigger id="buttonColor">
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
                  <SelectTrigger id="priceColor">
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
            </CardContent>
          </Card>

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

        {/* Receipts Settings */}
        <TabsContent value="receipts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Bill Display Settings</CardTitle>
              <CardDescription>
                Customize what appears on printed bills
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
              <Separator />
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
              <Separator />
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
              <Separator />
              <div className="space-y-2">
                <Label htmlFor="billFooter">Bill Footer Message</Label>
                <Input
                  id="billFooter"
                  value={billFooter}
                  onChange={(e) => setBillFooter(e.target.value)}
                  data-testid="input-bill-footer"
                  placeholder="Enter footer message"
                />
                <p className="text-xs text-muted-foreground">This message appears at the bottom of every bill</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Thermal Receipt Customization</CardTitle>
              <CardDescription>
                Customize thermal receipt header and footer
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="receiptBusinessName">Business Name</Label>
                <Input
                  id="receiptBusinessName"
                  value={receiptBusinessName}
                  onChange={(e) => setReceiptBusinessName(e.target.value)}
                  placeholder="Enter business name"
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
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="receiptDealerBrands">Dealer Brands</Label>
                <Input
                  id="receiptDealerBrands"
                  value={receiptDealerBrands}
                  onChange={(e) => setReceiptDealerBrands(e.target.value)}
                  placeholder="e.g., ICI-DULUX • MOBI PAINTS • WESTER 77"
                />
                <p className="text-xs text-muted-foreground">Use • (bullet) to separate brands</p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="receiptThankYou">Thank You Message</Label>
                <Input
                  id="receiptThankYou"
                  value={receiptThankYou}
                  onChange={(e) => setReceiptThankYou(e.target.value)}
                  placeholder="e.g., THANKS FOR YOUR BUSINESS"
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
                  />
                  <p className="text-xs text-muted-foreground">Side padding</p>
                </div>
              </div>
              
              <Separator />
              <div className="flex justify-end">
                <Button onClick={handleSaveBillSettings} data-testid="button-save-bill">
                  Save Receipt Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Printer Settings */}
        <TabsContent value="printer" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Bluetooth Printer Connection</CardTitle>
              <CardDescription>
                Connect to Bluetooth thermal printers for wireless printing
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-md">
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

              <div className="p-4 bg-muted rounded-md">
                <h4 className="text-sm font-medium mb-2">Connection Instructions</h4>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Make sure your Bluetooth printer is turned on</li>
                  <li>Enable pairing mode on your printer</li>
                  <li>Click "Connect Printer" button above</li>
                  <li>Select your printer from the list</li>
                  <li>Wait for connection confirmation</li>
                </ol>
              </div>

              <div className="p-4 border border-amber-500/50 bg-amber-500/10 rounded-md">
                <p className="text-sm text-amber-900 dark:text-amber-100">
                  <strong>Note:</strong> Bluetooth printing requires a compatible browser (Chrome, Edge) and 
                  a Bluetooth-enabled thermal printer. Make sure your browser has Bluetooth permissions enabled.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Database Settings */}
        <TabsContent value="database" className="space-y-4">
          <Card data-testid="card-database-settings">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Database Management
              </CardTitle>
              <CardDescription>
                Manage your database backups and restore data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isElectron && (
                <>
                  <div className="space-y-2">
                    <Label>Current Database Location</Label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 p-2 bg-muted rounded text-sm font-mono" data-testid="text-database-path">
                        {databasePath || "Loading..."}
                      </code>
                    </div>
                  </div>
                  <Separator />
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

              <Separator />

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
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
