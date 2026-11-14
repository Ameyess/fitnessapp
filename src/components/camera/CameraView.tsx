"use client"

import * as React from "react"
import { type Rotation } from "@/lib/camera/rotation"

interface CameraViewProps {
  stream: MediaStream | null
  /** The parent's ref MUST be attached to the <video> element so the
   *  MediaPipe detection loop can read frames from it. */
  videoRef?: React.RefObject<HTMLVideoElement>
  width?: number
  height?: number
  mirror?: boolean
  /** Clockwise rotation applied to the camera content. */
  rotation?: Rotation
  /**
   * How the video is fitted into the screen.
   *  - "cover": fills the screen, crops the overflow.
   *  - "contain": shows the whole frame (letterboxed). Used when the source
   *    and viewport aspect ratios differ enough to crop the user out.
   */
  fit?: "cover" | "contain"
  onLoadedMetadata?: () => void
  onError?: (err: Error) => void
}

export function CameraView({
  stream,
  videoRef,
  mirror = false,
  rotation = 0,
  fit = "cover",
  onLoadedMetadata,
  onError,
}: CameraViewProps) {
  const localRef = React.useRef<HTMLVideoElement | null>(null)
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const [containerSize, setContainerSize] = React.useState<{
    width: number
    height: number
  } | null>(null)

  const setRef = React.useCallback(
    (node: HTMLVideoElement | null) => {
      localRef.current = node
      if (videoRef) (videoRef as React.MutableRefObject<HTMLVideoElement | null>).current = node
    },
    [videoRef]
  )

  React.useEffect(() => {
    const el = localRef.current
    if (!el) return
    if (el.srcObject !== stream) {
      el.srcObject = stream
      // Autoplay can be rejected when the element is not yet in the DOM
      const p = el.play()
      if (p && typeof p.catch === "function") p.catch(() => {})
    }
  }, [stream])

  React.useEffect(() => {
    const container = containerRef.current
    if (!container || typeof ResizeObserver === "undefined") return

    const updateSize = () => {
      const nextWidth = container.clientWidth
      const nextHeight = container.clientHeight
      if (nextWidth <= 0 || nextHeight <= 0) return

      setContainerSize((current) => {
        if (current?.width === nextWidth && current.height === nextHeight) {
          return current
        }
        return { width: nextWidth, height: nextHeight }
      })
    }

    updateSize()
    const observer = new ResizeObserver(updateSize)
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  const swapsAxes = rotation === 90 || rotation === 270
  const frameWidth = containerSize
    ? swapsAxes
      ? containerSize.height
      : containerSize.width
    : null
  const frameHeight = containerSize
    ? swapsAxes
      ? containerSize.width
      : containerSize.height
    : null

  const wrapperStyle = {
    "--camera-frame-width": frameWidth ? `${frameWidth}px` : "100%",
    "--camera-frame-height": frameHeight ? `${frameHeight}px` : "100%",
  } as React.CSSProperties

  const videoTransform = [
    rotation ? `rotate(${rotation}deg)` : "",
    mirror ? "scaleX(-1)" : "",
  ]
    .filter(Boolean)
    .join(" ")

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden bg-black"
      style={wrapperStyle}
    >
      <div
        className="absolute"
        style={{
          left: "50%",
          top: "50%",
          width: "var(--camera-frame-width)",
          height: "var(--camera-frame-height)",
          transform: "translate(-50%, -50%)",
        }}
      >
        <video
          ref={setRef}
          autoPlay
          muted
          playsInline
          disablePictureInPicture
          onLoadedMetadata={onLoadedMetadata}
          onError={
            onError
              ? () => onError(new Error("Camera video failed to load"))
              : undefined
          }
          data-testid="camera-video"
          data-rotation={rotation}
          className="block"
          style={{
            width: "100%",
            height: "100%",
            objectFit: fit,
            transform: videoTransform || "none",
            transformOrigin: "center",
          }}
        />
      </div>
    </div>
  )
}
