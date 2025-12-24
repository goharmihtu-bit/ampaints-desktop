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
  DialogFooter,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Key, Download, ShieldCheck, Lock, Eye, EyeOff, Calendar, Zap, Trash2, Cloud, RefreshCw, Upload, Database, Activity, Clock, CheckCircle2, XCircle, AlertCircle, Loader2, Server, Globe, Link2 } from "lucide-react";
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
  
  // Strategy selection dialog state
  type ImportStrategy = 'merge' | 'skip' | 'overwrite';
  const [showStrategyDialog, setShowStrategyDialog] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState<ImportStrategy>('merge');
  const [pendingJobRequest, setPendingJobRequest] = useState<{ connectionId: string, jobType: 'export' | 'import', dryRun: boolean } | null>(null);
  
  // Confirmation dialog state
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmDialogData, setConfirmDialogData] = useState<{ title: string, message: string, onConfirm: () => void } | null>(null);

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
      else {
        toast({
          title: 'Failed to Load Connections',
          description: json.error || 'Could not load cloud connections',
          variant: 'destructive'
        });
      }
    } catch (err: any) {
      console.error("Error loading connections", err);
      toast({
        title: 'Error',
        description: err.message || 'Failed to load connections',
        variant: 'destructive'
      });
    } finally { setConnectionsLoading(false) }
  };

  const handleDeleteConnection = async (connectionId: string, label: string) => {
    if (!confirm(`Are you sure you want to delete the connection "${label}"?\n\nThis action cannot be undone.`)) {
      return;
    }

    try {
      const res = await apiRequest('DELETE', `/api/cloud-sync/connections/${connectionId}`);
      const json = await res.json();
      
      if (res.ok && json.ok) {
        toast({
          title: 'Connection Deleted',
          description: 'Cloud connection removed successfully'
        });
        loadCloudConnections();
      } else {
        throw new Error(json.error || 'Failed to delete connection');
      }
    } catch (err: any) {
      console.error('Delete connection error:', err);
      toast({
        title: 'Delete Failed',
        description: err.message || 'Failed to delete connection',
        variant: 'destructive'
      });
    }
  };

  const loadJobs = async () => {
    setJobsLoading(true);
    try {
      const res = await apiRequest('GET', '/api/cloud-sync/jobs');
      const json = await res.json();
      if (res.ok && json.ok) setJobs(json.jobs || [])
      else {
        toast({
          title: 'Failed to Load Jobs',
          description: json.error || 'Could not load job history',
          variant: 'destructive'
        });
      }
    } catch (err: any) {
      console.error("Error loading jobs", err);
      toast({
        title: 'Error',
        description: err.message || 'Failed to load jobs',
        variant: 'destructive'
      });
    } finally { setJobsLoading(false) }
  };

  const enqueueJob = async (connectionId: string, jobType: 'export' | 'import', dryRun: boolean = false) => {
    // If import job, show strategy dialog first
    if (jobType === 'import') {
      setPendingJobRequest({ connectionId, jobType, dryRun });
      setShowStrategyDialog(true);
      return;
    }
    
    // For export jobs, show confirmation dialog
    const title = dryRun ? 'Confirm Export Preview' : '⚠️ Confirm Export Operation';
    const message = dryRun
      ? 'This will simulate exporting your local data to the cloud.\n\nThis is a DRY RUN - no actual changes will be made.\n\nProceed?'
      : '⚠️ WARNING: This will ACTUALLY EXPORT your local data to the cloud.\n\n🔴 THIS IS NOT A DRY RUN - Real changes will be made to the cloud database!\n\nExisting data in the cloud may be overwritten.\n\nProceed?';
    
    showConfirmation(title, message, () => executeJobEnqueue(connectionId, jobType, dryRun, undefined));
  };
  
  const executeJobEnqueue = async (connectionId: string, jobType: 'export' | 'import', dryRun: boolean, details?: any) => {
    try {
      const res = await apiRequest('POST', '/api/cloud-sync/jobs', { 
        connectionId, 
        jobType, 
        dryRun, 
        details 
      });
      const json = await res.json();
      
      if (res.ok && json.ok) {
        toast({ 
          title: 'Job Enqueued', 
          description: dryRun 
            ? `Job ${json.jobId} created (dry-run mode - preview only)` 
            : `Job ${json.jobId} created - will make real changes when processed!` 
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
  
  const handleStrategyConfirm = () => {
    if (!pendingJobRequest) return;
    
    const { connectionId, jobType, dryRun } = pendingJobRequest;
    const strategy = selectedStrategy;
    const details = { strategy };
    
    // Close strategy dialog first
    setShowStrategyDialog(false);
    setPendingJobRequest(null);
    
    // Show confirmation dialog
    const title = dryRun ? 'Confirm Import Preview' : '⚠️ Confirm Import Operation';
    const message = dryRun 
      ? `This will simulate importing data from cloud with strategy "${strategy}".\n\nThis is a DRY RUN - no actual changes will be made.\n\nProceed?`
      : `⚠️ WARNING: This will ACTUALLY IMPORT data from cloud with strategy "${strategy}".\n\n🔴 THIS IS NOT A DRY RUN - Real changes will be made to your local database!\n\nMake sure you have a backup before proceeding.\n\nProceed?`;
    
    showConfirmation(title, message, () => executeJobEnqueue(connectionId, jobType, dryRun, details));
  };
  
  const handleStrategyCancel = () => {
    setShowStrategyDialog(false);
    setPendingJobRequest(null);
    setSelectedStrategy('merge'); // Reset to default
  };
  
  const showConfirmation = (title: string, message: string, onConfirm: () => void) => {
    setConfirmDialogData({ title, message, onConfirm });
    setShowConfirmDialog(true);
  };
  
  const handleConfirmDialogConfirm = () => {
    setShowConfirmDialog(false);
    if (confirmDialogData?.onConfirm) {
      confirmDialogData.onConfirm();
    }
    setConfirmDialogData(null);
  };
  
  const handleConfirmDialogCancel = () => {
    setShowConfirmDialog(false);
    setConfirmDialogData(null);
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

  // Auto-refresh jobs if there are pending or running jobs
  useEffect(() => {
    const hasPendingOrRunning = jobs.some((j: any) => j.status === 'pending' || j.status === 'running');
    
    if (!hasPendingOrRunning) return;
    
    const intervalId = setInterval(() => {
      loadJobs();
    }, 3000); // Refresh every 3 seconds if there are active jobs
    
    return () => clearInterval(intervalId);
  }, [jobs.map((j: any) => j.status).join(',')]);

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
          {/* Header Card with Overview */}
          <div className="glass-card p-6">
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 text-white shadow-lg">
                  <Cloud className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">Cloud Sync Center</h3>
                  <p className="text-sm text-muted-foreground">
                    Securely sync your data with remote PostgreSQL databases
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="px-3 py-1.5 text-xs font-medium border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-300">
                <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />
                AES-256 Encrypted
              </Badge>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/50 dark:to-blue-900/30 border border-blue-200/50 dark:border-blue-800/50">
                <div className="flex items-center gap-2 mb-2">
                  <Server className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-xs font-medium text-blue-700 dark:text-blue-300">Connections</span>
                </div>
                <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">{connections.length}</div>
              </div>
              <div className="p-4 rounded-xl bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950/50 dark:to-green-900/30 border border-green-200/50 dark:border-green-800/50">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <span className="text-xs font-medium text-green-700 dark:text-green-300">Completed</span>
                </div>
                <div className="text-2xl font-bold text-green-900 dark:text-green-100">{jobs.filter((j: any) => j.status === 'success').length}</div>
              </div>
              <div className="p-4 rounded-xl bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/50 dark:to-amber-900/30 border border-amber-200/50 dark:border-amber-800/50">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <span className="text-xs font-medium text-amber-700 dark:text-amber-300">Pending</span>
                </div>
                <div className="text-2xl font-bold text-amber-900 dark:text-amber-100">{jobs.filter((j: any) => j.status === 'pending').length}</div>
              </div>
              <div className="p-4 rounded-xl bg-gradient-to-br from-red-50 to-red-100/50 dark:from-red-950/50 dark:to-red-900/30 border border-red-200/50 dark:border-red-800/50">
                <div className="flex items-center gap-2 mb-2">
                  <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                  <span className="text-xs font-medium text-red-700 dark:text-red-300">Failed</span>
                </div>
                <div className="text-2xl font-bold text-red-900 dark:text-red-100">{jobs.filter((j: any) => j.status === 'failed').length}</div>
              </div>
            </div>
          </div>

          {/* Add New Connection Card */}
          <div className="glass-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                <Link2 className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h4 className="font-semibold">Add New Connection</h4>
                <p className="text-xs text-muted-foreground">Connect to Neon, Supabase, or any PostgreSQL database</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="cloudConnection" className="text-sm font-medium">PostgreSQL Connection String</Label>
                <div className="relative mt-2">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="cloudConnection" 
                    placeholder="postgresql://user:password@host:5432/database?sslmode=require" 
                    value={cloudConn} 
                    onChange={(e) => setCloudConn(e.target.value)} 
                    className="pl-10 font-mono text-sm"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Connection strings are encrypted and stored securely on the server
                </p>
              </div>

              {testResult && (
                <div className={`p-4 rounded-xl border-2 ${testResult.ok 
                  ? 'bg-green-50 dark:bg-green-950/30 border-green-300 dark:border-green-800' 
                  : 'bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-800'}`}>
                  <div className="flex items-center gap-3">
                    {testResult.ok ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0" />
                    )}
                    <div>
                      <p className={`font-medium ${testResult.ok ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'}`}>
                        {testResult.ok ? 'Connection Successful!' : 'Connection Failed'}
                      </p>
                      <p className={`text-sm ${testResult.ok ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                        {testResult.ok ? 'Database is ready for sync operations' : testResult.error}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                <Button 
                  onClick={handleTestCloudConnection} 
                  disabled={!cloudConn || isTesting} 
                  variant="outline"
                  className="gap-2"
                >
                  {isTesting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Activity className="h-4 w-4" />
                  )}
                  {isTesting ? 'Testing...' : 'Test Connection'}
                </Button>
                <Button 
                  onClick={handleSaveCloudConnection} 
                  disabled={!cloudConn || isSaving}
                  className="gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Database className="h-4 w-4" />
                  )}
                  {isSaving ? 'Saving...' : 'Save Connection'}
                </Button>
              </div>
            </div>
          </div>

          {/* Saved Connections Card */}
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                  <Server className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h4 className="font-semibold">Saved Connections</h4>
                  <p className="text-xs text-muted-foreground">Manage your database connections and sync operations</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={loadCloudConnections} className="gap-2">
                <RefreshCw className={`h-4 w-4 ${connectionsLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>

            {connectionsLoading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin mr-3" />
                Loading connections...
              </div>
            ) : connections.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="p-4 rounded-full bg-slate-100 dark:bg-slate-800 mb-4">
                  <Database className="h-8 w-8 text-slate-400" />
                </div>
                <p className="font-medium text-muted-foreground">No connections saved yet</p>
                <p className="text-sm text-muted-foreground/70 mt-1">Add a connection above to get started</p>
              </div>
            ) : (
              <div className="space-y-4">
                {connections.map((c: any) => (
                  <div key={c.id} className="p-5 rounded-xl border-2 border-border/50 hover:border-blue-300 dark:hover:border-blue-700 transition-all duration-200 bg-gradient-to-br from-slate-50/50 to-white dark:from-slate-900/50 dark:to-slate-800/50">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl ${c.provider === 'neon' 
                          ? 'bg-gradient-to-br from-green-400 to-cyan-500' 
                          : 'bg-gradient-to-br from-purple-400 to-pink-500'} text-white shadow-md`}>
                          <Cloud className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="font-semibold text-base">{c.label || c.provider}</div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                            <Badge variant="secondary" className="text-xs capitalize px-2 py-0">{c.provider}</Badge>
                            <span>•</span>
                            <Clock className="h-3 w-3" />
                            {new Date(c.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        onClick={() => handleDeleteConnection(c.id, c.label || c.provider)}
                        className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 h-9 w-9"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    {/* Sync Actions */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                          <Upload className="h-3.5 w-3.5" />
                          Export (Local → Cloud)
                        </p>
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => enqueueJob(c.id, 'export', true)} 
                            className="flex-1 text-xs h-9 gap-1.5"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Preview
                          </Button>
                          <Button 
                            size="sm" 
                            onClick={() => enqueueJob(c.id, 'export', false)} 
                            className="flex-1 text-xs h-9 gap-1.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
                          >
                            <Upload className="h-3.5 w-3.5" />
                            Export
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                          <Download className="h-3.5 w-3.5" />
                          Import (Cloud → Local)
                        </p>
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => enqueueJob(c.id, 'import', true)} 
                            className="flex-1 text-xs h-9 gap-1.5"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Preview
                          </Button>
                          <Button 
                            size="sm" 
                            onClick={() => enqueueJob(c.id, 'import', false)} 
                            className="flex-1 text-xs h-9 gap-1.5 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800"
                          >
                            <Download className="h-3.5 w-3.5" />
                            Import
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Job History Card */}
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                  <Activity className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <h4 className="font-semibold">Sync Job History</h4>
                  <p className="text-xs text-muted-foreground">Track and manage your sync operations</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={loadJobs} className="gap-2">
                  <RefreshCw className={`h-4 w-4 ${jobsLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
                <Button 
                  size="sm" 
                  onClick={processNextJob}
                  disabled={jobs.filter((j: any) => j.status === 'pending').length === 0}
                  className="gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
                >
                  <Zap className="h-4 w-4" />
                  Process Next
                </Button>
              </div>
            </div>

            {jobsLoading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin mr-3" />
                Loading jobs...
              </div>
            ) : jobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="p-4 rounded-full bg-slate-100 dark:bg-slate-800 mb-4">
                  <Activity className="h-8 w-8 text-slate-400" />
                </div>
                <p className="font-medium text-muted-foreground">No sync jobs yet</p>
                <p className="text-sm text-muted-foreground/70 mt-1">Jobs will appear here when you export or import data</p>
              </div>
            ) : (
              <div className="space-y-3">
                {jobs.map((j: any) => (
                  <div key={j.id} className="p-4 rounded-xl border border-border/50 bg-gradient-to-r from-slate-50/80 to-white/80 dark:from-slate-900/80 dark:to-slate-800/80">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${
                          j.job_type === 'export' 
                            ? 'bg-blue-100 dark:bg-blue-900/30' 
                            : 'bg-green-100 dark:bg-green-900/30'
                        }`}>
                          {j.job_type === 'export' ? (
                            <Upload className={`h-4 w-4 ${j.job_type === 'export' ? 'text-blue-600 dark:text-blue-400' : 'text-green-600 dark:text-green-400'}`} />
                          ) : (
                            <Download className={`h-4 w-4 ${j.job_type === 'export' ? 'text-blue-600 dark:text-blue-400' : 'text-green-600 dark:text-green-400'}`} />
                          )}
                        </div>
                        <div>
                          <div className="font-medium capitalize flex items-center gap-2">
                            {j.job_type}
                            {j.dry_run ? (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Preview</Badge>
                            ) : (
                              <Badge className="text-[10px] px-1.5 py-0 bg-orange-500">Live</Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <Clock className="h-3 w-3" />
                            {new Date(j.created_at).toLocaleString()}
                            <span>•</span>
                            Attempts: {j.attempts}
                          </div>
                        </div>
                      </div>
                      <Badge 
                        variant="outline"
                        className={`px-3 py-1 text-xs font-medium flex items-center gap-1.5 ${
                          j.status === 'success' ? 'border-green-300 text-green-700 bg-green-50 dark:border-green-700 dark:text-green-300 dark:bg-green-950/30' : 
                          j.status === 'failed' ? 'border-red-300 text-red-700 bg-red-50 dark:border-red-700 dark:text-red-300 dark:bg-red-950/30' : 
                          j.status === 'running' ? 'border-blue-300 text-blue-700 bg-blue-50 dark:border-blue-700 dark:text-blue-300 dark:bg-blue-950/30' : 
                          'border-amber-300 text-amber-700 bg-amber-50 dark:border-amber-700 dark:text-amber-300 dark:bg-amber-950/30'
                        }`}
                      >
                        {j.status === 'success' && <CheckCircle2 className="h-3.5 w-3.5" />}
                        {j.status === 'failed' && <XCircle className="h-3.5 w-3.5" />}
                        {j.status === 'running' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        {j.status === 'pending' && <Clock className="h-3.5 w-3.5" />}
                        {j.status.toUpperCase()}
                      </Badge>
                    </div>
                    
                    {j.last_error && (
                      <div className="mt-3 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                          <p className="text-sm text-red-700 dark:text-red-300">{j.last_error}</p>
                        </div>
                      </div>
                    )}
                    
                    {j.details && (
                      <details className="mt-3">
                        <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                          View Details
                        </summary>
                        <div className="mt-2 p-3 rounded-lg bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                          <pre className="text-xs overflow-auto text-slate-700 dark:text-slate-300">{j.details}</pre>
                        </div>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Security Info Card */}
          <div className="glass-card p-5 bg-gradient-to-r from-slate-50 to-blue-50/50 dark:from-slate-900/50 dark:to-blue-950/30 border-blue-200/50 dark:border-blue-800/50">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-900/30">
                <ShieldCheck className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Security Information</h4>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-blue-800 dark:text-blue-200">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-blue-500 flex-shrink-0" />
                    Connection strings encrypted with AES-256-GCM
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-blue-500 flex-shrink-0" />
                    Preview mode available before actual sync
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-blue-500 flex-shrink-0" />
                    All operations logged in job history
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-blue-500 flex-shrink-0" />
                    Admin PIN required to access this panel
                  </li>
                </ul>
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

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{confirmDialogData?.title || 'Confirm Action'}</DialogTitle>
            <DialogDescription className="whitespace-pre-line">
              {confirmDialogData?.message || ''}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={handleConfirmDialogCancel}>
              Cancel
            </Button>
            <Button onClick={handleConfirmDialogConfirm}>
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Strategy Selection Dialog */}
      <Dialog open={showStrategyDialog} onOpenChange={setShowStrategyDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>⚠️ Import Strategy Selection</DialogTitle>
            <DialogDescription>
              Choose how to handle data conflicts when importing from cloud
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <RadioGroup value={selectedStrategy} onValueChange={(value) => setSelectedStrategy(value as ImportStrategy)}>
              <div className="flex items-start space-x-3 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors">
                <RadioGroupItem value="merge" id="strategy-merge" className="mt-1" />
                <Label htmlFor="strategy-merge" className="flex-1 cursor-pointer">
                  <div className="font-semibold">Merge (Recommended)</div>
                  <div className="text-sm text-muted-foreground">
                    Combine both local and remote data. Newer records are prioritized.
                  </div>
                </Label>
              </div>
              <div className="flex items-start space-x-3 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors">
                <RadioGroupItem value="skip" id="strategy-skip" className="mt-1" />
                <Label htmlFor="strategy-skip" className="flex-1 cursor-pointer">
                  <div className="font-semibold">Skip</div>
                  <div className="text-sm text-muted-foreground">
                    Keep existing local records, only add new records from cloud.
                  </div>
                </Label>
              </div>
              <div className="flex items-start space-x-3 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors">
                <RadioGroupItem value="overwrite" id="strategy-overwrite" className="mt-1" />
                <Label htmlFor="strategy-overwrite" className="flex-1 cursor-pointer">
                  <div className="font-semibold">Overwrite</div>
                  <div className="text-sm text-muted-foreground">
                    Replace local data with remote data where conflicts exist.
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleStrategyCancel}>
              Cancel
            </Button>
            <Button onClick={handleStrategyConfirm}>
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}