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
  Flashlight,
  FlashlightOff,
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

// All barcode formats supported by BarcodeDetector API
const ALL_BARCODE_FORMATS = [
  "aztec",
  "codabar",
  "code_128",
  "code_39",
  "code_93",
  "data_matrix",
  "ean_13",
  "ean_8",
  "itf",
  "pdf417",
  "qr_code",
  "upc_a",
  "upc_e",
] as const;

// Require consistent reads for validation
const REQUIRED_CONSISTENT_READS = 3;
const DETECTION_INTERVAL_MS = 80; // Faster detection

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
  const [resolution, setResolution] = useState("");

  // Track consistent reads
  const consistentReadsRef = useRef<{ code: string; count: number }>({
    code: "",
    count: 0,
  });

  // Get supported formats
  const getSupportedFormats = useCallback(async () => {
    try {
      // @ts-expect-error - BarcodeDetector not in types
      const supported = await BarcodeDetector.getSupportedFormats();
      return supported as string[];
    } catch {
      return [...ALL_BARCODE_FORMATS] as string[];
    }
  }, []);

  // Initialize camera with optimal settings
  const initCamera = useCallback(async () => {
    setIsInitializing(true);
    setError(null);
    setScanProgress(0);
    consistentReadsRef.current = { code: "", count: 0 };

    try {
      if (!("BarcodeDetector" in window)) {
        throw new Error(
          "Barcode scanning not supported. Use Chrome or Edge browser."
        );
      }

      // Get supported formats and create detector
      const formats = await getSupportedFormats();
      // @ts-expect-error - BarcodeDetector not in types
      detectorRef.current = new BarcodeDetector({ formats });

      // Get available cameras and prefer back camera with highest resolution
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((d) => d.kind === "videoinput");
      
      // Try to find back camera
      const backCamera = videoDevices.find(
        (d) => d.label.toLowerCase().includes("back") || 
               d.label.toLowerCase().includes("rear") ||
               d.label.toLowerCase().includes("environment")
      );

      // Request camera with maximum quality - let browser pick best resolution
      const constraints: MediaStreamConstraints = {
        video: {
          deviceId: backCamera?.deviceId ? { exact: backCamera.deviceId } : undefined,
          facingMode: backCamera ? undefined : { ideal: "environment" },
          // Request max resolution - browser will give best available
          width: { ideal: 4096 },
          height: { ideal: 2160 },
          frameRate: { ideal: 30, min: 15 },
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      const videoTrack = stream.getVideoTracks()[0];
      trackRef.current = videoTrack;

      // Get actual resolution
      const settings = videoTrack.getSettings();
      setResolution(`${settings.width}x${settings.height}`);

      // Check capabilities and apply optimal constraints
      const capabilities = videoTrack.getCapabilities?.() as Record<string, unknown> | undefined;
      
      if (capabilities?.torch) {
        setHasTorch(true);
      }

      // Apply continuous autofocus and other optimizations
      const advancedConstraints: MediaTrackConstraints = {};
      
      if (capabilities?.focusMode && (capabilities.focusMode as string[]).includes("continuous")) {
        // @ts-expect-error - advanced constraints
        advancedConstraints.focusMode = "continuous";
      }
      if (capabilities?.exposureMode && (capabilities.exposureMode as string[]).includes("continuous")) {
        // @ts-expect-error - advanced constraints
        advancedConstraints.exposureMode = "continuous";
      }
      if (capabilities?.whiteBalanceMode && (capabilities.whiteBalanceMode as string[]).includes("continuous")) {
        // @ts-expect-error - advanced constraints
        advancedConstraints.whiteBalanceMode = "continuous";
      }

      if (Object.keys(advancedConstraints).length > 0) {
        try {
          await videoTrack.applyConstraints(advancedConstraints);
        } catch {
          // Device doesn't support these constraints
        }
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await new Promise<void>((resolve) => {
          if (videoRef.current) {
            videoRef.current.onloadedmetadata = () => resolve();
          }
        });
        await videoRef.current.play();
        setIsScanning(true);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to access camera";
      setError(message);
      onError?.(message);
    } finally {
      setIsInitializing(false);
    }
  }, [onError, getSupportedFormats]);

  // Toggle torch
  const toggleTorch = useCallback(async () => {
    if (!trackRef.current) return;
    try {
      await trackRef.current.applyConstraints({
        // @ts-expect-error - torch constraint
        advanced: [{ torch: !torchOn }],
      });
      setTorchOn(!torchOn);
    } catch (err) {
      console.error("Torch toggle failed:", err);
    }
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
  }, []);

  // Format barcode type for display
  const formatBarcodeType = (format: string): BarcodeScanResult["format"] => {
    const map: Record<string, BarcodeScanResult["format"]> = {
      ean_13: "EAN_13",
      ean_8: "EAN_8",
      upc_a: "UPC_A",
      upc_e: "UPC_E",
      code_128: "CODE_128",
      code_39: "CODE_39",
      code_93: "CODE_128",
      codabar: "CODE_128",
      itf: "CODE_128",
      aztec: "QR_CODE",
      data_matrix: "QR_CODE",
      pdf417: "CODE_128",
      qr_code: "QR_CODE",
    };
    return map[format] || "unknown";
  };

  // Detect barcodes
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
        // Pick largest/clearest barcode
        const barcode = barcodes.reduce((best, curr) => {
          const bestArea = best.boundingBox.width * best.boundingBox.height;
          const currArea = curr.boundingBox.width * curr.boundingBox.height;
          return currArea > bestArea ? curr : best;
        });

        const code = barcode.rawValue;
        setLastDetectedCode(code);

        // Validate with consistent reads
        if (consistentReadsRef.current.code === code) {
          consistentReadsRef.current.count++;
        } else {
          consistentReadsRef.current = { code, count: 1 };
        }

        setScanProgress(
          Math.min(100, (consistentReadsRef.current.count / REQUIRED_CONSISTENT_READS) * 100)
        );

        if (consistentReadsRef.current.count >= REQUIRED_CONSISTENT_READS) {
          // Success!
          if (navigator.vibrate) navigator.vibrate([100, 50, 100]);

          onScan({
            barcode: code,
            format: formatBarcodeType(barcode.format),
            timestamp: new Date().toISOString(),
          });
          stopCamera();
          onOpenChange(false);
        }
      } else {
        // Decay progress slowly
        if (consistentReadsRef.current.count > 0) {
          consistentReadsRef.current.count = Math.max(0, consistentReadsRef.current.count - 0.3);
          setScanProgress(
            (consistentReadsRef.current.count / REQUIRED_CONSISTENT_READS) * 100
          );
        }
      }
    } catch {
      // Continue scanning
    }
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

  // Open/close handling
  useEffect(() => {
    if (open) {
      initCamera();
    } else {
      stopCamera();
      setLastDetectedCode(null);
    }
    return () => stopCamera();
  }, [open, initCamera, stopCamera]);

  // Manual entry state
  const [manualEntry, setManualEntry] = useState(false);
  const [manualBarcode, setManualBarcode] = useState("");

  const handleManualSubmit = () => {
    if (manualBarcode.trim()) {
      onScan({
        barcode: manualBarcode.trim(),
        format: "unknown",
        timestamp: new Date().toISOString(),
      });
      onOpenChange(false);
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
                <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center z-10 bg-black/80">
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
                  {/* Scan area overlay */}
                  <div className="absolute inset-0 pointer-events-none">
                    <div
                      className="absolute top-[20%] left-[8%] right-[8%] bottom-[20%] border-2 border-white/80 rounded-lg"
                      style={{ boxShadow: "0 0 0 9999px rgba(0,0,0,0.4)" }}
                    >
                      <div
                        className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-green-400 to-transparent animate-scan"
                        style={{ boxShadow: "0 0 12px 2px rgba(74,222,128,0.7)" }}
                      />
                    </div>
                  </div>

                  {/* Progress */}
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/60">
                    <div
                      className="h-full bg-green-500 transition-all duration-75"
                      style={{ width: `${scanProgress}%` }}
                    />
                  </div>

                  {/* Code preview */}
                  {lastDetectedCode && (
                    <div className="absolute top-3 left-3 right-3 text-center">
                      <div className="inline-block px-3 py-1 rounded bg-black/70 backdrop-blur-sm">
                        <span className="text-white font-mono text-sm">{lastDetectedCode}</span>
                      </div>
                    </div>
                  )}

                  {/* Controls */}
                  <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
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
                onChange={(e) => setManualBarcode(e.target.value)}
                placeholder="8717163004869"
                className={cn(themeClasses.inputBg, "border-white/10 text-white text-lg font-mono text-center")}
                autoFocus
                inputMode="numeric"
                onKeyDown={(e) => e.key === "Enter" && handleManualSubmit()}
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
          <div className="px-4 py-2 border-t border-white/10 text-xs text-white/40">
            Supports: EAN-13, EAN-8, UPC-A/E, Code 128/39/93, ITF, Codabar, QR, DataMatrix
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
