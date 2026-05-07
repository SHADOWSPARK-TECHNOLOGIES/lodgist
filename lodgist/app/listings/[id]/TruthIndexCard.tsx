"use client";

import { useEffect, useRef, useState } from "react";
import { Shield, Star } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TruthBar {
  label: string;
  key: string;
  max: number;
}

interface TruthIndexCardProps {
  score: number;
  breakdown: Record<string, number> | null;
  bars: TruthBar[];
  color: string;
  bgColor: string;
}

// ─── Animated Counter ─────────────────────────────────────────────────────────

function AnimatedCounter({
  target,
  color,
  bgColor,
}: {
  target: number;
  color: string;
  bgColor: string;
}) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          const duration = 1500; // ms
          const start = performance.now();

          function animate(now: number) {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            // Ease-out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.round(eased * target));

            if (progress < 1) {
              requestAnimationFrame(animate);
            }
          }

          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.3 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [target]);

  return (
    <div ref={ref} className="flex flex-col items-center">
      <span
        className={cn(
          "text-5xl font-bold tabular-nums sm:text-6xl",
          color,
        )}
      >
        {count}
      </span>
      <span
        className={cn(
          "mt-1 rounded-full px-3 py-0.5 text-xs font-semibold text-white",
          bgColor,
        )}
      >
        {target >= 80 ? "Excellent" : target >= 50 ? "Fair" : "Needs Review"}
      </span>
    </div>
  );
}

// ─── Category Bar ─────────────────────────────────────────────────────────────

function CategoryBar({
  label,
  value,
  max,
}: {
  label: string;
  value: number;
  max: number;
}) {
  const percentage = Math.min((value / max) * 100, 100);

  const barColor =
    percentage >= 80
      ? "bg-[#1ABC9C]"
      : percentage >= 50
        ? "bg-[#FF6F3C]"
        : "bg-red-500";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-[#0B1B2B]">{label}</span>
        <span className="text-muted-foreground">
          {value}/{max}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className={cn("h-full rounded-full transition-all duration-700", barColor)}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TruthIndexCard({
  score,
  breakdown,
  bars,
  color,
  bgColor,
}: TruthIndexCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg text-[#0B1B2B]">
          <Shield className="h-5 w-5 text-[#1ABC9C]" />
          Truth Index
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Animated score */}
        <div className="flex justify-center py-4">
          <AnimatedCounter target={score} color={color} bgColor={bgColor} />
        </div>

        {/* Category breakdown bars */}
        {breakdown && (
          <div className="space-y-4">
            <p className="text-sm font-semibold text-[#0B1B2B]">
              Breakdown
            </p>
            {bars.map((bar) => {
              const value = breakdown[bar.key] ?? 0;
              return (
                <CategoryBar
                  key={bar.key}
                  label={bar.label}
                  value={value}
                  max={bar.max}
                />
              );
            })}
          </div>
        )}

        {/* Footnote */}
        <p className="text-xs leading-relaxed text-muted-foreground">
          The Truth Index is Lodgist's proprietary scoring system that
          evaluates listing authenticity based on image quality, description
          accuracy, owner verification, pricing fairness, and review
          legitimacy.
        </p>
      </CardContent>
    </Card>
  );
}
