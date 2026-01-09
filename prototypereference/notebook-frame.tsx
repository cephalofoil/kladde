"use client"

import type React from "react"

interface NotebookFrameProps {
  children?: React.ReactNode
  width?: number
  height?: number
}

export default function NotebookFrame({ children, width = 900, height = 600 }: NotebookFrameProps) {
  const pageWidth = width / 2
  const coverRadius = 24

  return (
    <div className="relative inline-block">
      <div
        className="relative flex"
        style={{
          width: `${width}px`,
          height: `${height}px`,
        }}
      >
        {/* Left cover with rounded corners */}
        <div
          className="relative bg-[#1e5a5a] overflow-hidden"
          style={{
            width: `${pageWidth}px`,
            height: `${height}px`,
            borderTopLeftRadius: `${coverRadius}px`,
            borderBottomLeftRadius: `${coverRadius}px`,
          }}
        >
          {/* Leather texture */}
          <div
            className="absolute inset-0 opacity-15 mix-blend-overlay"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.5' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
              backgroundSize: "150px 150px",
            }}
          />
          {/* Wear on corners */}
          <div className="absolute top-0 left-0 w-16 h-16 bg-[#2a7575] opacity-30 rounded-tl-3xl" />
          <div className="absolute bottom-0 left-0 w-20 h-20 bg-[#2a7575] opacity-25 rounded-bl-3xl" />

          {/* Left page content */}
          <div className="relative h-full bg-[#f5f0e5] m-2 rounded-tl-[20px] rounded-bl-[20px] overflow-hidden">
            {/* Paper texture */}
            <div
              className="absolute inset-0 opacity-30 pointer-events-none"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='3' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
                backgroundSize: "100px 100px",
              }}
            />
            {/* Aging spots */}
            <div className="absolute top-12 right-8 w-4 h-4 rounded-full bg-[#d4c4a8] opacity-40" />
            <div className="absolute bottom-24 left-12 w-3 h-3 rounded-full bg-[#d4c4a8] opacity-30" />
            <div className="absolute top-1/3 right-16 w-2 h-2 rounded-full bg-[#d4c4a8] opacity-35" />

            {/* Content area */}
            <div className="p-8 h-full">{children && <div className="h-full">{children}</div>}</div>
          </div>
        </div>

        {/* Center binding */}
        <div className="relative w-1 bg-[#0f3838] z-10">
          {/* Binding stitches */}
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="absolute left-1/2 -translate-x-1/2 w-0.5 h-3 bg-[#8b7355] opacity-60"
              style={{ top: `${(i + 1) * (height / 9)}px` }}
            />
          ))}
        </div>

        {/* Right cover with rounded corners */}
        <div
          className="relative bg-[#1e5a5a] overflow-hidden"
          style={{
            width: `${pageWidth}px`,
            height: `${height}px`,
            borderTopRightRadius: `${coverRadius}px`,
            borderBottomRightRadius: `${coverRadius}px`,
          }}
        >
          {/* Leather texture */}
          <div
            className="absolute inset-0 opacity-15 mix-blend-overlay"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.5' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
              backgroundSize: "150px 150px",
            }}
          />
          {/* Wear on corners */}
          <div className="absolute top-0 right-0 w-16 h-16 bg-[#2a7575] opacity-30 rounded-tr-3xl" />
          <div className="absolute bottom-0 right-0 w-20 h-20 bg-[#2a7575] opacity-25 rounded-br-3xl" />

          {/* Right page content */}
          <div className="relative h-full bg-[#f5f0e5] m-2 rounded-tr-[20px] rounded-br-[20px] overflow-hidden">
            {/* Paper texture */}
            <div
              className="absolute inset-0 opacity-30 pointer-events-none"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='3' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
                backgroundSize: "100px 100px",
              }}
            />
            {/* Aging spots */}
            <div className="absolute top-16 left-12 w-3 h-3 rounded-full bg-[#d4c4a8] opacity-35" />
            <div className="absolute bottom-32 right-16 w-4 h-4 rounded-full bg-[#d4c4a8] opacity-40" />

            {/* Tab bookmark on right edge */}
            <div className="absolute right-0 top-24 w-12 h-16 bg-[#e8dcc8]">
              {/* Paper texture on tab */}
              <div
                className="absolute inset-0 opacity-40"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='3' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
                  backgroundSize: "50px 50px",
                }}
              />
            </div>

            {/* Content area */}
            <div className="p-8 h-full">{children && <div className="h-full">{children}</div>}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
