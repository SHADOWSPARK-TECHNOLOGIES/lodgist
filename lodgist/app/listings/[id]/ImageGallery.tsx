"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface GalleryImage {
  url: string;
  alt: string;
}

interface ImageGalleryProps {
  images: GalleryImage[];
}

export function ImageGallery({ images }: ImageGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  if (images.length === 0) {
    return (
      <div className="flex aspect-[16/9] items-center justify-center rounded-xl bg-muted">
        <p className="text-sm text-muted-foreground">No images available</p>
      </div>
    );
  }

  const current = images[selectedIndex];
  const prevIndex = selectedIndex > 0 ? selectedIndex - 1 : images.length - 1;
  const nextIndex = selectedIndex < images.length - 1 ? selectedIndex + 1 : 0;

  // Show up to 4 thumbnails
  const thumbnails = images.slice(0, 4);

  return (
    <div className="space-y-3">
      {/* Main Image */}
      <div className="relative aspect-[16/9] overflow-hidden rounded-xl bg-muted">
        <img
          src={current.url}
          alt={current.alt}
          className="h-full w-full object-cover transition-opacity duration-300"
        />

        {/* Navigation arrows */}
        {images.length > 1 && (
          <>
            <button
              onClick={() => setSelectedIndex(prevIndex)}
              className="absolute left-3 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition-colors hover:bg-black/70"
              aria-label="Previous image"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={() => setSelectedIndex(nextIndex)}
              className="absolute right-3 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition-colors hover:bg-black/70"
              aria-label="Next image"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}

        {/* Image counter */}
        <span className="absolute bottom-3 right-3 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
          {selectedIndex + 1} / {images.length}
        </span>
      </div>

      {/* Thumbnails */}
      {thumbnails.length > 1 && (
        <div className="flex gap-3">
          {thumbnails.map((img, i) => (
            <button
              key={i}
              onClick={() => setSelectedIndex(i)}
              className={cn(
                "relative aspect-[4/3] flex-1 overflow-hidden rounded-lg ring-2 transition-all duration-200",
                selectedIndex === i
                  ? "ring-[#FF6F3C] ring-offset-2"
                  : "ring-transparent opacity-70 hover:opacity-100",
              )}
            >
              <img
                src={img.url}
                alt={img.alt}
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
