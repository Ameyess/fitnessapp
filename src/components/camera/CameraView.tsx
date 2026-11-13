"use client"

import * as React from "react"

interface CameraViewProps {
  stream: MediaStream | null
  width: number
  height: number
  mirror: boolean
  onLoadedMetadata?: () => void
}

export function CameraView({
  stream,
  width,
  height,
  mirror = false,
  onLoadedMetadata,
}: CameraViewProps) {
  const videoRef = React.useRef<HTMLVideoElement>(null)
  React.useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream
  }, [stream])
  return (
    <div className="relative w-full h-full bg-slate-900 overflow-hidden rounded-3xl">
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        onLoadedMetadata={onLoadedMetadata}
        className={`w-full h-full object-cover ${mirror ? "mirror" : ""}`}
      />
      <div className="absolute inset-0 flex items-center justify-center">
        {stream ? null : (
          <div className="flex flex-col items-center gap-2 text-slate-300">
            <span className="text-4xl">📷</span>
            <p className="text-sm font-medium">No camera feed</p>
          </div>
        )}
      </div>
    </div>
  )
}
