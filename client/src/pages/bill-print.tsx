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
import { Store, Receipt, Bluetooth, Printer, Database, Download, Upload, FolderOpen, Palette, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Settings as UISettings, UpdateSettings } from "@shared/schema";

interface ReceiptSettings {
  businessName: string;
  address: string;
  dealerText: string;
  dealerBrands: string;
  thankYou: string;
  fontSize: string;
  itemFontSize: string;
  padding: string;
}

export default function Settings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // UI Settings from backend
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
  });

  // POS Receipt Settings
  const [receiptSettings, setReceiptSettings] = useState<ReceiptSettings>({
    businessName: "ALI MUHAMMAD PAINTS",
    address: "Basti Malook, Multan. 0300-868-3395",
    dealerText: "AUTHORIZED DEALER:",
    dealerBrands: "ICI-DULUX • MOBI PAINTS • WESTER 77",
    thankYou: "THANKS FOR YOUR BUSINESS",
    fontSize: "11",
    itemFontSize: "12",
    padding: "12",
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
      });
    }

    // Load POS receipt settings from localStorage
    try {
      const savedReceiptSettings = localStorage.getItem('posReceiptSettings');
      if (savedReceiptSettings) {
        const settings = JSON.parse(savedReceiptSettings);
        setReceiptSettings({
          businessName: settings.businessName || "ALI MUHAMMAD PAINTS",
          address: settings.address || "Basti Malook, Multan. 0300-868-3395",
          dealerText: settings.dealerText || "AUTHORIZED DEALER:",
          dealerBrands: settings.dealerBrands || "ICI-DULUX • MOBI PAINTS • WESTER 77",
          thankYou: settings.thankYou || "THANKS FOR YOUR BUSINESS",
          fontSize: settings.fontSize || "11",
          itemFontSize: settings.itemFontSize || "12",
          padding: settings.padding || "12",
        });
      }
    } catch (error) {
      console.error("Error loading receipt settings:", error);
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
        description: "Your changes have been updated successfully.",
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
  
  // Desktop/Database Settings
  const [databasePath, setDatabasePath] = useState<string>("");
  const [isElectron, setIsElectron] = useState(false);
  
  useEffect(() => {
    // Check if running in Electron
    if (typeof window !== 'undefined' && (window as any).electron) {
      setIsElectron(true);
      // Get current database path
      (window as any).electron.getDatabasePath().then((path: string) => {
        setDatabasePath(path);
      });
    }
  }, []);

  // POS Settings
  const [autoprint, setAutoprint] = useState(false);
  
  // Bluetooth Settings
  const [bluetoothEnabled, setBluetoothEnabled] = useState(false);
  const [connectedDevice, setConnectedDevice] = useState<string | null>(null);

  const handleSaveReceiptSettings = () => {
    localStorage.setItem('posReceiptSettings', JSON.stringify(receiptSettings));
    toast({ 
      title: "Receipt Settings Saved",
      description: "Your thermal receipt settings have been updated."
    });
  };

  const handleConnectBluetooth = async () => {
    try {
      // Request Bluetooth device
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
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          Settings
        </h1>
        <p className="text-muted-foreground">Customize your store appearance and preferences</p>
      </div>

      <Tabs defaultValue="appearance" className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-background/50 backdrop-blur-sm border">
          <TabsTrigger value="appearance" className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            Appearance
          </TabsTrigger>
          <TabsTrigger value="receipt" className="flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            Receipt
          </TabsTrigger>
          <TabsTrigger value="printer" className="flex items-center gap-2">
            <Printer className="h-4 w-4" />
            Printer
          </TabsTrigger>
          <TabsTrigger value="database" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Data
          </TabsTrigger>
        </TabsList>

        {/* Appearance Settings */}
        <TabsContent value="appearance" className="space-y-4">
          <Card className="bg-background/50 backdrop-blur-sm border-blue-200/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Store className="h-5 w-5 text-blue-600" />
                Store Branding
              </CardTitle>
              <CardDescription>Customize your store identity</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="uiStoreName">Store Name</Label>
                <Input
                  id="uiStoreName"
                  value={uiFormData.storeName}
                  onChange={(e) => setUiFormData({ ...uiFormData, storeName: e.target.value })}
                  placeholder="Enter store name"
                  className="bg-background/50"
                />
                <p className="text-xs text-muted-foreground">
                  This name appears throughout the application
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-background/50 backdrop-blur-sm border-purple-200/20">
            <CardHeader>
              <CardTitle>Product Card Design</CardTitle>
              <CardDescription>Customize how products appear in POS</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label>Card Style</Label>
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

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <Label htmlFor="buttonColor">Button Color</Label>
                  <Select
                    value={uiFormData.cardButtonColor}
                    onValueChange={(value) => setUiFormData({ ...uiFormData, cardButtonColor: value })}
                  >
                    <SelectTrigger id="buttonColor" className="bg-background/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gray-900">Black</SelectItem>
                      <SelectItem value="blue-600">Blue</SelectItem>
                      <SelectItem value="green-600">Green</SelectItem>
                      <SelectItem value="purple-600">Purple</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="priceColor">Price Color</Label>
                  <Select
                    value={uiFormData.cardPriceColor}
                    onValueChange={(value) => setUiFormData({ ...uiFormData, cardPriceColor: value })}
                  >
                    <SelectTrigger id="priceColor" className="bg-background/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="blue-600">Blue</SelectItem>
                      <SelectItem value="green-600">Green</SelectItem>
                      <SelectItem value="purple-600">Purple</SelectItem>
                      <SelectItem value="gray-900">Black</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-background/30 rounded-lg">
                <div className="space-y-0.5">
                  <Label htmlFor="stockBadgeBorder">Stock Badge Border</Label>
                  <p className="text-xs text-muted-foreground">
                    Add border to stock badges
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

          <div className="flex justify-end">
            <Button 
              onClick={() => updateUiMutation.mutate(uiFormData)} 
              disabled={updateUiMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Save className="h-4 w-4 mr-2" />
              {updateUiMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </TabsContent>

        {/* Receipt Settings */}
        <TabsContent value="receipt" className="space-y-4">
          <Card className="bg-background/50 backdrop-blur-sm border-green-200/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-green-600" />
                Thermal Receipt
              </CardTitle>
              <CardDescription>
                Customize your thermal receipt layout and content
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="businessName">Business Name</Label>
                  <Input
                    id="businessName"
                    value={receiptSettings.businessName}
                    onChange={(e) => setReceiptSettings({ ...receiptSettings, businessName: e.target.value })}
                    placeholder="Your business name"
                    className="bg-background/50"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="address">Address & Contact</Label>
                  <Input
                    id="address"
                    value={receiptSettings.address}
                    onChange={(e) => setReceiptSettings({ ...receiptSettings, address: e.target.value })}
                    placeholder="Address and phone"
                    className="bg-background/50"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dealerText">Dealer Label</Label>
                <Input
                  id="dealerText"
                  value={receiptSettings.dealerText}
                  onChange={(e) => setReceiptSettings({ ...receiptSettings, dealerText: e.target.value })}
                  placeholder="AUTHORIZED DEALER:"
                  className="bg-background/50"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dealerBrands">Brands</Label>
                <Input
                  id="dealerBrands"
                  value={receiptSettings.dealerBrands}
                  onChange={(e) => setReceiptSettings({ ...receiptSettings, dealerBrands: e.target.value })}
                  placeholder="ICI-DULUX • MOBI PAINTS • WESTER 77"
                  className="bg-background/50"
                />
                <p className="text-xs text-muted-foreground">Separate brands with • (bullet)</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="thankYou">Thank You Message</Label>
                <Input
                  id="thankYou"
                  value={receiptSettings.thankYou}
                  onChange={(e) => setReceiptSettings({ ...receiptSettings, thankYou: e.target.value })}
                  placeholder="THANKS FOR YOUR BUSINESS"
                  className="bg-background/50"
                />
              </div>

              <Separator />

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fontSize">Font Size</Label>
                  <Input
                    id="fontSize"
                    type="number"
                    min="8"
                    max="16"
                    value={receiptSettings.fontSize}
                    onChange={(e) => setReceiptSettings({ ...receiptSettings, fontSize: e.target.value })}
                    className="bg-background/50"
                  />
                  <p className="text-xs text-muted-foreground">Base size</p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="itemFontSize">Item Size</Label>
                  <Input
                    id="itemFontSize"
                    type="number"
                    min="10"
                    max="18"
                    value={receiptSettings.itemFontSize}
                    onChange={(e) => setReceiptSettings({ ...receiptSettings, itemFontSize: e.target.value })}
                    className="bg-background/50"
                  />
                  <p className="text-xs text-muted-foreground">Items size</p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="padding">Padding</Label>
                  <Input
                    id="padding"
                    type="number"
                    min="0"
                    max="20"
                    value={receiptSettings.padding}
                    onChange={(e) => setReceiptSettings({ ...receiptSettings, padding: e.target.value })}
                    className="bg-background/50"
                  />
                  <p className="text-xs text-muted-foreground">Side padding</p>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-background/30 rounded-lg">
                <div className="space-y-0.5">
                  <Label>Auto-print</Label>
                  <p className="text-xs text-muted-foreground">
                    Print automatically after sale
                  </p>
                </div>
                <Switch
                  checked={autoprint}
                  onCheckedChange={setAutoprint}
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button 
              onClick={handleSaveReceiptSettings}
              className="bg-green-600 hover:bg-green-700"
            >
              <Save className="h-4 w-4 mr-2" />
              Save Receipt Settings
            </Button>
          </div>
        </TabsContent>

        {/* Printer Settings */}
        <TabsContent value="printer" className="space-y-4">
          <Card className="bg-background/50 backdrop-blur-sm border-orange-200/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Printer className="h-5 w-5 text-orange-600" />
                Printer Connection
              </CardTitle>
              <CardDescription>
                Connect to Bluetooth thermal printers
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-background/30 rounded-lg border">
                <div className="flex items-center gap-3">
                  <Printer className="h-8 w-8 text-muted-foreground" />
                  <div>
                    <p className="font-medium">
                      {connectedDevice ? connectedDevice : "No device connected"}
                    </p>
                    <p className={`text-sm ${bluetoothEnabled ? "text-green-600" : "text-muted-foreground"}`}>
                      {bluetoothEnabled ? "Connected" : "Not connected"}
                    </p>
                  </div>
                </div>
                {bluetoothEnabled ? (
                  <Button 
                    variant="outline" 
                    onClick={handleDisconnectBluetooth}
                    className="border-orange-200 text-orange-600 hover:bg-orange-50"
                  >
                    Disconnect
                  </Button>
                ) : (
                  <Button 
                    onClick={handleConnectBluetooth}
                    className="bg-orange-600 hover:bg-orange-700"
                  >
                    <Bluetooth className="h-4 w-4 mr-2" />
                    Connect Printer
                  </Button>
                )}
              </div>

              <div className="p-4 bg-blue-50/50 rounded-lg border border-blue-200/30">
                <h4 className="text-sm font-medium mb-2 text-blue-900">Connection Guide</h4>
                <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
                  <li>Turn on your Bluetooth printer</li>
                  <li>Enable pairing mode</li>
                  <li>Click "Connect Printer"</li>
                  <li>Select your device</li>
                  <li>Wait for confirmation</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Database Settings */}
        <TabsContent value="database" className="space-y-4">
          <Card className="bg-background/50 backdrop-blur-sm border-red-200/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5 text-red-600" />
                Data Management
              </CardTitle>
              <CardDescription>
                Backup and restore your store data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isElectron && (
                <>
                  <div className="space-y-2">
                    <Label>Database Location</Label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 p-2 bg-background/50 rounded text-sm font-mono border">
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
                    className="border-blue-200 text-blue-600 hover:bg-blue-50"
                  >
                    <FolderOpen className="h-4 w-4 mr-2" />
                    Change Location
                  </Button>
                )}
                <Button 
                  onClick={handleExportDatabase}
                  variant="outline"
                  className="border-green-200 text-green-600 hover:bg-green-50"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export Backup
                </Button>
                <Button 
                  onClick={handleImportDatabase}
                  variant="outline"
                  className="border-purple-200 text-purple-600 hover:bg-purple-50"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Import Data
                </Button>
              </div>

              <div className="p-4 bg-amber-50/50 rounded-lg border border-amber-200/30">
                <h4 className="font-medium text-sm mb-2 text-amber-900">Important Notes</h4>
                <ul className="text-sm text-amber-700 space-y-1 list-disc list-inside">
                  {isElectron && <li>Changing location will restart the app</li>}
                  <li>Export regularly to prevent data loss</li>
                  <li>Importing replaces current data</li>
                  <li>Keep backups in a safe location</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}