"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface TruthIndexMeterProps {
  score: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}

function getColor(score: number): string {
  if (score >= 90) return "#1ABC9C";
  if (score >= 70) return "#0F9D7E";
  if (score >= 41) return "#FF6F3C";
  return "#DC2626";
}

function getLabel(score: number): string {
  if (score >= 90) return "Fully Verified";
  if (score >= 70) return "Good Standing";
  if (score >= 41) return "More Verification Needed";
  return "High Risk — Proceed with Caution";
}

export function TruthIndexMeter({ score, size = "md", className }: TruthIndexMeterProps) {
  const [width, setWidth] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setWidth(Math.min(Math.max(score, 0), 100));
          observer.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [score]);

  const color = getColor(score);
  const label = getLabel(score);

  const barHeight = { sm: "h-1.5", md: "h-2.5", lg: "h-4" }[size];
  const textSize = { sm: "text-xs", md: "text-sm", lg: "text-base" }[size];

  return (
    <div ref={ref} className={cn("w-full space-y-1", className)}>
      <div className="flex items-center justify-between">
        <span className={cn("font-medium text-gray-700", textSize)}>Truth Index</span>
        <span className={cn("tabular-nums font-semibold", textSize)} style={{ color }}>
          {score}/100
        </span>
      </div>
      <div className={cn("w-full overflow-hidden rounded-full bg-gray-100", barHeight)}>
        <div
          className={cn("h-full rounded-full transition-all duration-700 ease-out")}
          style={{ width: `${width}%`, backgroundColor: color }}
        />
      </div>
      <p className={cn("text-gray-500", size === "sm" ? "text-xs" : "text-xs")} style={{ color }}>
        {label}
      </p>
    </div>
  );
}

export default TruthIndexMeter;
