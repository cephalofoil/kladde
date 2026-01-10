"use client";

import * as React from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  AnimatePresence,
  type SpringOptions,
} from "motion/react";

interface CollaboratorCursorProps {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
  pan: { x: number; y: number };
  zoom: number;
  lastActivity: number;
}

const INACTIVE_THRESHOLD_MS = 5000; // 5 seconds of no movement = inactive

const springTransition: SpringOptions = {
  stiffness: 500,
  damping: 50,
  bounce: 0,
};

export function CollaboratorCursor({
  id,
  name,
  color,
  x: targetX,
  y: targetY,
  pan,
  zoom,
  lastActivity,
}: CollaboratorCursorProps) {
  const [now, setNow] = React.useState(Date.now());

  // Update "now" periodically to check for inactivity
  React.useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const isInactive = now - lastActivity > INACTIVE_THRESHOLD_MS;

  // Convert world coordinates to screen coordinates
  const screenX = targetX * zoom + pan.x;
  const screenY = targetY * zoom + pan.y;

  const motionX = useMotionValue(screenX);
  const motionY = useMotionValue(screenY);

  const springX = useSpring(motionX, springTransition);
  const springY = useSpring(motionY, springTransition);

  // Follow label with more lag for nice trailing effect
  const followSpringX = useSpring(motionX, {
    stiffness: 300,
    damping: 40,
    bounce: 0,
  });
  const followSpringY = useSpring(motionY, {
    stiffness: 300,
    damping: 40,
    bounce: 0,
  });

  React.useEffect(() => {
    motionX.set(screenX);
    motionY.set(screenY);
  }, [screenX, screenY, motionX, motionY]);

  // Get contrasting text color
  const textColor = React.useMemo(() => {
    const hex = color.replace("#", "");
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? "#000000" : "#ffffff";
  }, [color]);

  const cursorOpacity = isInactive ? 0.4 : 1;

  return (
    <>
      {/* Cursor pointer */}
      <motion.div
        key={`cursor-${id}`}
        data-slot="collaborator-cursor"
        style={{
          pointerEvents: "none",
          zIndex: 30,
          position: "absolute",
          top: springY,
          left: springX,
          opacity: cursorOpacity,
        }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: cursorOpacity }}
        exit={{ scale: 0, opacity: 0 }}
        transition={{ opacity: { duration: 0.3 } }}
      >
        <svg
          className="size-5 drop-shadow-md"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 40 40"
          style={{ color }}
        >
          <path
            fill="currentColor"
            stroke="#fff"
            strokeWidth="2"
            d="M1.8 4.4 7 36.2c.3 1.8 2.6 2.3 3.6.8l3.9-5.7c1.7-2.5 4.5-4.1 7.5-4.3l6.9-.5c1.8-.1 2.5-2.4 1.1-3.5L5 2.5c-1.4-1.1-3.5 0-3.3 1.9Z"
          />
        </svg>
      </motion.div>

      {/* Name label with trailing animation */}
      <motion.div
        key={`label-${id}`}
        data-slot="collaborator-cursor-label"
        style={{
          pointerEvents: "none",
          zIndex: 29,
          position: "absolute",
          top: followSpringY,
          left: followSpringX,
          opacity: cursorOpacity,
        }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: cursorOpacity }}
        exit={{ scale: 0, opacity: 0 }}
        transition={{ opacity: { duration: 0.3 } }}
      >
        <div
          className="ml-4 mt-5 rounded-full px-2.5 py-1 text-xs font-medium shadow-lg whitespace-nowrap"
          style={{
            backgroundColor: color,
            color: textColor,
          }}
        >
          {name}
        </div>
      </motion.div>
    </>
  );
}

// Container component for multiple collaborator cursors
interface CollaboratorCursorsProps {
  cursors: Array<{
    id: string;
    name: string;
    color: string;
    x: number;
    y: number;
    lastActivity: number;
  }>;
  pan: { x: number; y: number };
  zoom: number;
}

export function CollaboratorCursors({
  cursors,
  pan,
  zoom,
}: CollaboratorCursorsProps) {
  // Filter out cursors with empty or missing IDs to prevent React key errors
  const validCursors = cursors.filter((cursor) => cursor.id);

  return (
    <AnimatePresence>
      {validCursors.map((cursor) => (
        <CollaboratorCursor
          key={cursor.id}
          id={cursor.id}
          name={cursor.name}
          color={cursor.color}
          x={cursor.x}
          y={cursor.y}
          pan={pan}
          zoom={zoom}
          lastActivity={cursor.lastActivity}
        />
      ))}
    </AnimatePresence>
  );
}
