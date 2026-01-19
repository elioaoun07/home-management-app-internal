// src/components/inventory/BarcodeScanner.tsx
"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import type { BarcodeScanResult } from "@/types/inventory";
import {
  AlertCircle,
  Camera,
  Check,
  Keyboard,
  Loader2,
  RotateCcw,
  ScanLine,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

interface BarcodeScannerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (result: BarcodeScanResult) => void;
  onError?: (error: string) => void;
}

// EAN-13 checksum validation
const validateEAN13 = (code: string): boolean => {
  if (code.length !== 13 || !/^\d{13}$/.test(code)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(code[i]) * (i % 2 === 0 ? 1 : 3);
  }
  return (10 - (sum % 10)) % 10 === parseInt(code[12]);
};

// EAN-8 checksum validation
const validateEAN8 = (code: string): boolean => {
  if (code.length !== 8 || !/^\d{8}$/.test(code)) return false;
  let sum = 0;
  for (let i = 0; i < 7; i++) {
    sum += parseInt(code[i]) * (i % 2 === 0 ? 3 : 1);
  }
  return (10 - (sum % 10)) % 10 === parseInt(code[7]);
};

// UPC-A checksum validation
const validateUPCA = (code: string): boolean => {
  if (code.length !== 12 || !/^\d{12}$/.test(code)) return false;
  let sum = 0;
  for (let i = 0; i < 11; i++) {
    sum += parseInt(code[i]) * (i % 2 === 0 ? 3 : 1);
  }
  return (10 - (sum % 10)) % 10 === parseInt(code[11]);
};

// Validate and get format
function validateBarcode(code: string): { valid: boolean; format: BarcodeScanResult["format"] } {
  if (code.length === 13 && /^\d{13}$/.test(code)) {
    return { valid: validateEAN13(code), format: "EAN_13" };
  }
  if (code.length === 8 && /^\d{8}$/.test(code)) {
    return { valid: validateEAN8(code), format: "EAN_8" };
  }
  if (code.length === 12 && /^\d{12}$/.test(code)) {
    return { valid: validateUPCA(code), format: "UPC_A" };
  }
  // Accept other formats
  return { valid: true, format: "unknown" };
}

const REQUIRED_READS = 3;

