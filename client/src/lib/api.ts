// Base API configuration
const API_BASE = '/api';

// Generic fetch wrapper
async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.statusText}`);
  }

  return response.json();
}

// Audit Log Types
export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  action: string;
  type: 'export' | 'import' | 'system';
  status: 'success' | 'failure' | 'pending';
  details?: string;
}

export interface ExportLog {
  id: string;
  timestamp: string;
  userId: string;
  format: 'csv' | 'excel' | 'pdf';
  status: 'success' | 'failure';
  details?: string;
}

export interface ImportLog {
  id: string;
  timestamp: string;
  userId: string;
  format: 'csv' | 'excel' | 'pdf';
  status: 'success' | 'failure';
  details?: string;
}

// Audit API
export const auditApi = {
  async getLogs(filters?: Record<string, any>): Promise<AuditLog[]> {
    return fetchAPI<AuditLog[]>('/audit/logs');
  },

  async getExportLogs(filters?: Record<string, any>): Promise<ExportLog[]> {
    return fetchAPI<ExportLog[]>('/audit/exports');
  },

  async getImportLogs(filters?: Record<string, any>): Promise<ImportLog[]> {
    return fetchAPI<ImportLog[]>('/audit/imports');
  },

  async getLog(id: string): Promise<AuditLog> {
    return fetchAPI<AuditLog>(`/audit/logs/${id}`);
  },
};
