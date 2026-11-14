"use client"

import * as React from "react"

interface CameraViewProps {
  stream: MediaStream | null
  /** The parent's ref MUST be attached to the <video> element so the
   *  MediaPipe detection loop can read frames from it. */
  videoRef?: React.RefObject<HTMLVideoElement>
  width?: number
  height?: number
  mirror?: boolean
  /**
   * How the video is fitted into the screen.
   *  - "cover": fills the screen, crops the overflow.
   *  - "contain": shows the whole frame (letterboxed). Used on phones so a
   *    landscape camera stream never crops the user out of view.
   */
  fit?: "cover" | "contain"
  onLoadedMetadata?: () => void
  onError?: (err: Error) => void
}

export function CameraView({
  stream,
  videoRef,
  width = 1280,
  height = 720,
  mirror = false,
  fit = "cover",
  onLoadedMetadata,
  onError,
}: CameraViewProps) {
  const localRef = React.useRef<HTMLVideoElement | null>(null)
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

  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      <video
        ref={setRef}
        autoPlay
        muted
        playsInline
        disablePictureInPicture
        onLoadedMetadata={onLoadedMetadata}
        className={`h-full w-full ${fit === "contain" ? "object-contain" : "object-cover"} ${
          mirror ? "mirror" : ""
        }`}
        style={{ transform: mirror ? "scaleX(-1)" : undefined }}
      />
    </div>
  )
}
