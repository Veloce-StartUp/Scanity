"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Camera, CameraOff, Flashlight, FlashlightOff, RotateCcw, Scan, AlertTriangle } from "lucide-react"
import { useToast } from "@/components/ui/toast-provider"
import jsQR from "jsqr"

interface QRScannerProps {
  onScan: (result: string) => void
  onError?: (error: string) => void
  autoStart?: boolean
}

export function QRScanner({ onScan, onError, autoStart = false }: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [cameraState, setCameraState] = useState<"idle" | "requesting" | "granted" | "denied" | "unavailable">("idle")
  const [error, setError] = useState<string | null>(null)
  const [flashEnabled, setFlashEnabled] = useState(false)
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment")
  const streamRef = useRef<MediaStream | null>(null)
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const { success, error: showError, warning, info } = useToast()

  const checkCameraAvailability = async (): Promise<boolean> => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.log("[v0] Camera API not supported")
        return false
      }

      const devices = await navigator.mediaDevices.enumerateDevices()
      const videoDevices = devices.filter((device) => device.kind === "videoinput")
      console.log("[v0] Video devices found:", videoDevices.length)

      return videoDevices.length > 0
    } catch (err) {
      console.log("[v0] Error checking camera availability:", err)
      return false
    }
  }

  const startCamera = async () => {
    try {
      setError(null)
      setCameraState("requesting")
      console.log("[v0] Starting camera request...")

      const isAvailable = await checkCameraAvailability()
      if (!isAvailable) {
        throw new Error("No camera devices found on this device")
      }

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      }

      console.log("[v0] Requesting camera with constraints:", constraints)
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      console.log("[v0] Camera stream obtained successfully")
      console.log("[v0] Stream active:", stream.active)
      console.log("[v0] Stream tracks:", stream.getTracks().length)

      streamRef.current = stream

      const waitForVideoElement = async (): Promise<HTMLVideoElement> => {
        return new Promise((resolve, reject) => {
          const maxAttempts = 50 // 5 seconds max wait
          let attempts = 0

          const checkVideoElement = () => {
            attempts++
            console.log(`[v0] Checking for video element, attempt ${attempts}`)

            if (videoRef.current) {
              console.log("[v0] Video element found!")
              resolve(videoRef.current)
            } else if (attempts >= maxAttempts) {
              reject(new Error("Video element not available after waiting"))
            } else {
              setTimeout(checkVideoElement, 100)
            }
          }

          checkVideoElement()
        })
      }

      // Set camera state to granted first so video element gets rendered
      setCameraState("granted")

      // Wait a bit for React to re-render with the video element
      await new Promise((resolve) => setTimeout(resolve, 100))

      const videoElement = await waitForVideoElement()

      console.log("[v0] Assigning stream to video element")
      videoElement.srcObject = stream
      videoElement.playsInline = true
      videoElement.muted = true
      videoElement.autoplay = true

      await new Promise<void>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          console.log("[v0] Video loading timeout")
          reject(new Error("Video loading timeout"))
        }, 15000)

        const onLoadedMetadata = () => {
          console.log("[v0] Video metadata loaded")
          console.log("[v0] Video dimensions:", videoElement.videoWidth, "x", videoElement.videoHeight)
          clearTimeout(timeoutId)

          videoElement
            .play()
            .then(() => {
              console.log("[v0] Video playback started successfully")
              console.log("[v0] Video current time:", videoElement.currentTime)
              console.log("[v0] Video ready state:", videoElement.readyState)
              setIsScanning(true)
              startScanning()
              success("Camera is now active and ready to scan QR codes", "Camera Ready")
              resolve()
            })
            .catch((playError) => {
              console.error("[v0] Video play error:", playError)
              reject(playError)
            })
        }

        const onError = (videoError: any) => {
          console.error("[v0] Video loading error:", videoError)
          clearTimeout(timeoutId)
          reject(new Error("Video loading failed"))
        }

        videoElement.addEventListener("loadedmetadata", onLoadedMetadata, { once: true })
        videoElement.addEventListener("error", onError, { once: true })

        videoElement.addEventListener("loadstart", () => console.log("[v0] Video load start"))
        videoElement.addEventListener("loadeddata", () => console.log("[v0] Video data loaded"))
        videoElement.addEventListener("canplay", () => console.log("[v0] Video can play"))
        videoElement.addEventListener("canplaythrough", () => console.log("[v0] Video can play through"))
      })
    } catch (err) {
      console.error("[v0] Camera access error:", err)

      let errorMessage = "Failed to access camera"
      let newState: typeof cameraState = "denied"

      if (err instanceof Error) {
        if (err.name === "NotAllowedError" || err.message.includes("Permission denied")) {
          errorMessage = "Camera access was denied. Please click 'Allow' when prompted or check your browser settings."
          newState = "denied"
        } else if (err.name === "NotFoundError" || err.message.includes("No camera devices")) {
          errorMessage = "No camera found on this device. Please ensure a camera is connected."
          newState = "unavailable"
        } else if (err.name === "NotSupportedError") {
          errorMessage = "Camera is not supported in this browser or environment."
          newState = "unavailable"
        } else if (err.name === "NotReadableError") {
          errorMessage = "Camera is already in use by another application."
          newState = "denied"
        } else {
          errorMessage = err.message
        }
      }

      setError(errorMessage)
      onError?.(errorMessage)
      setCameraState(newState)
      setIsScanning(false)

      showError(errorMessage, "Camera Error")
    }
  }

  const stopCamera = () => {
    console.log("[v0] Stopping camera")
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        console.log("[v0] Stopping track:", track.kind)
        track.stop()
      })
      streamRef.current = null
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null
    }

    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current)
      scanIntervalRef.current = null
    }

    setIsScanning(false)
    setCameraState("idle")
  }

  const startScanning = () => {
    if (!videoRef.current || !canvasRef.current) return

    scanIntervalRef.current = setInterval(() => {
      const video = videoRef.current
      const canvas = canvasRef.current

      if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) return

      const context = canvas.getContext("2d")
      if (!context) return

      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      context.drawImage(video, 0, 0, canvas.width, canvas.height)

      const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
      const qrResult = jsQR(imageData.data, imageData.width, imageData.height)

      if (qrResult) {
        console.log("[v0] QR code detected:", qrResult.data)
        onScan(qrResult.data)
        setTimeout(() => {
          if (scanIntervalRef.current) {
            clearInterval(scanIntervalRef.current)
            startScanning()
          }
        }, 2000)
      }
    }, 100)
  }

  const toggleFlash = async () => {
    if (!streamRef.current) return

    try {
      const track = streamRef.current.getVideoTracks()[0]
      const capabilities = track.getCapabilities()

      if (capabilities.torch) {
        await track.applyConstraints({
          advanced: [{ torch: !flashEnabled } as any],
        })
        setFlashEnabled(!flashEnabled)
        info(`Flash has been ${flashEnabled ? "disabled" : "enabled"}`, flashEnabled ? "Flash Off" : "Flash On")
      } else {
        warning("Flash is not supported on this device", "Flash Not Available")
      }
    } catch (err) {
      console.warn("Flash not supported on this device")
      showError("Unable to control flash on this device", "Flash Error")
    }
  }

  const switchCamera = () => {
    console.log("[v0] Switching camera from", facingMode, "to", facingMode === "user" ? "environment" : "user")
    stopCamera()
    setFacingMode(facingMode === "user" ? "environment" : "user")
    info(`Switching to ${facingMode === "user" ? "rear" : "front"} camera`, "Switching Camera")
    setTimeout(() => startCamera(), 100)
  }

  useEffect(() => {
    if (autoStart) {
      startCamera()
    }

    return () => {
      stopCamera()
    }
  }, [autoStart])

  return (
    <div className="relative w-full max-w-lg mx-auto">
      <Card className="overflow-hidden glass border-0 shadow-2xl backdrop-blur-xl">
        <CardContent className="p-0">
          {error && (
            <Alert variant="destructive" className="m-4 glass-dark border-destructive/20">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-destructive-foreground">
                {error}
                {cameraState === "denied" && (
                  <div className="mt-2 text-xs">
                    <p>To fix this:</p>
                    <ul className="list-disc list-inside mt-1 space-y-1">
                      <li>Click the camera icon in your browser's address bar</li>
                      <li>Select "Allow" for camera access</li>
                      <li>Refresh the page if needed</li>
                    </ul>
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}

          <div className="relative aspect-square bg-gradient-to-br from-primary/5 to-secondary/5">
            {cameraState === "granted" ? (
              <>
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover rounded-t-xl"
                  playsInline
                  muted
                  autoPlay
                  onLoadStart={() => console.log("[v0] Video load start event")}
                  onLoadedData={() => console.log("[v0] Video loaded data event")}
                  onCanPlay={() => console.log("[v0] Video can play event")}
                  onPlay={() => console.log("[v0] Video play event")}
                  onError={(e) => console.error("[v0] Video error event:", e)}
                />
                <canvas ref={canvasRef} className="hidden" />

                {isScanning && (
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute inset-8 border-2 border-secondary rounded-2xl animate-pulse-glow">
                      <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-secondary rounded-tl-2xl"></div>
                      <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-secondary rounded-tr-2xl"></div>
                      <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-secondary rounded-bl-2xl"></div>
                      <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-secondary rounded-br-2xl"></div>
                    </div>

                    <div className="absolute inset-8 overflow-hidden rounded-2xl">
                      <div className="absolute w-full h-1 bg-gradient-to-r from-transparent via-secondary to-transparent animate-scan opacity-80"></div>
                    </div>

                    <div className="absolute top-4 left-4 right-4 glass rounded-xl p-3">
                      <div className="flex items-center gap-2 text-card-foreground">
                        <Scan className="h-4 w-4 animate-pulse" />
                        <span className="text-sm font-medium">Position QR code in frame</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex gap-3">
                  <Button
                    size="lg"
                    onClick={toggleFlash}
                    className="glass border-0 text-card-foreground hover:bg-secondary/20 transition-all duration-300 animate-float h-14 w-14 rounded-full shadow-lg"
                    style={{ animationDelay: "0s" }}
                  >
                    {flashEnabled ? <FlashlightOff className="h-5 w-5" /> : <Flashlight className="h-5 w-5" />}
                  </Button>

                  <Button
                    size="lg"
                    onClick={switchCamera}
                    className="glass border-0 text-card-foreground hover:bg-secondary/20 transition-all duration-300 animate-float h-14 w-14 rounded-full shadow-lg"
                    style={{ animationDelay: "0.5s" }}
                  >
                    <RotateCcw className="h-5 w-5" />
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <div className="glass rounded-full p-6 mb-6 animate-float">
                  {cameraState === "requesting" ? (
                    <Camera className="h-16 w-16 text-primary animate-pulse" />
                  ) : cameraState === "unavailable" ? (
                    <AlertTriangle className="h-16 w-16 text-destructive" />
                  ) : (
                    <CameraOff className="h-16 w-16 text-primary" />
                  )}
                </div>

                <h3 className="text-xl font-bold text-card-foreground mb-3 font-sans">
                  {cameraState === "requesting"
                    ? "Starting Camera..."
                    : cameraState === "denied"
                      ? "Camera Access Denied"
                      : cameraState === "unavailable"
                        ? "Camera Unavailable"
                        : "Camera Access Required"}
                </h3>

                <p className="text-sm text-muted-foreground mb-6 max-w-xs leading-relaxed">
                  {cameraState === "denied"
                    ? "Camera access was denied. Please enable it in your browser settings or try again."
                    : cameraState === "requesting"
                      ? "Please allow camera access to scan QR codes"
                      : cameraState === "unavailable"
                        ? "No camera found or camera is not supported in this environment."
                        : "Allow camera access to scan QR codes"}
                </p>

                {cameraState !== "requesting" && cameraState !== "unavailable" && (
                  <div className="space-y-3">
                    <Button
                      onClick={startCamera}
                      disabled={cameraState === "requesting"}
                      className="gap-3 text-base px-8 py-3 rounded-full bg-primary hover:bg-primary/90 transition-all duration-300 shadow-lg animate-pulse-glow"
                    >
                      <Camera className="h-5 w-5" />
                      {cameraState === "denied" ? "Try Again" : "Enable Camera"}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          {isScanning && (
            <div className="p-4 glass text-center border-t border-border/20">
              <div className="flex items-center justify-center gap-2 text-card-foreground">
                <div className="w-2 h-2 bg-secondary rounded-full animate-pulse"></div>
                <span className="text-sm font-medium">Scanning active</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
