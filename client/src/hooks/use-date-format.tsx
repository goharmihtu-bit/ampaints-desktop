import { createContext, useContext, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import type { Settings } from "@shared/schema";

type DateFormatType = "DD-MM-YYYY" | "MM-DD-YYYY" | "YYYY-MM-DD";

interface DateFormatContextType {
  dateFormat: DateFormatType;
  formatDate: (dateStr: string | Date | null | undefined) => string;
  formatDateShort: (dateStr: string | Date | null | undefined) => string;
  parseDate: (dateStr: string | Date | null) => Date | null;
  isLoading: boolean;
}

const DateFormatContext = createContext<DateFormatContextType | undefined>(undefined);

const dateFormatPatterns: Record<DateFormatType, string> = {
  "DD-MM-YYYY": "dd-MM-yyyy",
  "MM-DD-YYYY": "MM-dd-yyyy",
  "YYYY-MM-DD": "yyyy-MM-dd",
};

const dateFormatPatternsShort: Record<DateFormatType, string> = {
  "DD-MM-YYYY": "dd MMM yyyy",
  "MM-DD-YYYY": "MMM dd, yyyy",
  "YYYY-MM-DD": "yyyy MMM dd",
};

export function DateFormatProvider({ children }: { children: React.ReactNode }) {
  const { data: settings, isLoading } = useQuery<Settings>({
    queryKey: ["/api/settings"],
  });

  const dateFormat = (settings?.dateFormat as DateFormatType) || "DD-MM-YYYY";

  const parseDate = (dateStr: string | Date | null): Date | null => {
    if (!dateStr) return null;
    if (dateStr instanceof Date) return dateStr;

    if (typeof dateStr === "string") {
      if (dateStr.includes("T") || dateStr.includes("Z")) {
        return parseISO(dateStr);
      }

      if (dateStr.includes("-")) {
        const parts = dateStr.split("-");
        if (parts[0].length === 4) {
          return parseISO(dateStr);
        } else if (parts.length === 3) {
          const [day, month, year] = parts.map(Number);
          return new Date(year, month - 1, day);
        }
      }

      const timestamp = Number(dateStr);
      if (!isNaN(timestamp)) {
        return new Date(timestamp);
      }
    }

    return new Date(dateStr);
  };

  const formatDate = (dateStr: string | Date | null | undefined): string => {
    if (!dateStr) return "N/A";
    const date = parseDate(dateStr);
    if (!date || isNaN(date.getTime())) return "Invalid Date";
    try {
      return format(date, dateFormatPatterns[dateFormat]);
    } catch {
      return "Invalid Date";
    }
  };

  const formatDateShort = (dateStr: string | Date | null | undefined): string => {
    if (!dateStr) return "N/A";
    const date = parseDate(dateStr);
    if (!date || isNaN(date.getTime())) return "Invalid Date";
    try {
      return format(date, dateFormatPatternsShort[dateFormat]);
    } catch {
      return "Invalid Date";
    }
  };

  const value = useMemo(
    () => ({
      dateFormat,
      formatDate,
      formatDateShort,
      parseDate,
      isLoading,
    }),
    [dateFormat, isLoading]
  );

  return (
    <DateFormatContext.Provider value={value}>
      {children}
    </DateFormatContext.Provider>
  );
}

export function useDateFormat() {
  const context = useContext(DateFormatContext);
  if (context === undefined) {
    throw new Error("useDateFormat must be used within a DateFormatProvider");
  }
  return context;
}
