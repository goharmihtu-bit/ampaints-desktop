-- Add license management fields to settings table
-- This migration adds support for software license expiration and status tracking

ALTER TABLE settings ADD COLUMN license_expiry_date TEXT;
ALTER TABLE settings ADD COLUMN license_status TEXT NOT NULL DEFAULT 'active';