export function BarcodeScanner({
  open,
  onOpenChange,
  onScan,
  onError,
}: BarcodeScannerProps) {
  const themeClasses = useThemeClasses();
  const scannerRef = useRef<HTMLDivElement>(null);
  const html5QrCodeRef = useRef<unknown>(null);

  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [lastCode, setLastCode] = useState<string | null>(null);
  const [scanProgress, setScanProgress] = useState(0);
  const [resolution, setResolution] = useState("");

  // Track consistent reads
  const readsRef = useRef<Map<string, number>>(new Map());
  const processingRef = useRef(false);

  // Stop scanner
  const stopScanner = useCallback(async () => {
    if (html5QrCodeRef.current) {
      try {
        const scanner = html5QrCodeRef.current as { stop: () => Promise<void>; clear: () => void };
        await scanner.stop();
        scanner.clear();
      } catch {}
      html5QrCodeRef.current = null;
    }
    setIsScanning(false);
    setScanProgress(0);
    readsRef.current.clear();
  }, []);

  // Handle successful scan
  const handleScanSuccess = useCallback((decodedText: string) => {
    if (processingRef.current) return;

    const validation = validateBarcode(decodedText);
    
    if (!validation.valid) {
      // Invalid checksum - don't count
      setLastCode(decodedText + " ❌");
      return;
    }

    setLastCode(decodedText);

    // Track reads
    const count = (readsRef.current.get(decodedText) || 0) + 1;
    readsRef.current.set(decodedText, count);

    // Clear other codes
    for (const [key] of readsRef.current) {
      if (key !== decodedText) readsRef.current.delete(key);
    }

    setScanProgress(Math.min(100, (count / REQUIRED_READS) * 100));

    if (count >= REQUIRED_READS) {
      processingRef.current = true;
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);

      stopScanner().then(() => {
        onScan({
          barcode: decodedText,
          format: validation.format,
          timestamp: new Date().toISOString(),
        });
        onOpenChange(false);
        processingRef.current = false;
      });
    }
  }, [onScan, onOpenChange, stopScanner]);

  // Initialize scanner
  const initScanner = useCallback(async () => {
    if (!scannerRef.current) return;
    
    setIsInitializing(true);
    setError(null);
    setScanProgress(0);
    setLastCode(null);
    readsRef.current.clear();
    processingRef.current = false;

    try {
      // Dynamic import to avoid SSR issues
      const { Html5Qrcode } = await import("html5-qrcode");

      const scannerId = "barcode-scanner-region";
      
      // Clear existing
      if (scannerRef.current) {
        scannerRef.current.innerHTML = `<div id="${scannerId}"></div>`;
      }

      const html5QrCode = new Html5Qrcode(scannerId, { verbose: false });
      html5QrCodeRef.current = html5QrCode;

      // Get cameras
      const cameras = await Html5Qrcode.getCameras();
      if (cameras.length === 0) {
        throw new Error("No camera found");
      }

      // Prefer back camera
      const backCamera = cameras.find(
        (c) => c.label.toLowerCase().includes("back") || 
               c.label.toLowerCase().includes("rear") ||
               c.label.toLowerCase().includes("environment")
      ) || cameras[cameras.length - 1]; // Last camera is usually back camera on mobile

      // Start scanning with optimal config
      await html5QrCode.start(
        backCamera.id,
        {
          fps: 15,
          qrbox: { width: 280, height: 150 },
          aspectRatio: 1.333,
        },
        handleScanSuccess,
        () => {} // Ignore errors during scanning
      );

      // Get resolution from video element
      const videoElem = scannerRef.current?.querySelector("video");
      if (videoElem) {
        const w = videoElem.videoWidth;
        const h = videoElem.videoHeight;
        setResolution(`${w}×${h}`);
      }

      setIsScanning(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to start scanner";
      setError(msg);
      onError?.(msg);
    } finally {
      setIsInitializing(false);
    }
  }, [handleScanSuccess, onError]);

  // Open/close handling
  useEffect(() => {
    if (open) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => initScanner(), 100);
      return () => clearTimeout(timer);
    } else {
      stopScanner();
      setLastCode(null);
    }
  }, [open, initScanner, stopScanner]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, [stopScanner]);

  // Manual entry
  const [manualEntry, setManualEntry] = useState(false);
  const [manualBarcode, setManualBarcode] = useState("");
  const [manualError, setManualError] = useState<string | null>(null);

  const handleManualSubmit = () => {
    const code = manualBarcode.trim();
    if (!code) return;

    const validation = validateBarcode(code);
    if (!validation.valid) {
      setManualError("Invalid checksum");
      return;
    }

    onScan({
      barcode: code,
      format: validation.format,
      timestamp: new Date().toISOString(),
    });
    onOpenChange(false);
  };

  const switchToManual = async () => {
    await stopScanner();
    setManualEntry(true);
  };

  const switchToCamera = () => {
    setManualEntry(false);
    setManualBarcode("");
    setManualError(null);
    setTimeout(() => initScanner(), 100);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn("sm:max-w-md p-0 overflow-hidden", themeClasses.cardBg, themeClasses.border)}
      >
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="flex items-center justify-between text-white">
            <span className="flex items-center gap-2">
              <ScanLine className="w-5 h-5" />
              Scan Barcode
            </span>
            {resolution && (
              <span className="text-xs text-white/40 font-normal">{resolution}</span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="relative">
          {!manualEntry ? (
            <div className="relative">
              {isInitializing && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-20 min-h-[300px]">
                  <Loader2 className="w-8 h-8 animate-spin text-white/60 mb-2" />
                  <span className="text-white/60">Starting camera...</span>
                </div>
              )}

              {error && (
                <div className="flex flex-col items-center justify-center p-8 text-center min-h-[300px]">
                  <AlertCircle className="w-12 h-12 text-red-400 mb-3" />
                  <p className="text-white/80 text-sm mb-4">{error}</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={initScanner}>
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Retry
                    </Button>
                    <Button variant="outline" size="sm" onClick={switchToManual}>
                      <Keyboard className="w-4 h-4 mr-2" />
                      Manual
                    </Button>
                  </div>
                </div>
              )}

              {/* Scanner container */}
              <div 
                ref={scannerRef} 
                className={cn(
                  "w-full min-h-[300px] bg-black",
                  "[&_video]:w-full [&_video]:h-full [&_video]:object-cover",
                  "[&_#qr-shaded-region]:border-green-500/50",
                  error && "hidden"
                )}
              />

              {/* Overlay UI */}
              {isScanning && !error && (
                <>
                  {/* Code preview */}
                  {lastCode && (
                    <div className="absolute top-2 left-2 right-2 text-center z-10">
                      <div className={cn(
                        "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg",
                        lastCode.includes("❌") ? "bg-red-900/80" : "bg-green-900/80"
                      )}>
                        {!lastCode.includes("❌") && <Check className="w-4 h-4 text-green-400" />}
                        <span className="text-white font-mono text-sm">
                          {lastCode.replace(" ❌", "")}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Progress bar */}
                  <div className="absolute bottom-12 left-4 right-4 z-10">
                    <div className="h-1.5 bg-black/50 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 transition-all duration-150"
                        style={{ width: `${scanProgress}%` }}
                      />
                    </div>
                  </div>

                  {/* Manual entry button */}
                  <div className="absolute bottom-2 left-0 right-0 flex justify-center z-10">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={switchToManual}
                      className="bg-black/60 border-white/30 text-white"
                    >
                      <Keyboard className="w-4 h-4 mr-1" />
                      Type Code
                    </Button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="p-4 space-y-4">
              <p className="text-sm text-white/60">Enter barcode manually:</p>
              <Input
                value={manualBarcode}
                onChange={(e) => {
                  setManualBarcode(e.target.value);
                  setManualError(null);
                }}
                placeholder="8717163004869"
                className={cn(
                  themeClasses.inputBg,
                  "border-white/10 text-white text-lg font-mono text-center",
                  manualError && "border-red-500"
                )}
                autoFocus
                inputMode="numeric"
                onKeyDown={(e) => e.key === "Enter" && handleManualSubmit()}
              />
              {manualError && (
                <p className="text-red-400 text-sm text-center">{manualError}</p>
              )}
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={switchToCamera}>
                  <Camera className="w-4 h-4 mr-2" />
                  Camera
                </Button>
                <Button className="flex-1" onClick={handleManualSubmit} disabled={!manualBarcode.trim()}>
                  Use Code
                </Button>
              </div>
            </div>
          )}
        </div>

        {!manualEntry && !error && isScanning && (
          <div className="px-4 py-2 border-t border-white/10 text-xs text-white/40 text-center">
            Hold steady • Good lighting helps • Uses ZXing decoder
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
