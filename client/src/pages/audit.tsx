import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, ScatterChart, Scatter
} from 'recharts';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
  Tabs, TabsContent, TabsList, TabsTrigger,
  Dialog, DialogContent, DialogHeader, DialogTitle,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  Button, Input, Badge, ScrollArea
} from '@/components/ui';
import {
  Download, Upload, TrendingUp, AlertCircle, Activity, Eye, EyeOff, Filter, ChevronDown,
  Calendar, Clock, User, FileText, CheckCircle2, XCircle, HelpCircle, BarChart3, PieChart as PieChartIcon
} from 'lucide-react';
import type { AuditLog, ExportLog, ImportLog } from '@/api/audit';
import { auditApi } from '@/api/audit';
import { cn } from '@/lib/utils';

interface AuditFilters {
  dateRange: 'all' | '7days' | '30days' | '90days';
  logType: 'all' | 'export' | 'import' | 'system';
  userId: string;
  searchText: string;
}

interface ExportCounts {
  csvCount: number;
  excelCount: number;
  pdfCount: number;
  totalCount: number;
}

interface ImportCounts {
  csvCount: number;
  excelCount: number;
  pdfCount: number;
  totalCount: number;
}

const AuditPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [exportLogs, setExportLogs] = useState<ExportLog[]>([]);
  const [importLogs, setImportLogs] = useState<ImportLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [showDetails, setShowDetails] = useState<Record<string, boolean>>({});
  const [filters, setFilters] = useState<AuditFilters>({
    dateRange: 'all',
    logType: 'all',
    userId: '',
    searchText: ''
  });

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        setLoading(true);
        const [auditData, exportData, importData] = await Promise.all([
          auditApi.getLogs({}),
          auditApi.getExportLogs({}),
          auditApi.getImportLogs({})
        ]);
        setLogs(auditData);
        setExportLogs(exportData);
        setImportLogs(importData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch audit logs');
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, []);

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const logDate = new Date(log.timestamp);
      const now = new Date();
      const daysAgo = (now.getTime() - logDate.getTime()) / (1000 * 60 * 60 * 24);

      let matchesDateRange = true;
      if (filters.dateRange === '7days') matchesDateRange = daysAgo <= 7;
      else if (filters.dateRange === '30days') matchesDateRange = daysAgo <= 30;
      else if (filters.dateRange === '90days') matchesDateRange = daysAgo <= 90;

      const matchesType = filters.logType === 'all' || log.type === filters.logType;
      const matchesUser = !filters.userId || log.userId === filters.userId;
      const matchesSearch = !filters.searchText ||
        log.action.toLowerCase().includes(filters.searchText.toLowerCase()) ||
        (log.details && log.details.toLowerCase().includes(filters.searchText.toLowerCase()));

      return matchesDateRange && matchesType && matchesUser && matchesSearch;
    });
  }, [logs, filters]);

  const exportCounts: ExportCounts = useMemo(() => ({
    csvCount: exportLogs.filter(log => log.format === 'csv').length,
    excelCount: exportLogs.filter(log => log.format === 'excel').length,
    pdfCount: exportLogs.filter(log => log.format === 'pdf').length,
    totalCount: exportLogs.length
  }), [exportLogs]);

  const importCounts: ImportCounts = useMemo(() => ({
    csvCount: importLogs.filter(log => log.format === 'csv').length,
    excelCount: importLogs.filter(log => log.format === 'excel').length,
    pdfCount: importLogs.filter(log => log.format === 'pdf').length,
    totalCount: importLogs.length
  }), [importLogs]);

  const lastExportCounts = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todaysExports = exportLogs.filter(log => {
      const logDate = new Date(log.timestamp);
      logDate.setHours(0, 0, 0, 0);
      return logDate.getTime() === today.getTime();
    });

    return todaysExports.length > 0 ? {
      csvCount: todaysExports.filter(log => log.format === 'csv').length,
      excelCount: todaysExports.filter(log => log.format === 'excel').length,
      pdfCount: todaysExports.filter(log => log.format === 'pdf').length,
      totalCount: todaysExports.length
    } : null;
  }, [exportLogs]);

  const lastImportCounts = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todaysImports = importLogs.filter(log => {
      const logDate = new Date(log.timestamp);
      logDate.setHours(0, 0, 0, 0);
      return logDate.getTime() === today.getTime();
    });

    return todaysImports.length > 0 ? {
      csvCount: todaysImports.filter(log => log.format === 'csv').length,
      excelCount: todaysImports.filter(log => log.format === 'excel').length,
      pdfCount: todaysImports.filter(log => log.format === 'pdf').length,
      totalCount: todaysImports.length
    } : null;
  }, [importLogs]);

  const chartData = useMemo(() => {
    const last30Days = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const exports = exportLogs.filter(log => {
        const logDate = new Date(log.timestamp);
        logDate.setHours(0, 0, 0, 0);
        return logDate.getTime() === date.getTime();
      }).length;

      const imports = importLogs.filter(log => {
        const logDate = new Date(log.timestamp);
        logDate.setHours(0, 0, 0, 0);
        return logDate.getTime() === date.getTime();
      }).length;

      last30Days.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        exports,
        imports,
        total: exports + imports
      });
    }
    return last30Days;
  }, [exportLogs, importLogs]);

  const exportFormatData = [
    { name: 'CSV', value: exportCounts.csvCount, color: '#3b82f6' },
    { name: 'Excel', value: exportCounts.excelCount, color: '#10b981' },
    { name: 'PDF', value: exportCounts.pdfCount, color: '#f59e0b' }
  ];

  const importFormatData = [
    { name: 'CSV', value: importCounts.csvCount, color: '#3b82f6' },
    { name: 'Excel', value: importCounts.excelCount, color: '#10b981' },
    { name: 'PDF', value: importCounts.pdfCount, color: '#f59e0b' }
  ];

  const selectedLog = logs.find(log => log.id === selectedLogId);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />;
      default:
        return <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      success: 'default',
      error: 'destructive',
      pending: 'secondary'
    };
    return <Badge variant={variants[status] || 'outline'}>{status}</Badge>;
  };

  const handleDetailClick = (logId: string) => {
    setSelectedLogId(logId);
    setShowDetailDialog(true);
  };

  const handleFilterChange = (key: keyof AuditFilters, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg text-gray-600 dark:text-gray-400">Loading audit logs...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg text-red-600 dark:text-red-400">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Audit Logs</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">Track all system activities and data changes</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Logs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{logs.length}</div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Exports</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{exportCounts.totalCount}</div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">All formats</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Imports</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{importCounts.totalCount}</div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">All formats</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{new Set(logs.map(log => log.userId)).size}</div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Unique users</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <Tabs defaultValue="timeline" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="exports">Export Formats</TabsTrigger>
          <TabsTrigger value="imports">Import Formats</TabsTrigger>
        </TabsList>

        <TabsContent value="timeline">
          <Card>
            <CardHeader>
              <CardTitle>Activity Timeline (Last 30 Days)</CardTitle>
              <CardDescription>Export and import activity over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="exports" stroke="#3b82f6" />
                  <Line type="monotone" dataKey="imports" stroke="#10b981" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="exports">
          <Card>
            <CardHeader>
              <CardTitle>Export Format Distribution</CardTitle>
              <CardDescription>Breakdown of exports by format</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={exportFormatData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {exportFormatData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="imports">
          <Card>
            <CardHeader>
              <CardTitle>Import Format Distribution</CardTitle>
              <CardDescription>Breakdown of imports by format</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={importFormatData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {importFormatData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Statistics Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Statistics
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">CSV Exports</p>
              <p className="text-2xl font-bold">{exportCounts.csvCount}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Excel Exports</p>
              <p className="text-2xl font-bold">{exportCounts.excelCount}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">PDF Exports</p>
              <p className="text-2xl font-bold">{exportCounts.pdfCount}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Exports</p>
              <p className="text-2xl font-bold">{exportCounts.totalCount}</p>
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
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-200">Today's Exports</p>
                  <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">CSV: </span>
                      <span className="font-semibold">{lastExportCounts.csvCount}</span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Excel: </span>
                      <span className="font-semibold">{lastExportCounts.excelCount}</span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">PDF: </span>
                      <span className="font-semibold">{lastExportCounts.pdfCount}</span>
                    </div>
                  </div>
                </div>
              )}

              {lastImportCounts && (
                <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <p className="text-sm font-medium text-green-900 dark:text-green-200">Today's Imports</p>
                  <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">CSV: </span>
                      <span className="font-semibold">{lastImportCounts.csvCount}</span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Excel: </span>
                      <span className="font-semibold">{lastImportCounts.excelCount}</span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">PDF: </span>
                      <span className="font-semibold">{lastImportCounts.pdfCount}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium block mb-2">Date Range</label>
              <Select value={filters.dateRange} onValueChange={(value: any) => handleFilterChange('dateRange', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="7days">Last 7 Days</SelectItem>
                  <SelectItem value="30days">Last 30 Days</SelectItem>
                  <SelectItem value="90days">Last 90 Days</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium block mb-2">Log Type</label>
              <Select value={filters.logType} onValueChange={(value: any) => handleFilterChange('logType', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="export">Export</SelectItem>
                  <SelectItem value="import">Import</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium block mb-2">User ID</label>
              <Input
                placeholder="Filter by user..."
                value={filters.userId}
                onChange={(e) => handleFilterChange('userId', e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium block mb-2">Search</label>
              <Input
                placeholder="Search in logs..."
                value={filters.searchText}
                onChange={(e) => handleFilterChange('searchText', e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Audit Logs</CardTitle>
              <CardDescription>
                Showing {filteredLogs.length} of {logs.length} logs
              </CardDescription>
            </div>
            <Button variant="outline" onClick={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}>
              {viewMode === 'list' ? 'Grid View' : 'List View'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {viewMode === 'list' ? (
            <ScrollArea className="w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map(log => (
                    <TableRow key={log.id} className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
                      <TableCell className="text-sm">
                        {new Date(log.timestamp).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-sm">{log.userId}</TableCell>
                      <TableCell className="text-sm font-medium">{log.action}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{log.type}</Badge>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(log.status)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDetailClick(log.id)}
                          className="h-8 w-8 p-0"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredLogs.map(log => (
                <Card key={log.id} className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => handleDetailClick(log.id)}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base">{log.action}</CardTitle>
                        <CardDescription className="text-xs mt-1">
                          {new Date(log.timestamp).toLocaleString()}
                        </CardDescription>
                      </div>
                      {getStatusIcon(log.status)}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div>
                      <p className="text-xs text-gray-600 dark:text-gray-400">User</p>
                      <p className="text-sm font-medium">{log.userId}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 dark:text-gray-400">Type</p>
                      <Badge variant="outline">{log.type}</Badge>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 dark:text-gray-400">Status</p>
                      {getStatusBadge(log.status)}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-2xl max-h-screen overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Log Details</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Timestamp</p>
                  <p className="font-medium">{new Date(selectedLog.timestamp).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">User ID</p>
                  <p className="font-medium">{selectedLog.userId}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Action</p>
                  <p className="font-medium">{selectedLog.action}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Type</p>
                  <Badge variant="outline">{selectedLog.type}</Badge>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Status</p>
                  {getStatusBadge(selectedLog.status)}
                </div>
              </div>

              {selectedLog.details && (
                <div>
                  <p className="text-sm font-medium mb-2">Details</p>
                  <pre className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg text-xs overflow-x-auto">
                    {selectedLog.details}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AuditPage;
