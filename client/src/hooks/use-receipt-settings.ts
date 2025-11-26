import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Settings } from "@shared/schema";

export interface ReceiptSettings {
  businessName: string;
  address: string;
  dealerText: string;
  dealerBrands: string;
  thankYou: string;
  fontSize: string;
  itemFontSize: string;
  padding: string;
}

const DEFAULT_RECEIPT_SETTINGS: ReceiptSettings = {
  businessName: "ALI MUHAMMAD PAINTS",
  address: "Basti Malook, Multan. 0300-868-3395",
  dealerText: "AUTHORIZED DEALER:",
  dealerBrands: "ICI-DULUX / MOBI PAINTS / WESTER 77",
  thankYou: "THANKS FOR YOUR BUSINESS",
  fontSize: "11px",
  itemFontSize: "12px",
  padding: "0 12px 12px 12px",
};

const STORAGE_KEY = "posReceiptSettings";

export function useReceiptSettings() {
  const [receiptSettings, setReceiptSettings] = useState<ReceiptSettings>(DEFAULT_RECEIPT_SETTINGS);

  const { data: dbSettings } = useQuery<Settings>({
    queryKey: ["/api/settings"],
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const settings = JSON.parse(saved);
        setReceiptSettings({
          businessName: settings.businessName || DEFAULT_RECEIPT_SETTINGS.businessName,
          address: settings.address || DEFAULT_RECEIPT_SETTINGS.address,
          dealerText: settings.dealerText || DEFAULT_RECEIPT_SETTINGS.dealerText,
          dealerBrands: settings.dealerBrands || DEFAULT_RECEIPT_SETTINGS.dealerBrands,
          thankYou: settings.thankYou || DEFAULT_RECEIPT_SETTINGS.thankYou,
          fontSize: settings.fontSize ? `${settings.fontSize}px` : DEFAULT_RECEIPT_SETTINGS.fontSize,
          itemFontSize: settings.itemFontSize ? `${settings.itemFontSize}px` : DEFAULT_RECEIPT_SETTINGS.itemFontSize,
          padding: settings.padding ? `0 ${settings.padding}px 12px ${settings.padding}px` : DEFAULT_RECEIPT_SETTINGS.padding,
        });
      }
    } catch (error) {
      console.error("Error loading receipt settings:", error);
    }
  }, []);

  useEffect(() => {
    if (dbSettings?.storeName && !localStorage.getItem(STORAGE_KEY)) {
      setReceiptSettings(prev => ({
        ...prev,
        businessName: dbSettings.storeName,
      }));
    }
  }, [dbSettings]);

  const updateReceiptSettings = (newSettings: Partial<ReceiptSettings>) => {
    setReceiptSettings(prev => {
      const updated = { ...prev, ...newSettings };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          businessName: updated.businessName,
          address: updated.address,
          dealerText: updated.dealerText,
          dealerBrands: updated.dealerBrands,
          thankYou: updated.thankYou,
          fontSize: parseInt(updated.fontSize) || 11,
          itemFontSize: parseInt(updated.itemFontSize) || 12,
          padding: parseInt(updated.padding) || 12,
        }));
      } catch (error) {
        console.error("Error saving receipt settings:", error);
      }
      return updated;
    });
  };

  const storeName = dbSettings?.storeName || receiptSettings.businessName;

  return {
    receiptSettings,
    updateReceiptSettings,
    storeName,
    isLoading: false,
  };
}

export function getStoredReceiptSettings(): ReceiptSettings {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const settings = JSON.parse(saved);
      return {
        businessName: settings.businessName || DEFAULT_RECEIPT_SETTINGS.businessName,
        address: settings.address || DEFAULT_RECEIPT_SETTINGS.address,
        dealerText: settings.dealerText || DEFAULT_RECEIPT_SETTINGS.dealerText,
        dealerBrands: settings.dealerBrands || DEFAULT_RECEIPT_SETTINGS.dealerBrands,
        thankYou: settings.thankYou || DEFAULT_RECEIPT_SETTINGS.thankYou,
        fontSize: settings.fontSize ? `${settings.fontSize}px` : DEFAULT_RECEIPT_SETTINGS.fontSize,
        itemFontSize: settings.itemFontSize ? `${settings.itemFontSize}px` : DEFAULT_RECEIPT_SETTINGS.itemFontSize,
        padding: settings.padding ? `0 ${settings.padding}px 12px ${settings.padding}px` : DEFAULT_RECEIPT_SETTINGS.padding,
      };
    }
  } catch (error) {
    console.error("Error loading receipt settings:", error);
  }
  return DEFAULT_RECEIPT_SETTINGS;
}
