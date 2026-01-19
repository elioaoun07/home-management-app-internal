// src/components/inventory/BarcodeScanner.tsx
"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import type { BarcodeScanResult } from "@/types/inventory";
import { AlertCircle, Camera, Loader2, ScanLine, X, Zap } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

interface BarcodeScannerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (result: BarcodeScanResult) => void;
  onError?: (error: string) => void;
}

export function BarcodeScanner({
  open,
  onOpenChange,
  onScan,
  onError,
}: BarcodeScannerProps) {
  const themeClasses = useThemeClasses();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number | null>(null);

  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);

  // Initialize camera
  const initCamera = useCallback(async () => {
    setIsInitializing(true);
    setError(null);

    try {
      // Check if BarcodeDetector is available (Chrome 83+, Edge 83+)
      if (!("BarcodeDetector" in window)) {
        throw new Error(
          "Barcode scanning is not supported in this browser. Please use Chrome or Edge.",
        );
      }

      // Request camera permission
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment", // Prefer back camera
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      streamRef.current = stream;
      setHasPermission(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsScanning(true);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to access camera";
      setError(message);
      setHasPermission(false);
      onError?.(message);
    } finally {
      setIsInitializing(false);
    }
  }, [onError]);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    setIsScanning(false);
  }, []);

  // Barcode detection loop
  const detectBarcode = useCallback(async () => {
    if (!videoRef.current || !isScanning) return;

    try {
      // @ts-expect-error - BarcodeDetector is not yet in TypeScript types
      const barcodeDetector = new BarcodeDetector({
        formats: [
          "ean_13",
          "ean_8",
          "upc_a",
          "upc_e",
          "code_128",
          "code_39",
          "qr_code",
        ],
      });

      const barcodes = await barcodeDetector.detect(videoRef.current);

      if (barcodes.length > 0) {
        const barcode = barcodes[0];

        // Debounce: don't scan same code within 2 seconds
        if (barcode.rawValue !== lastScannedCode) {
          setLastScannedCode(barcode.rawValue);

          // Map format to our type
          const formatMap: Record<string, BarcodeScanResult["format"]> = {
            ean_13: "EAN_13",
            ean_8: "EAN_8",
            upc_a: "UPC_A",
            upc_e: "UPC_E",
            code_128: "CODE_128",
            code_39: "CODE_39",
            qr_code: "QR_CODE",
          };

          const result: BarcodeScanResult = {
            barcode: barcode.rawValue,
            format: formatMap[barcode.format] || "unknown",
            timestamp: new Date().toISOString(),
          };

          // Vibrate on successful scan
          if (navigator.vibrate) {
            navigator.vibrate(100);
          }

          onScan(result);
          stopCamera();
          onOpenChange(false);
          return;
        }
      }
    } catch {
      // Detection failed, continue scanning
    }

    // Continue detection loop
    if (isScanning) {
      animationRef.current = requestAnimationFrame(detectBarcode);
    }
  }, [isScanning, lastScannedCode, onScan, onOpenChange, stopCamera]);

  // Start detection when scanning begins
  useEffect(() => {
    if (isScanning) {
      animationRef.current = requestAnimationFrame(detectBarcode);
    }
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isScanning, detectBarcode]);

  // Initialize camera when dialog opens
  useEffect(() => {
    if (open) {
      initCamera();
    } else {
      stopCamera();
      setLastScannedCode(null);
    }

    return () => {
      stopCamera();
    };
  }, [open, initCamera, stopCamera]);

  // Manual barcode entry fallback
  const [manualEntry, setManualEntry] = useState(false);
  const [manualBarcode, setManualBarcode] = useState("");

  const handleManualSubmit = () => {
    if (manualBarcode.trim()) {
      const result: BarcodeScanResult = {
        barcode: manualBarcode.trim(),
        format: "unknown",
        timestamp: new Date().toISOString(),
      };
      onScan(result);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "sm:max-w-md p-0 overflow-hidden",
          themeClasses.cardBg,
          themeClasses.border,
        )}
      >
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="flex items-center gap-2 text-white">
            <ScanLine className="w-5 h-5" />
            Scan Barcode
          </DialogTitle>
        </DialogHeader>

        <div className="relative">
          {/* Camera View */}
          {!manualEntry && (
            <div className="relative aspect-[4/3] bg-black overflow-hidden">
              {isInitializing && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white/60">
                  <Loader2 className="w-8 h-8 animate-spin mb-2" />
                  <span>Starting camera...</span>
                </div>
              )}

              {error && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
                  <AlertCircle className="w-12 h-12 text-red-400 mb-3" />
                  <p className="text-white/80 text-sm mb-4">{error}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setManualEntry(true)}
                  >
                    Enter manually
                  </Button>
                </div>
              )}

              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                muted
              />

              {/* Scanning overlay */}
              {isScanning && (
                <div className="absolute inset-0 pointer-events-none">
                  {/* Dimmed corners */}
                  <div className="absolute inset-0 bg-black/40" />

                  {/* Scanning area */}
                  <div className="absolute inset-8 border-2 border-white/60 rounded-lg">
                    {/* Animated scan line */}
                    <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent animate-scan" />

                    {/* Corner markers */}
                    <div className="absolute -top-0.5 -left-0.5 w-6 h-6 border-t-2 border-l-2 border-primary rounded-tl" />
                    <div className="absolute -top-0.5 -right-0.5 w-6 h-6 border-t-2 border-r-2 border-primary rounded-tr" />
                    <div className="absolute -bottom-0.5 -left-0.5 w-6 h-6 border-b-2 border-l-2 border-primary rounded-bl" />
                    <div className="absolute -bottom-0.5 -right-0.5 w-6 h-6 border-b-2 border-r-2 border-primary rounded-br" />
                  </div>

                  {/* Instructions */}
                  <div className="absolute bottom-4 inset-x-0 text-center">
                    <span className="text-white/80 text-sm bg-black/50 px-3 py-1 rounded-full">
                      Point camera at barcode
                    </span>
                  </div>
                </div>
              )}

              {/* Hidden canvas for processing */}
              <canvas ref={canvasRef} className="hidden" />
            </div>
          )}

          {/* Manual Entry */}
          {manualEntry && (
            <div className="p-4 space-y-4">
              <p className="text-white/60 text-sm">
                Enter the barcode number manually:
              </p>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={manualBarcode}
                onChange={(e) => setManualBarcode(e.target.value)}
                placeholder="e.g., 5285000328841"
                className={cn(
                  "w-full px-3 py-2 rounded-lg text-center text-lg font-mono tracking-wider",
                  themeClasses.inputBg,
                  "border border-white/10 text-white placeholder:text-white/40",
                )}
                autoFocus
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setManualEntry(false);
                    setManualBarcode("");
                    initCamera();
                  }}
                >
                  <Camera className="w-4 h-4 mr-2" />
                  Use camera
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleManualSubmit}
                  disabled={!manualBarcode.trim()}
                >
                  <Zap className="w-4 h-4 mr-2" />
                  Continue
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        {!manualEntry && !error && (
          <div className="p-4 flex justify-between items-center border-t border-white/10">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setManualEntry(true)}
              className="text-white/60"
            >
              Enter manually
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-white/60"
            >
              <X className="w-4 h-4 mr-1" />
              Cancel
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Add CSS for scan animation
// Add this to your global CSS:
/*
@keyframes scan {
  0% { top: 0; }
  50% { top: calc(100% - 2px); }
  100% { top: 0; }
}
.animate-scan {
  animation: scan 2s ease-in-out infinite;
}
*/
