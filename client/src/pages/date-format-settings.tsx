import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Check, Globe } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { Settings, UpdateSettings } from "@shared/schema";

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

export default function DateFormatSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery<Settings>({
    queryKey: ["/api/settings"],
  });

  const [selectedFormat, setSelectedFormat] = useState<DateFormatType>("DD-MM-YYYY");

  useEffect(() => {
    if (settings?.dateFormat) {
      setSelectedFormat(settings.dateFormat as DateFormatType);
    }
  }, [settings]);

  const updateMutation = useMutation({
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
        title: "Date Format Saved",
        description: "The date format has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save date format. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    updateMutation.mutate({ dateFormat: selectedFormat });
  };

  const glassStyles = `
    .glass-card {
      background: rgba(255, 255, 255, 0.8);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.2);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
    }
    .gradient-bg {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }
  `;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 p-6">
        <style>{glassStyles}</style>
        <div className="max-w-2xl mx-auto">
          <div className="glass-card rounded-2xl p-6 animate-pulse">
            <div className="h-8 bg-slate-200 rounded w-48 mb-4"></div>
            <div className="h-4 bg-slate-200 rounded w-64 mb-8"></div>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-slate-100 rounded-xl"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 p-6">
      <style>{glassStyles}</style>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="glass-card rounded-2xl p-6 border border-white/20 shadow-xl">
          <div className="flex items-center gap-3 mb-2">
            <div className="gradient-bg p-2 rounded-xl">
              <CalendarDays className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent" data-testid="text-page-title">
                Date Format Settings
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                Choose how dates are displayed across all pages
              </p>
            </div>
          </div>
        </div>

        <Card className="glass-card rounded-2xl border-white/20">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-purple-600" />
              <CardTitle>Select Date Format</CardTitle>
            </div>
            <CardDescription>
              This setting will apply to all date displays in Dashboard, Reports, Unpaid Bills, Sales, and other pages.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <RadioGroup
              value={selectedFormat}
              onValueChange={(value) => setSelectedFormat(value as DateFormatType)}
              className="space-y-4"
            >
              {dateFormats.map((dateFormat) => (
                <div
                  key={dateFormat.value}
                  className={`relative flex items-center space-x-4 rounded-xl border-2 p-4 cursor-pointer transition-all ${
                    selectedFormat === dateFormat.value
                      ? "border-purple-500 bg-purple-50/50"
                      : "border-slate-200 hover:border-slate-300 bg-white/50"
                  }`}
                  onClick={() => setSelectedFormat(dateFormat.value)}
                  data-testid={`option-${dateFormat.value}`}
                >
                  <RadioGroupItem value={dateFormat.value} id={dateFormat.value} className="sr-only" />
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <Label
                        htmlFor={dateFormat.value}
                        className="text-lg font-semibold text-slate-800 cursor-pointer"
                      >
                        {dateFormat.label}
                      </Label>
                      {dateFormat.value === "DD-MM-YYYY" && (
                        <Badge variant="secondary" className="text-xs">
                          Default
                        </Badge>
                      )}
                      {selectedFormat === dateFormat.value && (
                        <Check className="h-5 w-5 text-purple-600" />
                      )}
                    </div>
                    <p className="text-sm text-slate-600">{dateFormat.description}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500 mb-1">Today's Date:</p>
                    <p className="text-lg font-mono font-semibold text-purple-600">
                      {dateFormat.example}
                    </p>
                  </div>
                </div>
              ))}
            </RadioGroup>

            <div className="flex items-center justify-between pt-4 border-t border-slate-200">
              <div className="text-sm text-slate-600">
                <p>Current format: <span className="font-semibold text-slate-800">{settings?.dateFormat || "DD-MM-YYYY"}</span></p>
              </div>
              <Button
                onClick={handleSave}
                disabled={updateMutation.isPending || selectedFormat === settings?.dateFormat}
                className="gradient-bg text-white"
                data-testid="button-save"
              >
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card rounded-2xl border-white/20">
          <CardHeader>
            <CardTitle className="text-base">Preview</CardTitle>
            <CardDescription>
              See how dates will appear with the selected format
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-slate-500 mb-1">Sale Date</p>
                <p className="font-mono font-semibold text-slate-800">
                  {format(new Date(), selectedFormat === "DD-MM-YYYY" ? "dd-MM-yyyy" : selectedFormat === "MM-DD-YYYY" ? "MM-dd-yyyy" : "yyyy-MM-dd")}
                </p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-slate-500 mb-1">Due Date</p>
                <p className="font-mono font-semibold text-slate-800">
                  {format(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), selectedFormat === "DD-MM-YYYY" ? "dd-MM-yyyy" : selectedFormat === "MM-DD-YYYY" ? "MM-dd-yyyy" : "yyyy-MM-dd")}
                </p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-slate-500 mb-1">Payment Date</p>
                <p className="font-mono font-semibold text-slate-800">
                  {format(new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), selectedFormat === "DD-MM-YYYY" ? "dd-MM-yyyy" : selectedFormat === "MM-DD-YYYY" ? "MM-dd-yyyy" : "yyyy-MM-dd")}
                </p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-slate-500 mb-1">Stock In Date</p>
                <p className="font-mono font-semibold text-slate-800">
                  {format(new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), selectedFormat === "DD-MM-YYYY" ? "dd-MM-yyyy" : selectedFormat === "MM-DD-YYYY" ? "MM-dd-yyyy" : "yyyy-MM-dd")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
