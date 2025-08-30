"use client";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

import { Camera, CameraOff, RotateCcw, Settings } from "lucide-react";

interface WebcamProps {
  onCapture?: (imageData: string) => void;
  isUploading?: boolean;
}

interface CameraDevice {
  deviceId: string;
  label: string;
}

export default function Webcam({ onCapture, isUploading = false }: WebcamProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string>("");
  const [capturedImage, setCapturedImage] = useState<string>("");
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const [showCameraSelect, setShowCameraSelect] = useState(false);

  // Enumerate available cameras
  const enumerateCameras = useCallback(async () => {
    try {
      // Request permission first to get camera labels
      await navigator.mediaDevices.getUserMedia({ video: true, audio: false });

      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices
        .filter((device) => device.kind === "videoinput")
        .map((device) => ({
          deviceId: device.deviceId,
          label: device.label || `Camera ${device.deviceId.slice(0, 8)}`,
        }));

      setCameras(videoDevices);

      // Set default camera if none selected
      if (videoDevices.length > 0 && !selectedCameraId) {
        setSelectedCameraId(videoDevices[0].deviceId);
      }
    } catch (err) {
      console.error("Error enumerating cameras:", err);
      setError("Unable to access camera devices.");
    }
  }, [selectedCameraId]);

  const startCamera = useCallback(
    async (deviceId?: string) => {
      try {
        setError("");

        const constraints: MediaStreamConstraints = {
          video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: "user" },
          audio: false,
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          streamRef.current = stream;
          setIsActive(true);
        }
      } catch (err) {
        console.error("Error accessing camera:", err);
        setError("Unable to access camera. Please check permissions.");
      }
    },
    [videoRef]
  );

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsActive(false);
    setCapturedImage(""); // Clear captured image when stopping camera
    setError("");
  }, [videoRef]);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    if (!context) return;

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw the current video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert to data URL
    const imageData = canvas.toDataURL("image/jpeg", 0.8);
    setCapturedImage(imageData);

    if (onCapture) {
      onCapture(imageData);
    }
  }, [videoRef, canvasRef, onCapture]);

  const retakePhoto = useCallback(() => {
    setCapturedImage("");
    // Always restart the camera to ensure fresh stream
    if (isActive) {
      stopCamera();
    }
    startCamera(selectedCameraId);
  }, [isActive, selectedCameraId, startCamera, stopCamera]);

  const switchCamera = useCallback(
    (deviceId: string) => {
      setSelectedCameraId(deviceId);
      if (isActive) {
        stopCamera();
        startCamera(deviceId);
      }
    },
    [isActive, startCamera, stopCamera]
  );

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // Enumerate cameras on mount
  useEffect(() => {
    enumerateCameras();
  }, [enumerateCameras]);

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-destructive/10 border border-destructive text-destructive text-sm p-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="bg-muted rounded-lg p-4 border border-border">
        {!capturedImage ? (
          <div className="relative">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full rounded-lg border border-accent ${isActive ? "block" : "hidden"}`}
              style={{ aspectRatio: "4/3" }}
            />
            {!isActive && (
              <div
                className="w-full bg-card border border-border rounded-lg flex items-center justify-center"
                style={{ aspectRatio: "4/3", minHeight: "240px" }}
              >
                <div className="text-center text-muted-foreground">
                  <CameraOff className="w-16 h-16 mx-auto mb-3 text-accent" />
                  <p className="text-lg font-medium">Camera is off</p>
                  <p className="text-sm">Click &quot;Start Camera&quot; to begin</p>
                </div>
              </div>
            )}
            {isUploading && (
              <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                <div className="text-center text-white">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
                  <p className="text-sm font-medium">Uploading...</p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="relative">
            <Image
              src={capturedImage}
              alt="Captured"
              width={400}
              height={300}
              className="w-full rounded-lg border border-accent"
              style={{ aspectRatio: "4/3" }}
            />
            <div className="absolute top-2 right-2 bg-accent text-accent-foreground px-2 py-1 rounded text-xs font-medium">
              Captured
            </div>
          </div>
        )}

        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* Camera Selection UI */}
      {cameras.length > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            onClick={() => setShowCameraSelect(!showCameraSelect)}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <Settings className="w-4 h-4" />
            Camera Settings
          </Button>
        </div>
      )}

      {showCameraSelect && cameras.length > 1 && (
        <div className="flex items-center justify-center gap-2">
          <label className="text-sm font-medium text-muted-foreground">Select Camera:</label>
          <Select value={selectedCameraId} onValueChange={switchCamera}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Choose camera" />
            </SelectTrigger>
            <SelectContent>
              {cameras.map((camera) => (
                <SelectItem key={camera.deviceId} value={camera.deviceId}>
                  {camera.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex justify-center gap-3">
        {!isActive && !capturedImage && (
          <Button
            onClick={() => startCamera(selectedCameraId)}
            size="sm"
            className="flex items-center gap-2 px-6 py-3"
          >
            <Camera className="w-4 h-4" />
            Start Camera
          </Button>
        )}

        {isActive && !capturedImage && (
          <>
            <Button onClick={capturePhoto} className="btn-primary px-6 py-3" disabled={isUploading}>
              {isUploading ? "📤 Uploading..." : "📸 Capture Photo"}
            </Button>
            <Button
              onClick={stopCamera}
              className="bg-muted hover:bg-muted/80 text-muted-foreground border border-border px-6 py-3"
              disabled={isUploading}
            >
              ⏹️ Stop Camera
            </Button>
          </>
        )}

        {capturedImage && (
          <>
            <Button
              onClick={retakePhoto}
              className="bg-muted hover:bg-muted/80 text-muted-foreground border border-border flex items-center gap-2 px-6 py-3"
            >
              <RotateCcw className="w-4 h-4" />
              🔄 Retake
            </Button>
            <Button
              onClick={stopCamera}
              className="bg-muted hover:bg-muted/80 text-muted-foreground border border-border px-6 py-3"
            >
              ⏹️ Stop Camera
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
