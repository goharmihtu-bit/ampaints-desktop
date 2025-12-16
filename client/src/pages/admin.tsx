import React, { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Key, Download, ShieldCheck, Lock, Eye, EyeOff, Calendar, Zap } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function Admin() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Admin PIN gating
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);
  const [showAdminPinDialog, setShowAdminPinDialog] = useState(false);
  const [adminPinInput, setAdminPinInput] = useState(["", "", "", ""]);
  const [adminPinError, setAdminPinError] = useState("");
  const [showAdminPin, setShowAdminPin] = useState(false);
  const [isVerifyingPin, setIsVerifyingPin] = useState(false);

  useEffect(() => {
    try { setIsAdminUnlocked(sessionStorage.getItem('admin_unlocked') === '1') } catch { }
  }, []);

  const handleAdminPinInput = (index: number, value: string) => {
    if (value.length > 1) return;
    if (value && !/^\d$/.test(value)) return;
    const newPin = [...adminPinInput];
    newPin[index] = value;
    setAdminPinInput(newPin);
    setAdminPinError("");
    if (value && index < 3) {
      const next = document.querySelector(`[data-testid="input-admin-pin-${index + 1}"]`) as HTMLInputElement;
      next?.focus();
    }
    if (newPin.every(d => d !== "") && index === 3) {
      verifyAdminPin(newPin.join(''));
    }
  };

  const verifyAdminPin = async (pin: string) => {
    setIsVerifyingPin(true);
    try {
      const response = await fetch('/api/license/verify-pin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ masterPin: pin }) });
      const data = await response.json();
      
      if (!response.ok) {
        if (response.status === 429) {
          // Rate limited
          setAdminPinError(`Too many failed attempts. Please wait ${data.lockoutTime} minutes before trying again.`);
        } else if (data.remainingAttempts !== undefined) {
          // Show remaining attempts
          setAdminPinError(`Invalid PIN. ${data.remainingAttempts} attempts remaining before lockout.`);
        } else {
          setAdminPinError('Invalid PIN. Please try again.');
        }
        setAdminPinInput(["", "", "", ""]);
        const first = document.querySelector('[data-testid="input-admin-pin-0"]') as HTMLInputElement;
        first?.focus();
        return;
      }
      
      setIsAdminUnlocked(true);
      try { sessionStorage.setItem('admin_unlocked', '1') } catch {}
      setShowAdminPinDialog(false);
      setAdminPinInput(["", "", "", ""]);
      toast({ title: 'Admin Unlocked', description: 'You can access admin tools.' });
    } catch (err: any) {
      setAdminPinError('Connection error. Please try again.');
      setAdminPinInput(["", "", "", ""]);
      const first = document.querySelector('[data-testid="input-admin-pin-0"]') as HTMLInputElement;
      first?.focus();
    } finally {
      setIsVerifyingPin(false);
    }
  };

  // ---------- License state & handlers
  const [licenseExpiryDate, setLicenseExpiryDate] = useState("");
  const [isLicenseActive, setIsLicenseActive] = useState(true);
  const [isSettingLicense, setIsSettingLicense] = useState(false);
  const [licenseSecretKey, setLicenseSecretKey] = useState("");
  const [showLicenseSecretKey, setShowLicenseSecretKey] = useState(false);
  const [licenseCurrentExpiry, setLicenseCurrentExpiry] = useState<string | null>(null);

  const { data: licenseData, isLoading: isLoadingLicense } = useQuery({
    queryKey: ["/api/license/status"],
    onSuccess: (d: any) => {
      setIsLicenseActive(d?.active ?? true);
      setLicenseCurrentExpiry(d?.expiryDate || null);
    }
  });

  const handleSetLicenseExpiry = async () => {
    // Validate secret key
    if (!licenseSecretKey.trim()) {
      toast({ 
        title: 'Secret Key Required', 
        description: 'Please enter the secret key to set license expiry', 
        variant: 'destructive' 
      });
      return;
    }

    // Validate expiry date
    if (!licenseExpiryDate) {
      toast({ 
        title: 'Date Required', 
        description: 'Please select an expiry date', 
        variant: 'destructive' 
      });
      return;
    }

    // Validate expiry date is in the future
    const selectedDate = new Date(licenseExpiryDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (selectedDate < today) {
      toast({ 
        title: 'Invalid Date', 
        description: 'Expiry date must be in the future', 
        variant: 'destructive' 
      });
      return;
    }

    setIsSettingLicense(true);
    try {
      const response = await fetch('/api/license/set-expiry', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ expiryDate: licenseExpiryDate, secretKey: licenseSecretKey }) 
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to set license expiry' }));
        throw new Error(errorData.error || 'Failed to set license expiry');
      }

      toast({ 
        title: 'License Updated', 
        description: `License expiry date set to ${licenseExpiryDate}` 
      });
      queryClient.invalidateQueries({ queryKey: ['/api/license/status'] });
      setLicenseSecretKey(""); // Clear secret key after successful operation
      setLicenseExpiryDate(""); // Clear expiry date
    } catch (error: any) {
      console.error('License expiry error:', error);
      toast({ 
        title: 'Error', 
        description: error.message || 'Invalid secret key or failed to set expiry', 
        variant: 'destructive' 
      });
    } finally { 
      setIsSettingLicense(false);
    }
  };

  const handleDeactivateLicense = async () => {
    // Validate secret key
    if (!licenseSecretKey.trim()) {
      toast({ 
        title: 'Secret Key Required', 
        description: 'Please enter the secret key to deactivate license', 
        variant: 'destructive' 
      });
      return;
    }

    // Double confirmation for destructive action
    if (!confirm('⚠️ WARNING: Are you sure you want to deactivate the license?\n\nThe software will become completely unusable until reactivated.\n\nThis action requires the secret key to undo.')) {
      return;
    }

    setIsSettingLicense(true);
    try {
      const response = await fetch('/api/license/deactivate', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secretKey: licenseSecretKey })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to deactivate license' }));
        throw new Error(errorData.error || 'Failed to deactivate license');
      }

      toast({ 
        title: 'License Deactivated', 
        description: 'The software license has been deactivated successfully.',
        variant: 'destructive'
      });
      setIsLicenseActive(false);
      queryClient.invalidateQueries({ queryKey: ['/api/license/status'] });
      setLicenseSecretKey(""); // Clear secret key after successful operation
    } catch (error: any) {
      console.error('License deactivation error:', error);
      toast({ 
        title: 'Deactivation Failed', 
        description: error.message || 'Invalid secret key or failed to deactivate', 
        variant: 'destructive' 
      });
    } finally { 
      setIsSettingLicense(false);
    }
  };

  const handleActivateLicense = async () => {
    // Validate secret key
    if (!licenseSecretKey.trim()) {
      toast({ 
        title: 'Secret Key Required', 
        description: 'Please enter the secret key to activate license', 
        variant: 'destructive' 
      });
      return;
    }

    setIsSettingLicense(true);
    try {
      const response = await fetch('/api/license/activate', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secretKey: licenseSecretKey })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to activate license' }));
        throw new Error(errorData.error || 'Failed to activate license');
      }

      toast({ 
        title: 'License Activated', 
        description: 'Your license has been successfully reactivated!' 
      });
      setIsLicenseActive(true);
      queryClient.invalidateQueries({ queryKey: ['/api/license/status'] });
      setLicenseSecretKey(""); // Clear secret key after successful operation
    } catch (error: any) {
      console.error('License activation error:', error);
      toast({ 
        title: 'Activation Failed', 
        description: error.message || 'Invalid secret key or failed to activate', 
        variant: 'destructive' 
      });
    } finally { 
      setIsSettingLicense(false);
    }
  };

  // ---------- Cloud Sync state & handlers (copied from Settings)
  const [cloudConn, setCloudConn] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [connections, setConnections] = useState<any[]>([]);
  const [connectionsLoading, setConnectionsLoading] = useState(false);
  const [jobs, setJobs] = useState<any[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);

  const handleTestCloudConnection = async () => {
    // Validate connection string
    if (!cloudConn || !cloudConn.trim()) {
      toast({ 
        title: 'Connection String Required', 
        description: 'Please enter a Postgres connection string', 
        variant: 'destructive' 
      });
      return;
    }

    // Basic validation for connection string format
    if (!cloudConn.startsWith('postgres://') && !cloudConn.startsWith('postgresql://')) {
      toast({ 
        title: 'Invalid Format', 
        description: 'Connection string must start with postgres:// or postgresql://', 
        variant: 'destructive' 
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await apiRequest('POST', '/api/cloud-sync/test-connection', { connectionString: cloudConn.trim() });
      const json = await res.json();
      setTestResult(json);
      
      if (json.ok) {
        toast({ 
          title: 'Connection Successful', 
          description: 'Remote Postgres connection validated successfully.' 
        });
      } else {
        toast({ 
          title: 'Connection Failed', 
          description: json.error || 'Unable to connect to database', 
          variant: 'destructive' 
        });
      }
    } catch (err: any) {
      console.error('Cloud connection test error:', err);
      const errorMessage = err.message || String(err);
      setTestResult({ ok: false, error: errorMessage });
      toast({ 
        title: 'Connection Error', 
        description: errorMessage, 
        variant: 'destructive' 
      });
    } finally { 
      setIsTesting(false);
    }
  };

  const handleSaveCloudConnection = async () => {
    // Validate connection string
    if (!cloudConn || !cloudConn.trim()) {
      toast({ 
        title: 'Connection String Required', 
        description: 'Please enter a Postgres connection string', 
        variant: 'destructive' 
      });
      return;
    }

    // Basic validation for connection string format
    if (!cloudConn.startsWith('postgres://') && !cloudConn.startsWith('postgresql://')) {
      toast({ 
        title: 'Invalid Format', 
        description: 'Connection string must start with postgres:// or postgresql://', 
        variant: 'destructive' 
      });
      return;
    }

    // Recommend testing first
    if (!testResult || !testResult.ok) {
      if (!confirm('Connection has not been tested successfully. Do you want to save it anyway?')) {
        return;
      }
    }

    setIsSaving(true);
    try {
      const res = await apiRequest('POST', '/api/cloud-sync/connections', { 
        provider: 'neon', 
        label: 'Neon', 
        connectionString: cloudConn.trim() 
      });
      const json = await res.json();
      
      if (res.ok && json.ok) {
        toast({ 
          title: 'Connection Saved', 
          description: 'Cloud connection saved successfully on server' 
        });
        setCloudConn("");
        setTestResult(null);
        loadCloudConnections();
      } else { 
        throw new Error(json.error || 'Failed to save connection') 
      }
    } catch (err: any) {
      console.error('Save cloud connection error:', err);
      toast({ 
        title: 'Save Failed', 
        description: err.message || 'Failed to save connection', 
        variant: 'destructive' 
      });
    } finally { 
      setIsSaving(false);
    }
  };

  const loadCloudConnections = async () => {
    setConnectionsLoading(true);
    try {
      const res = await apiRequest('GET', '/api/cloud-sync/connections');
      const json = await res.json();
      if (res.ok && json.ok) setConnections(json.connections || [])
    } catch (err) {
      console.error("Error loading connections", err);
    } finally { setConnectionsLoading(false) }
  };

  const loadJobs = async () => {
    setJobsLoading(true);
    try {
      const res = await apiRequest('GET', '/api/cloud-sync/jobs');
      const json = await res.json();
      if (res.ok && json.ok) setJobs(json.jobs || [])
    } catch (err) {
      console.error("Error loading jobs", err);
    } finally { setJobsLoading(false) }
  };

  const enqueueJob = async (connectionId: string, jobType: 'export' | 'import') => {
    try {
      let details = undefined;
      
      if (jobType === 'import') {
        const strategy = prompt('⚠️ Import Strategy Selection\n\nChoose how to handle data conflicts:\n• skip - Keep existing records\n• overwrite - Replace with remote data\n• merge - Combine both (recommended)\n\nEnter strategy:', 'merge') || 'merge';
        
        if (!["skip","overwrite","merge"].includes(strategy.toLowerCase())) { 
          toast({ 
            title: 'Invalid Strategy', 
            description: 'Please select: skip, overwrite, or merge', 
            variant: 'destructive' 
          }); 
          return; 
        }
        details = { strategy: strategy.toLowerCase() };
        
        // Warn about import risks
        if (!confirm(`⚠️ Warning: This will import data from cloud with strategy "${strategy}".\n\nThis is a DRY RUN - no actual changes will be made yet.\n\nProceed?`)) {
          return;
        }
      } else {
        // Confirm export operation
        if (!confirm('This will export your local data to the cloud.\n\nThis is a DRY RUN - no actual changes will be made yet.\n\nProceed?')) {
          return;
        }
      }

      const res = await apiRequest('POST', '/api/cloud-sync/jobs', { 
        connectionId, 
        jobType, 
        dryRun: true, 
        details 
      });
      const json = await res.json();
      
      if (res.ok && json.ok) {
        toast({ 
          title: 'Job Enqueued', 
          description: `Job ${json.jobId} created (dry-run mode)` 
        });
        loadJobs(); // Refresh job list
      } else {
        toast({ 
          title: 'Job Enqueue Failed', 
          description: json.error || 'Failed to enqueue job', 
          variant: 'destructive' 
        });
      }
    } catch (err: any) {
      console.error('Enqueue job error:', err);
      toast({ 
        title: 'Error', 
        description: err.message || 'Failed to enqueue job', 
        variant: 'destructive' 
      });
    }
  };

  const processNextJob = async () => {
    // Confirm before processing
    if (!confirm('⚠️ Warning: This will process the next pending cloud sync job.\n\nMake sure you understand what the job will do before proceeding.\n\nContinue?')) {
      return;
    }

    try {
      const res = await apiRequest('POST', '/api/cloud-sync/process-next');
      const json = await res.json();
      
      if (res.ok && json.ok) {
        toast({ 
          title: 'Job Processed', 
          description: json.result?.status || 'Job processed successfully' 
        });
        loadJobs();
      } else {
        toast({ 
          title: 'Processing Failed', 
          description: json.error || 'Failed to process job', 
          variant: 'destructive' 
        });
      }
    } catch (err: any) {
      console.error('Process job error:', err);
      toast({ 
        title: 'Error', 
        description: err.message || 'Failed to process job', 
        variant: 'destructive' 
      });
    }
  };

  useEffect(() => { loadCloudConnections(); loadJobs() }, []);

  // ---------- Admin PIN change form
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [isChangingPin, setIsChangingPin] = useState(false);

  const handleChangeMasterPin = async () => {
    // Validate new PIN
    if (!newPin || !newPin.trim()) {
      toast({ 
        title: 'Invalid PIN', 
        description: 'Please enter a new PIN', 
        variant: 'destructive' 
      });
      return;
    }

    // Validate PIN format (4 digits)
    if (!/^\d{4}$/.test(newPin)) {
      toast({ 
        title: 'Invalid PIN Format', 
        description: 'PIN must be exactly 4 digits', 
        variant: 'destructive' 
      });
      return;
    }

    // Validate PIN confirmation
    if (newPin !== confirmPin) {
      toast({ 
        title: 'PIN Mismatch', 
        description: 'New PIN and confirmation PIN do not match', 
        variant: 'destructive' 
      });
      return;
    }

    // Validate PIN is not too simple
    const weakPins = [
      '0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999',
      '0123', '1234', '2345', '3456', '4567', '5678', '6789', '7890',
      '9876', '8765', '7654', '6543', '5432', '4321', '3210', '2109'
    ];
    
    // Check for repeating digits
    const isRepeating = /^(.)\1{3}$/.test(newPin);
    
    if (weakPins.includes(newPin) || isRepeating) {
      if (!confirm('⚠️ Security Warning: This PIN is too simple and easy to guess (common pattern or repeating digits).\n\nFor better security, please choose a more random PIN.\n\nDo you still want to use this PIN?')) {
        return;
      }
    }

    setIsChangingPin(true);
    try {
      const res = await fetch('/api/license/set-master-pin', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ currentPin, newPin }) 
      });
      
      const json = await res.json();
      
      if (res.ok && json.ok) {
        toast({ 
          title: 'PIN Updated', 
          description: 'Master PIN changed successfully. Please remember your new PIN.' 
        });
        setCurrentPin(''); 
        setNewPin(''); 
        setConfirmPin('');
      } else {
        toast({ 
          title: 'PIN Change Failed', 
          description: json.error || 'Failed to set PIN. Check your current PIN.', 
          variant: 'destructive' 
        });
      }
    } catch (err: any) {
      console.error('PIN change error:', err);
      toast({ 
        title: 'Error', 
        description: err.message || 'Failed to change PIN', 
        variant: 'destructive' 
      });
    } finally { 
      setIsChangingPin(false);
    }
  };

  if (!isAdminUnlocked) {
    return (
      <div className="glass-page p-6">
        <div className="glass-surface p-4">
          <h1 className="text-2xl font-semibold">Admin</h1>
          <p className="text-sm text-muted-foreground">Admin tools are PIN-protected. Enter master PIN to proceed.</p>
        </div>
        <div className="mt-6 glass-card p-5">
          <Button onClick={() => setShowAdminPinDialog(true)}>Enter Admin PIN</Button>
        </div>

        <Dialog open={showAdminPinDialog} onOpenChange={setShowAdminPinDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Lock className="h-5 w-5" /> Enter Admin PIN</DialogTitle>
              <DialogDescription>Enter the 4-digit master PIN to access Admin tools.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex justify-center gap-3">
                {[0,1,2,3].map((index) => (
                  <Input 
                    key={index} 
                    type={showAdminPin ? 'text' : 'password'} 
                    inputMode="numeric" 
                    maxLength={1} 
                    value={adminPinInput[index]} 
                    onChange={(e) => handleAdminPinInput(index, e.target.value)} 
                    className="w-14 h-14 text-center text-2xl font-bold" 
                    data-testid={`input-admin-pin-${index}`} 
                    disabled={isVerifyingPin} 
                    autoFocus={index === 0} 
                  />
                ))}
              </div>
              <div className="flex justify-center">
                <Button variant="ghost" size="sm" onClick={() => setShowAdminPin(!showAdminPin)} className="flex items-center gap-2">
                  {showAdminPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  {showAdminPin ? 'Hide PIN' : 'Show PIN'}
                </Button>
              </div>
              {adminPinError && <p className="text-sm text-destructive text-center">{adminPinError}</p>}
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <ShieldCheck className="h-4 w-4" />
                <span>Default PIN is 0000</span>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="glass-page p-6 space-y-6 max-w-5xl">
      <div className="glass-surface p-4">
        <h1 className="text-2xl font-semibold">Admin</h1>
        <p className="text-sm text-muted-foreground">Manage licensing and cloud sync settings (admin-only)</p>
      </div>

      <Tabs defaultValue="license" className="w-full">
        <TabsList className="glass-tabs-list grid w-full grid-cols-3">
          <TabsTrigger value="license" className="glass-tab"><Key className="h-4 w-4 mr-2" />License</TabsTrigger>
          <TabsTrigger value="cloud" className="glass-tab"><Download className="h-4 w-4 mr-2" />Cloud Sync</TabsTrigger>
          <TabsTrigger value="pin" className="glass-tab"><ShieldCheck className="h-4 w-4 mr-2" />PIN</TabsTrigger>
        </TabsList>

        <TabsContent value="license" className="space-y-4">
          <div className="glass-card p-5">
            <div className="flex items-center gap-2 mb-1">
              <Key className="h-5 w-5" />
              <h3 className="font-semibold">Software License Management</h3>
              <Badge variant={isLicenseActive ? 'default' : 'destructive'} className="ml-2">
                {isLicenseActive ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Manage your software license expiration date and activation status
            </p>
            
            {/* Security Warning Banner */}
            <div className="mb-6 border-2 border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="h-6 w-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-red-900 dark:text-red-100 mb-2">🔒 Security Protected</h4>
                  <p className="text-sm text-red-800 dark:text-red-200">
                    <strong>All license operations require your Master Secret Key.</strong>
                  </p>
                </div>
              </div>
            </div>
            <div className="space-y-6">
              <div className="border border-border/50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-blue-600" />
                    <h4 className="font-semibold">Current License Status</h4>
                  </div>
                  <Badge variant={isLicenseActive ? 'default' : 'secondary'}>
                    {isLicenseActive ? 'Operational' : 'Inactive'}
                  </Badge>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    {isLicenseActive ? 'Your software license is active and operational.' : 'Your software license is currently inactive. Enter secret key and click Reactivate License to restore functionality.'}
                  </p>
                  {licenseCurrentExpiry && (
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Current Expiry:</span>
                      <span className="font-medium">{licenseCurrentExpiry}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10 rounded-lg p-4 space-y-4">
                <div className="flex items-start gap-2">
                  <Lock className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold mb-1 text-amber-900 dark:text-amber-100">Secret Key Required</h4>
                    <p className="text-xs text-amber-700 dark:text-amber-300 mb-3">
                      All license operations require your secret key for security. The secret key is never stored and must be provided for each operation.
                    </p>
                  </div>
                </div>
                <div>
                  <Label htmlFor="license-secret-key" className="text-sm font-medium">Secret Key</Label>
                  <div className="relative mt-2">
                    <Input 
                      id="license-secret-key"
                      type={showLicenseSecretKey ? "text" : "password"}
                      value={licenseSecretKey}
                      onChange={(e) => setLicenseSecretKey(e.target.value)}
                      placeholder="Enter your secret key"
                      className="pr-10"
                      disabled={isSettingLicense}
                    />
                    <button
                      type="button"
                      onClick={() => setShowLicenseSecretKey(!showLicenseSecretKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      disabled={isSettingLicense}
                    >
                      {showLicenseSecretKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    This key is required to perform any license management operations
                  </p>
                  <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded text-xs">
                    <p className="text-blue-900 dark:text-blue-100 font-medium mb-1">ℹ️ About Secret Keys</p>
                    <p className="text-blue-800 dark:text-blue-200">
                      The secret key can be set via environment variable <code className="bg-blue-100 dark:bg-blue-900 px-1 py-0.5 rounded">MASTER_SECRET_KEY</code> or customized in your deployment. 
                      Default key is provided in SECRET-KEY-CONFIGURATION.md. For security, never share this key publicly.
                    </p>
                  </div>
                </div>
              </div>

              <div className="border border-border/50 rounded-lg p-4 space-y-4">
                <div>
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Set License Expiration Date
                  </h4>
                  <p className="text-xs text-muted-foreground mb-3">
                    Set a date after which the software will require reactivation. Secret key is required.
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
                      className="mt-1" 
                      disabled={isSettingLicense || !licenseSecretKey.trim()}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button 
                      onClick={handleSetLicenseExpiry} 
                      disabled={isSettingLicense || !licenseSecretKey.trim() || !licenseExpiryDate}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <Calendar className="h-4 w-4 mr-2" />
                      {isSettingLicense ? 'Saving...' : 'Set Expiry'}
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={handleActivateLicense}
                      disabled={isSettingLicense || !licenseSecretKey.trim()}
                      className="border-green-600 text-green-600 hover:bg-green-50"
                    >
                      <Zap className="h-4 w-4 mr-2" />
                      Reactivate License
                    </Button>
                    <Button 
                      variant="destructive" 
                      onClick={handleDeactivateLicense}
                      disabled={isSettingLicense || !licenseSecretKey.trim()}
                    >
                      <Lock className="h-4 w-4 mr-2" />
                      Deactivate License
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="cloud" className="space-y-4">
          <div className="glass-card p-5">
            <div className="flex items-center gap-2 mb-1">
              <Download className="h-5 w-5 text-green-600" />
              <h3 className="font-semibold">Cloud Sync (Neon / Supabase)</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Connect your remote Postgres (Neon or Supabase) to perform opt-in exports and imports. 
              This is an admin-only, explicit operation. Credentials are stored on the server only.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <div className="sm:col-span-2">
                <Label htmlFor="cloudConnection">Postgres Connection String</Label>
                <Input 
                  id="cloudConnection" 
                  placeholder="postgresql://user:pass@host:5432/dbname?sslmode=require" 
                  value={cloudConn} 
                  onChange={(e) => setCloudConn(e.target.value)} 
                  className="mt-1" 
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Tip: Use SSL mode=require for Neon/Supabase. Do NOT paste secrets in public chat. Rotate exposed keys immediately.
                </p>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleTestCloudConnection} disabled={!cloudConn || isTesting} variant="outline">
                  {isTesting ? 'Testing...' : 'Test Connection'}
                </Button>
              </div>
            </div>

            {testResult && (
              <div className={`mt-4 p-3 rounded ${testResult.ok ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                <p className="text-sm">
                  {testResult.ok ? 'Connection successful' : `Connection failed: ${testResult.error}`}
                </p>
              </div>
            )}

            <div className="mt-4">
              <div className="flex gap-2">
                <Button onClick={handleSaveCloudConnection} disabled={!cloudConn || isSaving}>
                  {isSaving ? 'Saving...' : 'Save Connection'}
                </Button>
                <Button variant="outline" onClick={loadCloudConnections}>
                  Refresh
                </Button>
              </div>
              
              <div className="mt-4">
                <h4 className="font-semibold">Saved Connections</h4>
                {connectionsLoading ? (
                  <p className="text-sm text-muted-foreground">Loading...</p>
                ) : (
                  <div className="space-y-2 mt-2">
                    {connections.length === 0 && <p className="text-sm text-muted-foreground">No connections saved</p>}
                    {connections.map((c: any) => (
                      <div key={c.id} className="p-3 border rounded flex items-center justify-between">
                        <div>
                          <div className="font-medium">{c.label || c.provider}</div>
                          <div className="text-xs text-muted-foreground">
                            {c.provider} • Created: {new Date(c.created_at).toLocaleString()}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => enqueueJob(c.id, 'export')}>
                            Run Export (dry-run)
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => enqueueJob(c.id, 'import')}>
                            Run Import (dry-run)
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-6">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold">Job History</h4>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={loadJobs}>
                      Refresh
                    </Button>
                    <Button size="sm" onClick={processNextJob}>
                      Process Next Job
                    </Button>
                  </div>
                </div>
                <div className="mt-3">
                  {jobsLoading ? (
                    <p className="text-sm text-muted-foreground">Loading jobs...</p>
                  ) : (
                    <div className="space-y-2">
                      {jobs.length === 0 && <p className="text-sm text-muted-foreground">No jobs</p>}
                      {jobs.map((j: any) => (
                        <div key={j.id} className="p-3 border rounded flex items-center justify-between">
                          <div>
                            <div className="font-medium">{j.job_type} • {j.provider}</div>
                            <div className="text-xs text-muted-foreground">
                              Status: {j.status} • Attempts: {j.attempts} • {new Date(j.created_at).toLocaleString()}
                            </div>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {j.last_error ? `Error: ${j.last_error}` : ''}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="pin" className="space-y-4">
          <div className="glass-card p-5">
            <h3 className="font-semibold">Change Admin PIN</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Set or change the master admin PIN used to unlock admin tools.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label>Current PIN (leave empty if not set)</Label>
                <Input value={currentPin} onChange={(e) => setCurrentPin(e.target.value)} type="password" />
              </div>
              <div>
                <Label>New PIN</Label>
                <Input value={newPin} onChange={(e) => setNewPin(e.target.value)} type="password" />
              </div>
              <div>
                <Label>Confirm New PIN</Label>
                <Input value={confirmPin} onChange={(e) => setConfirmPin(e.target.value)} type="password" />
              </div>
            </div>
            <div className="mt-4">
              <Button onClick={handleChangeMasterPin} disabled={isChangingPin}>
                {isChangingPin ? 'Saving...' : 'Change PIN'}
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}