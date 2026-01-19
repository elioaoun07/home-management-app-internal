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
  Flashlight,
  FlashlightOff,
  Keyboard,
  Loader2,
  RotateCcw,
  ScanLine,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

interface BarcodeScannerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (result: BarcodeScanResult) => void;
  onError?: (error: string) => void;
}

// ============================================================================
// BARCODE VALIDATION - Template-based with checksum verification
// ============================================================================

interface BarcodeTemplate {
  name: string;
  format: BarcodeScanResult["format"];
  length: number | number[];
  pattern: RegExp;
  validateChecksum?: (code: string) => boolean;
}

// EAN-13 checksum: sum odd positions * 1 + even positions * 3, mod 10 should = 0
const validateEAN13 = (code: string): boolean => {
  if (code.length !== 13 || !/^\d{13}$/.test(code)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(code[i]) * (i % 2 === 0 ? 1 : 3);
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === parseInt(code[12]);
};

// EAN-8 checksum: same algorithm as EAN-13
const validateEAN8 = (code: string): boolean => {
  if (code.length !== 8 || !/^\d{8}$/.test(code)) return false;
  let sum = 0;
  for (let i = 0; i < 7; i++) {
    sum += parseInt(code[i]) * (i % 2 === 0 ? 3 : 1);
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === parseInt(code[7]);
};

// UPC-A checksum (12 digits)
const validateUPCA = (code: string): boolean => {
  if (code.length !== 12 || !/^\d{12}$/.test(code)) return false;
  let sum = 0;
  for (let i = 0; i < 11; i++) {
    sum += parseInt(code[i]) * (i % 2 === 0 ? 3 : 1);
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === parseInt(code[11]);
};

// UPC-E checksum (8 digits including check)
const validateUPCE = (code: string): boolean => {
  if (code.length !== 8 || !/^\d{8}$/.test(code)) return false;
  // UPC-E is compressed UPC-A, validation is complex
  // For now, just check format
  return true;
};

const BARCODE_TEMPLATES: BarcodeTemplate[] = [
  {
    name: "EAN-13",
    format: "EAN_13",
    length: 13,
    pattern: /^\d{13}$/,
    validateChecksum: validateEAN13,
  },
  {
    name: "EAN-8",
    format: "EAN_8",
    length: 8,
    pattern: /^\d{8}$/,
    validateChecksum: validateEAN8,
  },
  {
    name: "UPC-A",
    format: "UPC_A",
    length: 12,
    pattern: /^\d{12}$/,
    validateChecksum: validateUPCA,
  },
  {
    name: "UPC-E",
    format: "UPC_E",
    length: 8,
    pattern: /^[01]\d{7}$/,
    validateChecksum: validateUPCE,
  },
  {
    name: "Code 128",
    format: "CODE_128",
    length: [1, 48],
    pattern: /^[\x00-\x7F]+$/,
  },
  {
    name: "Code 39",
    format: "CODE_39",
    length: [1, 48],
    pattern: /^[A-Z0-9\-. $/+%*]+$/,
  },
  {
    name: "ITF",
    format: "CODE_128",
    length: [2, 48],
    pattern: /^\d+$/,
  },
  {
    name: "Codabar",
    format: "CODE_128",
    length: [1, 48],
    pattern: /^[A-D][0-9\-$:/.+]+[A-D]$/i,
  },
];

// Validate barcode against templates
function validateBarcode(code: string, detectedFormat?: string): {
  valid: boolean;
  format: BarcodeScanResult["format"];
  template?: BarcodeTemplate;
  error?: string;
} {
  // Try to match against known templates
  for (const template of BARCODE_TEMPLATES) {
    const len = code.length;
    const lengthMatch = Array.isArray(template.length)
      ? len >= template.length[0] && len <= template.length[1]
      : len === template.length;

    if (lengthMatch && template.pattern.test(code)) {
      // Check checksum if available
      if (template.validateChecksum) {
        if (template.validateChecksum(code)) {
          return { valid: true, format: template.format, template };
        } else {
          // Checksum failed - might be misread
          return {
            valid: false,
            format: template.format,
            template,
            error: `${template.name} checksum invalid`,
          };
        }
      }
      return { valid: true, format: template.format, template };
    }
  }

  // No template matched - accept if it's numeric and reasonable length
  if (/^\d{8,14}$/.test(code)) {
    return { valid: true, format: "unknown" };
  }

  return { valid: false, format: "unknown", error: "Unknown barcode format" };
}

// ============================================================================
// SCANNER COMPONENT
// ============================================================================

const REQUIRED_CONSISTENT_READS = 4; // Increased for accuracy
const DETECTION_INTERVAL_MS = 60; // Faster polling

export function BarcodeScanner({
  open,
  onOpenChange,
  onScan,
  onError,
}: BarcodeScannerProps) {
  const themeClasses = useThemeClasses();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<unknown>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);

  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [lastDetectedCode, setLastDetectedCode] = useState<string | null>(null);
  const [validationStatus, setValidationStatus] = useState<"valid" | "invalid" | null>(null);
  const [resolution, setResolution] = useState("");

  // Track reads with validation
  const readsRef = useRef<Map<string, number>>(new Map());

  // Initialize camera
  const initCamera = useCallback(async () => {
    setIsInitializing(true);
    setError(null);
    setScanProgress(0);
    setValidationStatus(null);
    readsRef.current.clear();

    try {
      if (!("BarcodeDetector" in window)) {
        throw new Error("Use Chrome or Edge browser for barcode scanning.");
      }

      // Get supported formats
      // @ts-expect-error - BarcodeDetector not in types
      const supportedFormats = await BarcodeDetector.getSupportedFormats();
      
      // @ts-expect-error - BarcodeDetector not in types
      detectorRef.current = new BarcodeDetector({
        formats: supportedFormats,
      });

      // Request highest quality camera
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { exact: "environment" },
          width: { min: 1280, ideal: 1920, max: 3840 },
          height: { min: 720, ideal: 1080, max: 2160 },
          frameRate: { min: 15, ideal: 30 },
          // @ts-expect-error - advanced constraints
          focusMode: "continuous",
          exposureMode: "continuous",
        },
      }).catch(() => {
        // Fallback if exact environment fails
        return navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "environment",
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        });
      });

      streamRef.current = stream;
      const videoTrack = stream.getVideoTracks()[0];
      trackRef.current = videoTrack;

      // Get and display resolution
      const settings = videoTrack.getSettings();
      setResolution(`${settings.width}×${settings.height}`);

      // Check torch capability
      const caps = videoTrack.getCapabilities?.() as Record<string, unknown> | undefined;
      if (caps?.torch) setHasTorch(true);

      // Apply optimal focus settings
      try {
        await videoTrack.applyConstraints({
          // @ts-expect-error - advanced constraints
          focusMode: "continuous",
          exposureMode: "continuous",
        });
      } catch {
        // Device may not support
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsScanning(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Camera access failed");
      onError?.(err instanceof Error ? err.message : "Camera error");
    } finally {
      setIsInitializing(false);
    }
  }, [onError]);

  // Toggle torch
  const toggleTorch = useCallback(async () => {
    if (!trackRef.current) return;
    try {
      await trackRef.current.applyConstraints({
        // @ts-expect-error - torch constraint
        advanced: [{ torch: !torchOn }],
      });
      setTorchOn(!torchOn);
    } catch {}
  }, [torchOn]);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    trackRef.current = null;
    detectorRef.current = null;
    setIsScanning(false);
    setTorchOn(false);
    setScanProgress(0);
    readsRef.current.clear();
  }, []);

  // Detect and validate barcodes
  const detectBarcode = useCallback(async () => {
    if (!videoRef.current || !detectorRef.current || !isScanning) return;

    try {
      const detector = detectorRef.current as {
        detect: (source: HTMLVideoElement) => Promise<
          Array<{ rawValue: string; format: string; boundingBox: DOMRectReadOnly }>
        >;
      };

      const barcodes = await detector.detect(videoRef.current);

      if (barcodes.length > 0) {
        // Get largest barcode (most prominent)
        const barcode = barcodes.reduce((best, curr) => {
          const bestArea = best.boundingBox.width * best.boundingBox.height;
          const currArea = curr.boundingBox.width * curr.boundingBox.height;
          return currArea > bestArea ? curr : best;
        });

        const code = barcode.rawValue;
        
        // Validate against templates
        const validation = validateBarcode(code, barcode.format);
        
        setLastDetectedCode(code);
        setValidationStatus(validation.valid ? "valid" : "invalid");

        if (validation.valid) {
          // Track valid reads
          const currentCount = readsRef.current.get(code) || 0;
          readsRef.current.set(code, currentCount + 1);

          // Clear other codes (we want consistency)
          for (const [key] of readsRef.current) {
            if (key !== code) readsRef.current.delete(key);
          }

          const count = readsRef.current.get(code) || 0;
          setScanProgress(Math.min(100, (count / REQUIRED_CONSISTENT_READS) * 100));

          if (count >= REQUIRED_CONSISTENT_READS) {
            // Success!
            if (navigator.vibrate) navigator.vibrate([100, 50, 100]);

            onScan({
              barcode: code,
              format: validation.format,
              timestamp: new Date().toISOString(),
            });
            stopCamera();
            onOpenChange(false);
          }
        } else {
          // Invalid checksum - reset progress
          readsRef.current.clear();
          setScanProgress(0);
        }
      } else {
        // No barcode - decay progress
        const codes = Array.from(readsRef.current.entries());
        if (codes.length > 0) {
          const [code, count] = codes[0];
          if (count > 0.5) {
            readsRef.current.set(code, count - 0.2);
            setScanProgress((count - 0.2) / REQUIRED_CONSISTENT_READS * 100);
          } else {
            readsRef.current.clear();
            setScanProgress(0);
          }
        }
      }
    } catch {}
  }, [isScanning, onScan, onOpenChange, stopCamera]);

  // Detection loop
  useEffect(() => {
    if (isScanning && !intervalRef.current) {
      intervalRef.current = setInterval(detectBarcode, DETECTION_INTERVAL_MS);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isScanning, detectBarcode]);

  // Open/close
  useEffect(() => {
    if (open) {
      initCamera();
    } else {
      stopCamera();
      setLastDetectedCode(null);
      setValidationStatus(null);
    }
    return () => stopCamera();
  }, [open, initCamera, stopCamera]);

  // Manual entry
  const [manualEntry, setManualEntry] = useState(false);
  const [manualBarcode, setManualBarcode] = useState("");
  const [manualError, setManualError] = useState<string | null>(null);

  const handleManualSubmit = () => {
    const code = manualBarcode.trim();
    if (!code) return;

    const validation = validateBarcode(code);
    if (validation.valid) {
      onScan({
        barcode: code,
        format: validation.format,
        timestamp: new Date().toISOString(),
      });
      onOpenChange(false);
    } else {
      setManualError(validation.error || "Invalid barcode");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn("sm:max-w-lg p-0 overflow-hidden", themeClasses.cardBg, themeClasses.border)}
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
            <div className="relative aspect-[4/3] bg-black overflow-hidden">
              {isInitializing && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white/60 z-10">
                  <Loader2 className="w-8 h-8 animate-spin mb-2" />
                  <span>Starting camera...</span>
                </div>
              )}

              {error && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center z-10 bg-black/90">
                  <AlertCircle className="w-12 h-12 text-red-400 mb-3" />
                  <p className="text-white/80 text-sm mb-4">{error}</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={initCamera}>
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Retry
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setManualEntry(true)}>
                      <Keyboard className="w-4 h-4 mr-2" />
                      Manual
                    </Button>
                  </div>
                </div>
              )}

              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                muted
                autoPlay
              />

              {isScanning && !error && (
                <>
                  {/* Scan area */}
                  <div className="absolute inset-0 pointer-events-none">
                    <div
                      className="absolute top-[20%] left-[5%] right-[5%] bottom-[20%] border-2 rounded-lg"
                      style={{
                        borderColor: validationStatus === "valid" ? "#22c55e" : 
                                    validationStatus === "invalid" ? "#ef4444" : "rgba(255,255,255,0.8)",
                        boxShadow: "0 0 0 9999px rgba(0,0,0,0.5)",
                      }}
                    >
                      <div
                        className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-green-400 to-transparent animate-scan"
                        style={{ boxShadow: "0 0 10px 2px rgba(74,222,128,0.6)" }}
                      />
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/60">
                    <div
                      className="h-full bg-green-500 transition-all duration-75"
                      style={{ width: `${scanProgress}%` }}
                    />
                  </div>

                  {/* Code preview with validation status */}
                  {lastDetectedCode && (
                    <div className="absolute top-3 left-3 right-3 text-center">
                      <div className={cn(
                        "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg backdrop-blur-sm",
                        validationStatus === "valid" ? "bg-green-900/70" :
                        validationStatus === "invalid" ? "bg-red-900/70" : "bg-black/70"
                      )}>
                        {validationStatus === "valid" && <Check className="w-4 h-4 text-green-400" />}
                        {validationStatus === "invalid" && <X className="w-4 h-4 text-red-400" />}
                        <span className="text-white font-mono text-sm">{lastDetectedCode}</span>
                      </div>
                    </div>
                  )}

                  {/* Controls */}
                  <div className="absolute bottom-5 left-0 right-0 flex justify-center gap-2">
                    {hasTorch && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={toggleTorch}
                        className={cn(
                          "bg-black/50 border-white/30 text-white",
                          torchOn && "bg-yellow-500/30 border-yellow-400"
                        )}
                      >
                        {torchOn ? <Flashlight className="w-4 h-4" /> : <FlashlightOff className="w-4 h-4" />}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setManualEntry(true)}
                      className="bg-black/50 border-white/30 text-white"
                    >
                      <Keyboard className="w-4 h-4 mr-1" />
                      Type
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
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setManualEntry(false);
                    setManualBarcode("");
                    setManualError(null);
                    initCamera();
                  }}
                >
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

        {!manualEntry && !error && (
          <div className="px-4 py-2 border-t border-white/10 text-xs text-white/40 text-center">
            EAN-13/8 • UPC-A/E • Code 128/39 • ITF • QR
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
