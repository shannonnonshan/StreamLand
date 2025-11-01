"use client";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

export default function HoverTooltip({ label, children }: { label: string, children: React.ReactNode }) {
  const [show, setShow] = useState(false);
  const [coords, setCoords] = useState<{x: number, y: number}>({x: 0, y: 0});

  const handleEnter = (e: React.MouseEvent) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setCoords({ x: rect.right + 10, y: rect.top + rect.height / 2 });
    setShow(true);
  };

  const handleLeave = () => setShow(false);

  return (
    <>
      <span onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
        {children}
      </span>
      {show &&
        createPortal(
          <div
            style={{
              position: "fixed",
              top: coords.y,
              left: coords.x,
              transform: "translateY(-50%)",
              background: "#1f2937",
              color: "white",
              fontSize: "12px",
              borderRadius: "6px",
              padding: "4px 8px",
              zIndex: 99999,
              whiteSpace: "nowrap",
              boxShadow: "0 2px 10px rgba(0,0,0,0.4)",
            }}
          >
            {label}
          </div>,
          document.body
        )}
    </>
  );
}
