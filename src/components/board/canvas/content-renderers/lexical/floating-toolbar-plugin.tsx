"use client";

import React from "react";
import { FloatingToolbar } from "./floating-toolbar";

interface FloatingToolbarPluginProps {
  show: boolean;
  className?: string;
  variant?: "floating" | "inline";
}

export function FloatingToolbarPlugin({
  show,
  className,
  variant = "floating",
}: FloatingToolbarPluginProps) {
  if (!show) return null;

  return (
    <div className="absolute top-2 left-2 right-2 z-10">
      <FloatingToolbar className={className} variant={variant} />
    </div>
  );
}
