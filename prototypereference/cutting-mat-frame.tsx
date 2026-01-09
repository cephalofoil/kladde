"use client"

import type React from "react"

interface CuttingMatFrameProps {
  children?: React.ReactNode
  width?: number
  height?: number
}

export default function CuttingMatFrame({ children, width = 800, height = 600 }: CuttingMatFrameProps) {
  // Generate grid lines
  const gridSize = 20 // 20px grid squares
  const verticalLines = Math.floor(width / gridSize)
  const horizontalLines = Math.floor(height / gridSize)

  // Generate measurement markers (every 5 units)
  const topMarkers = Array.from({ length: Math.floor(verticalLines / 5) }, (_, i) => (i + 1) * 5)
  const rightMarkers = Array.from({ length: Math.floor(horizontalLines / 5) }, (_, i) => (i + 1) * 5)

  return (
    <div className="relative inline-block">
      {/* Main cutting mat surface */}
      <div
        className="relative bg-[#2d6f5e] overflow-hidden"
        style={{
          width: `${width}px`,
          height: `${height}px`,
        }}
      >
        {/* Paper texture overlay */}
        <div
          className="absolute inset-0 opacity-20 pointer-events-none mix-blend-overlay"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='2' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
            backgroundSize: "200px 200px",
          }}
        />

        {/* Wear and scratches */}
        <div className="absolute top-20 left-40 w-32 h-1 bg-[#1a4a3d] opacity-30 rotate-12" />
        <div className="absolute bottom-32 right-56 w-24 h-1 bg-[#1a4a3d] opacity-20 -rotate-6" />
        <div className="absolute top-1/2 left-1/3 w-16 h-0.5 bg-[#1a4a3d] opacity-25 rotate-45" />

        {/* Grid lines - vertical */}
        {Array.from({ length: verticalLines + 1 }).map((_, i) => (
          <div
            key={`v-${i}`}
            className="absolute top-0 bottom-0 w-px bg-[#5cb89f] opacity-40"
            style={{ left: `${i * gridSize}px` }}
          />
        ))}

        {/* Grid lines - horizontal */}
        {Array.from({ length: horizontalLines + 1 }).map((_, i) => (
          <div
            key={`h-${i}`}
            className="absolute left-0 right-0 h-px bg-[#5cb89f] opacity-40"
            style={{ top: `${i * gridSize}px` }}
          />
        ))}

        {/* Top measurement scale */}
        <div className="absolute top-0 left-0 right-0 h-8 bg-[#2a685a] border-b border-[#5cb89f]/30 flex items-center justify-around">
          {topMarkers.map((num) => (
            <span key={`top-${num}`} className="text-[10px] font-bold text-[#5cb89f] tracking-wider">
              {num}
            </span>
          ))}
        </div>

        {/* Right measurement scale */}
        <div className="absolute top-0 right-0 bottom-0 w-8 bg-[#2a685a] border-l border-[#5cb89f]/30 flex flex-col items-center justify-around">
          {rightMarkers.map((num) => (
            <span key={`right-${num}`} className="text-[10px] font-bold text-[#5cb89f] tracking-wider">
              {num}
            </span>
          ))}
        </div>

        {/* Bottom left branding */}
        <div className="absolute bottom-4 left-4 text-[#5cb89f] opacity-60">
          <div className="font-black text-lg tracking-tighter">SDi</div>
          <div className="text-[8px] font-semibold tracking-wide mt-0.5">CUTTING MAT</div>
        </div>

        {/* Content area */}
        <div className="absolute inset-0 p-12">{children}</div>
      </div>
    </div>
  )
}
