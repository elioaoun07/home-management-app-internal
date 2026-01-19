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
  FlashlightOff,
  Flashlight,
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

// Require barcode to be read this many times consistently before accepting
const REQUIRED_CONSISTENT_READS = 3;
// Interval between detection attempts (ms)
const DETECTION_INTERVAL_MS = 100;

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

  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [lastDetectedCode, setLastDetectedCode] = useState<string | null>(null);

  // Track consistent reads for validation
  const consistentReadsRef = useRef<{ code: string; count: number }>({
    code: "",
    count: 0,
  });

  // Initialize camera with maximum quality settings
  const initCamera = useCallback(async () => {
    setIsInitializing(true);
    setError(null);
    setScanProgress(0);
    consistentReadsRef.current = { code: "", count: 0 };

    try {
      // Check if BarcodeDetector is available
      if (!("BarcodeDetector" in window)) {
        throw new Error(
          "Barcode scanning is not supported in this browser. Please use Chrome or Edge."
        );
      }

      // Create barcode detector once
      // @ts-expect-error - BarcodeDetector is not yet in TypeScript types
      detectorRef.current = new BarcodeDetector({
        formats: [
          "ean_13",
          "ean_8",
          "upc_a",
          "upc_e",
          "code_128",
          "code_39",
          "codabar",
          "itf",
        ],
      });

      // Request camera with HIGH QUALITY settings
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          // Request maximum resolution for better barcode reading
          width: { ideal: 1920, min: 1280 },
          height: { ideal: 1080, min: 720 },
          // Better frame rate for smoother scanning
          frameRate: { ideal: 30, min: 15 },
        },
      });

      streamRef.current = stream;
      setHasPermission(true);

      // Check if torch is available and apply advanced constraints
      const videoTrack = stream.getVideoTracks()[0];
      const capabilities = videoTrack.getCapabilities?.() as Record<string, unknown>;
      
      if (capabilities?.torch) {
        setHasTorch(true);
      }

      // Apply additional track constraints for best quality
      try {
        await videoTrack.applyConstraints({
          // @ts-expect-error - Advanced constraints not in standard types
          focusMode: "continuous",
          exposureMode: "continuous",
          whiteBalanceMode: "continuous",
        });
      } catch {
        // Some devices don't support these constraints, that's ok
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Wait for video to be ready
        await new Promise<void>((resolve) => {
          if (videoRef.current) {
            videoRef.current.onloadedmetadata = () => {
              resolve();
            };
          }
        });
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

  // Toggle torch/flashlight
  const toggleTorch = useCallback(async () => {
    if (!streamRef.current) return;

    const videoTrack = streamRef.current.getVideoTracks()[0];
    try {
      await videoTrack.applyConstraints({
        // @ts-expect-error - torch not in standard constraint types
        advanced: [{ torch: !torchOn }],
      });
      setTorchOn(!torchOn);
    } catch (err) {
      console.error("Failed to toggle torch:", err);
    }
  }, [torchOn]);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    detectorRef.current = null;
    setIsScanning(false);
    setTorchOn(false);
    setScanProgress(0);
  }, []);

  // Barcode detection with validation
  const detectBarcode = useCallback(async () => {
    if (!videoRef.current || !detectorRef.current || !isScanning) return;

    try {
      const detector = detectorRef.current as {
        detect: (source: HTMLVideoElement) => Promise<
          Array<{
            rawValue: string;
            format: string;
            boundingBox: DOMRectReadOnly;
          }>
        >;
      };

      const barcodes = await detector.detect(videoRef.current);

      if (barcodes.length > 0) {
        // Get the barcode with the largest bounding box (most prominent/clearest)
        const barcode = barcodes.reduce((best, current) => {
          const bestArea = best.boundingBox.width * best.boundingBox.height;
          const currentArea =
            current.boundingBox.width * current.boundingBox.height;
          return currentArea > bestArea ? current : best;
        });

        const code = barcode.rawValue;
        setLastDetectedCode(code);

        // Validate: require consistent reads of the SAME code
        if (consistentReadsRef.current.code === code) {
          consistentReadsRef.current.count++;
          setScanProgress(
            Math.min(
              100,
              (consistentReadsRef.current.count / REQUIRED_CONSISTENT_READS) *
                100
            )
          );
        } else {
          // Different code detected, reset counter
          consistentReadsRef.current = { code, count: 1 };
          setScanProgress((1 / REQUIRED_CONSISTENT_READS) * 100);
        }

        // Accept barcode only after consistent reads
        if (consistentReadsRef.current.count >= REQUIRED_CONSISTENT_READS) {
          // Map format to our type
          const formatMap: Record<string, BarcodeScanResult["format"]> = {
            ean_13: "EAN_13",
            ean_8: "EAN_8",
            upc_a: "UPC_A",
            upc_e: "UPC_E",
            code_128: "CODE_128",
            code_39: "CODE_39",
            codabar: "CODE_128",
            itf: "CODE_128",
          };

          const result: BarcodeScanResult = {
            barcode: code,
            format: formatMap[barcode.format] || "unknown",
            timestamp: new Date().toISOString(),
          };

          // Vibrate on successful scan (double vibrate for confirmation)
          if (navigator.vibrate) {
            navigator.vibrate([100, 50, 100]);
          }

          onScan(result);
          stopCamera();
          onOpenChange(false);
        }
      } else {
        // No barcode found, slowly decay progress
        if (consistentReadsRef.current.count > 0) {
          consistentReadsRef.current.count = Math.max(
            0,
            consistentReadsRef.current.count - 0.5
          );
          setScanProgress(
            (consistentReadsRef.current.count / REQUIRED_CONSISTENT_READS) * 100
          );
        }
      }
    } catch {
      // Detection failed, continue scanning
    }
  }, [isScanning, onScan, onOpenChange, stopCamera]);

  // Start detection interval when scanning begins
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

  // Initialize camera when dialog opens
  useEffect(() => {
    if (open) {
      initCamera();
    } else {
      stopCamera();
      setLastDetectedCode(null);
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

  // Reset to camera mode
  const resetToCamera = () => {
    setManualEntry(false);
    setManualBarcode("");
    setError(null);
    initCamera();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "sm:max-w-lg p-0 overflow-hidden",
          themeClasses.cardBg,
          themeClasses.border
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
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white/60 z-10">
                  <Loader2 className="w-8 h-8 animate-spin mb-2" />
                  <span>Starting camera...</span>
                </div>
              )}

              {error && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center z-10">
                  <AlertCircle className="w-12 h-12 text-red-400 mb-3" />
                  <p className="text-white/80 text-sm mb-4">{error}</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={initCamera}>
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Retry
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setManualEntry(true)}
                    >
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

              {/* Scanning overlay */}
              {isScanning && !error && (
                <>
                  {/* Dimmed corners with clear center */}
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute inset-0 bg-black/30" />
                    <div className="absolute top-1/4 left-[10%] right-[10%] bottom-1/4 bg-transparent border-2 border-white/70 rounded-lg overflow-hidden"
                      style={{ boxShadow: "0 0 0 9999px rgba(0,0,0,0.3)" }}>
                      {/* Animated scan line */}
                      <div
                        className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-green-400 to-transparent animate-scan"
                        style={{
                          boxShadow: "0 0 15px 3px rgba(74, 222, 128, 0.6)",
                        }}
                      />
                    </div>
                  </div>

                  {/* Progress bar at bottom */}
                  <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/50">
                    <div
                      className="h-full bg-green-500 transition-all duration-100"
                      style={{ width: `${scanProgress}%` }}
                    />
                  </div>

                  {/* Detected code preview */}
                  {lastDetectedCode && (
                    <div className="absolute top-4 left-4 right-4 text-center">
                      <div className="inline-block px-3 py-1.5 rounded-lg bg-black/70 backdrop-blur">
                        <span className="text-xs text-white/60">
                          Reading:{" "}
                        </span>
                        <span className="text-white font-mono text-lg">
                          {lastDetectedCode}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Controls overlay */}
                  <div className="absolute bottom-6 left-4 right-4 flex justify-center gap-3">
                    {hasTorch && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={toggleTorch}
                        className={cn(
                          "bg-black/50 border-white/30 text-white hover:bg-black/70",
                          torchOn && "bg-yellow-500/30 border-yellow-400"
                        )}
                      >
                        {torchOn ? (
                          <Flashlight className="w-4 h-4" />
                        ) : (
                          <FlashlightOff className="w-4 h-4" />
                        )}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setManualEntry(true)}
                      className="bg-black/50 border-white/30 text-white hover:bg-black/70"
                    >
                      <Keyboard className="w-4 h-4 mr-2" />
                      Type Code
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Manual Entry */}
          {manualEntry && (
            <div className="p-4 space-y-4">
              <p className="text-sm text-white/60">
                Enter the barcode number manually:
              </p>
              <Input
                value={manualBarcode}
                onChange={(e) => setManualBarcode(e.target.value)}
                placeholder="e.g., 8717163004869"
                className={cn(
                  themeClasses.inputBg,
                  "border-white/10 text-white text-lg font-mono tracking-wider text-center"
                )}
                autoFocus
                inputMode="numeric"
                pattern="[0-9]*"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleManualSubmit();
                  }
                }}
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={resetToCamera}
                >
                  <Camera className="w-4 h-4 mr-2" />
                  Back to Camera
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleManualSubmit}
                  disabled={!manualBarcode.trim()}
                >
                  Use This Code
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Tips */}
        {!manualEntry && !error && (
          <div className="p-4 pt-2 border-t border-white/10">
            <div className="flex items-start gap-2 text-xs text-white/50">
              <ScanLine className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p>
                  Hold barcode steady within the frame. Ensure good lighting.
                </p>
                {scanProgress > 0 && scanProgress < 100 && (
                  <p className="text-green-400 mt-1">
                    Verifying... ({Math.round(scanProgress)}%)
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
