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
      if (!response.ok) throw new Error('Invalid PIN');
      setIsAdminUnlocked(true);
      try { sessionStorage.setItem('admin_unlocked', '1') } catch {}
      setShowAdminPinDialog(false);
      setAdminPinInput(["", "", "", ""]);
      toast({ title: 'Admin Unlocked', description: 'You can access admin tools.' });
    } catch (err: any) {
      setAdminPinError('Invalid PIN. Please try again.');
      setAdminPinInput(["", "", "", ""]);
      const first = document.querySelector('[data-testid="input-admin-pin-0"]') as HTMLInputElement;
      first?.focus();
    } finally {
      setIsVerifyingPin(false);
    }
  };

  // ---------- License state & handlers (copied from Settings)
  const [licenseExpiryDate, setLicenseExpiryDate] = useState("");
  const [isLicenseActive, setIsLicenseActive] = useState(true);
  const [isSettingLicense, setIsSettingLicense] = useState(false);
  const [secretKeyInput, setSecretKeyInput] = useState("");
  const [showSecretKeyInput, setShowSecretKeyInput] = useState(false);

  const { data: licenseData, isLoading: isLoadingLicense } = useQuery({
    queryKey: ["/api/license/status"],
  });

  useEffect(() => {
    if (licenseData) {
      setIsLicenseActive(licenseData?.active ?? true);
    }
  }, [licenseData]);

  const handleSetLicenseExpiry = async () => {
    if (!licenseExpiryDate) {
      toast({ title: 'Error', description: 'Select expiry date', variant: 'destructive' });
      return;
    }
    setIsSettingLicense(true);
    try {
      const response = await fetch('/api/license/set-expiry', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expiryDate: licenseExpiryDate }) });
      if (!response.ok) throw await response.json();
      toast({ title: 'License Updated', description: `License expiry date set to ${licenseExpiryDate}` });
      queryClient.invalidateQueries({ queryKey: ['/api/license/status'] });
    } catch (error: any) {
      toast({ title: 'Error', description: error.error || 'Failed to set license expiry', variant: 'destructive' });
    } finally { setIsSettingLicense(false) }
  };

  const handleDeactivateLicense = async () => {
    if (!confirm('Are you sure you want to deactivate the license? The software will become unusable.')) return;
    setIsSettingLicense(true);
    try {
      const response = await fetch('/api/license/deactivate', { method: 'POST' });
      if (!response.ok) throw await response.json();
      toast({ title: 'License Deactivated', description: 'The software license has been deactivated.' });
      setIsLicenseActive(false);
      queryClient.invalidateQueries({ queryKey: ['/api/license/status'] });
    } catch (error: any) {
      toast({ title: 'Error', description: error.error || 'Failed to deactivate license', variant: 'destructive' });
    } finally { setIsSettingLicense(false) }
  };

  const handleActivateLicense = async () => {
    setIsSettingLicense(true);
    try {
      const body = secretKeyInput ? JSON.stringify({ secretKey: secretKeyInput }) : JSON.stringify({});
      const response = await fetch('/api/license/activate', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body 
      });
      if (!response.ok) {
        const error = await response.json();
        throw error;
      }
      const result = await response.json();
      toast({ title: 'License Activated', description: result.message || 'Your license has been successfully reactivated!' });
      setIsLicenseActive(true);
      setSecretKeyInput("");
      setShowSecretKeyInput(false);
      queryClient.invalidateQueries({ queryKey: ['/api/license/status'] });
    } catch (error: any) {
      toast({ title: 'Error', description: error.error || 'Failed to activate license', variant: 'destructive' });
    } finally { setIsSettingLicense(false) }
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
    setIsTesting(true);
    try {
      const res = await apiRequest('POST', '/api/cloud-sync/test-connection', { connectionString: cloudConn });
      const json = await res.json();
      setTestResult(json);
      if (json.ok) {
        toast({ title: 'Connection Successful', description: 'Remote Postgres connection validated.' });
      } else {
        toast({ title: 'Connection Failed', description: json.error || 'Unable to connect', variant: 'destructive' });
      }
    } catch (err: any) {
      setTestResult({ ok: false, error: err.message || String(err) });
      toast({ title: 'Connection Error', description: err.message || String(err), variant: 'destructive' });
    } finally { setIsTesting(false) }
  };

  const handleSaveCloudConnection = async () => {
    setIsSaving(true);
    try {
      const res = await apiRequest('POST', '/api/cloud-sync/connections', { provider: 'neon', label: 'Neon', connectionString: cloudConn });
      const json = await res.json();
      if (res.ok && json.ok) {
        toast({ title: 'Saved', description: 'Connection saved on server' });
        setCloudConn("");
        loadCloudConnections();
      } else { 
        throw new Error(json.error || 'Failed') 
      }
    } catch (err: any) { 
      toast({ title: 'Error', description: err.message || String(err), variant: 'destructive' }) 
    } finally { setIsSaving(false) }
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
        const strategy = prompt('Import strategy (skip, overwrite, merge). Default: merge', 'merge') || 'merge';
        if (!["skip","overwrite","merge"].includes(strategy)) { 
          toast({ title: 'Cancelled', description: 'Invalid strategy selected', variant: 'destructive' }); 
          return; 
        }
        details = { strategy };
      }
      const res = await apiRequest('POST', '/api/cloud-sync/jobs', { connectionId, jobType, dryRun: true, details });
      const json = await res.json();
      if (res.ok && json.ok) {
        toast({ title: 'Job Enqueued', description: `Job ${json.jobId} created (dry-run)` });
      } else {
        toast({ title: 'Error', description: json.error || 'Failed to enqueue', variant: 'destructive' });
      }
    } catch (err: any) { 
      toast({ title: 'Error', description: err.message || String(err), variant: 'destructive' }) 
    }
  };

  const processNextJob = async () => {
    try {
      const res = await apiRequest('POST', '/api/cloud-sync/process-next');
      const json = await res.json();
      if (res.ok && json.ok) {
        toast({ title: 'Job processed', description: json.result?.status || 'Processed' });
        loadJobs();
      } else {
        toast({ title: 'Error', description: json.error || 'Failed to process job', variant: 'destructive' });
      }
    } catch (err: any) { 
      toast({ title: 'Error', description: err.message || String(err), variant: 'destructive' }) 
    }
  };

  useEffect(() => { loadCloudConnections(); loadJobs() }, []);

  // ---------- Admin PIN change form
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [isChangingPin, setIsChangingPin] = useState(false);

  const handleChangeMasterPin = async () => {
    if (!newPin || newPin !== confirmPin) {
      toast({ title: 'Error', description: 'New PINs do not match', variant: 'destructive' });
      return;
    }
    setIsChangingPin(true);
    try {
      const res = await fetch('/api/license/set-master-pin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPin, newPin }) });
      const json = await res.json();
      if (res.ok && json.ok) {
        toast({ title: 'PIN Updated', description: 'Master PIN changed successfully' });
        setCurrentPin(''); 
        setNewPin(''); 
        setConfirmPin('');
      } else {
        toast({ title: 'Error', description: json.error || 'Failed to set PIN', variant: 'destructive' });
      }
    } catch (err: any) { 
      toast({ title: 'Error', description: err.message || String(err), variant: 'destructive' }) 
    } finally { setIsChangingPin(false) }
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
                {isLicenseActive ? 'Active' : 'Deactivated'}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              Manage your software license expiration date and activation status
            </p>
            <div className="space-y-6">
              {/* Current Status */}
              <div className={`border ${isLicenseActive ? 'border-green-500/50 bg-green-50/50 dark:bg-green-950/30' : 'border-red-500/50 bg-red-50/50 dark:bg-red-950/30'} rounded-lg p-4`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Zap className={`h-5 w-5 ${isLicenseActive ? 'text-green-600' : 'text-red-600'}`} />
                    <h4 className="font-semibold">Current License Status</h4>
                  </div>
                  <Badge variant={isLicenseActive ? 'default' : 'destructive'}>
                    {isLicenseActive ? 'ACTIVE' : 'DEACTIVATED'}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  {isLicenseActive 
                    ? 'Your software license is active and operational.' 
                    : '⚠️ Your software license is currently DEACTIVATED. The software is not operational. Enter secret key below to reactivate.'}
                </p>
                {licenseData?.expiryDate && (
                  <p className="text-xs text-muted-foreground">
                    Expiry Date: {licenseData.expiryDate}
                  </p>
                )}
              </div>

              {/* License Reactivation */}
              {!isLicenseActive && (
                <div className="border border-blue-500/50 rounded-lg p-4 space-y-4 bg-blue-50/50 dark:bg-blue-950/20">
                  <div>
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <Key className="h-4 w-4 text-blue-600" />
                      Reactivate License with Secret Key
                    </h4>
                    <p className="text-xs text-muted-foreground mb-3">
                      Enter your secret key to reactivate the software and set a new 10-year expiry date
                    </p>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="secret-key">Secret Key</Label>
                      <Input 
                        id="secret-key" 
                        type="password" 
                        value={secretKeyInput} 
                        onChange={(e) => setSecretKeyInput(e.target.value)} 
                        placeholder="Enter secret key"
                        className="mt-1" 
                      />
                    </div>
                    <Button onClick={handleActivateLicense} disabled={isSettingLicense || !secretKeyInput}>
                      {isSettingLicense ? 'Activating...' : 'Activate License'}
                    </Button>
                  </div>
                </div>
              )}

              {/* License Management (only show when active) */}
              {isLicenseActive && (
                <div className="border border-border/50 rounded-lg p-4 space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      License Management
                    </h4>
                    <p className="text-xs text-muted-foreground mb-3">
                      Set expiry date or deactivate license
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
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleSetLicenseExpiry} disabled={isSettingLicense}>
                        {isSettingLicense ? 'Saving...' : 'Set Expiry'}
                      </Button>
                      <Button variant="destructive" onClick={handleDeactivateLicense} disabled={isSettingLicense}>
                        Deactivate License
                      </Button>
                      <Button variant="outline" onClick={handleActivateLicense} disabled={isSettingLicense}>
                        Reactivate (10 Years)
                      </Button>
                    </div>
                  </div>
                </div>
              )}
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