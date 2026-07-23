"use client";

import { useState, useEffect, useCallback } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

interface LogoLightboxProps {
  logos: string[];
  initialIndex?: number;
  isOpen: boolean;
  onClose: () => void;
}

const SCENES = ["白底", "深色底", "名片模拟"];

export function LogoLightbox({ logos, initialIndex = 0, isOpen, onClose }: LogoLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [scene, setScene] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex);
      setScene(0);
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [isOpen, initialIndex]);

  const goNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % logos.length);
  }, [logos.length]);

  const goPrev = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + logos.length) % logos.length);
  }, [logos.length]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose, goNext, goPrev]);

  if (!isOpen || logos.length === 0) return null;

  const bgStyle =
    scene === 0 ? "bg-white" :
    scene === 1 ? "bg-neutral-900" :
    "bg-[#f5f0e8]"; // kraft paper / business card feel

  const mockupName = scene === 0 ? "白底预览" : scene === 1 ? "深色底预览" : "名片模拟";

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <button onClick={onClose} className="p-2 text-white/70 hover:text-white transition-colors">
          <X className="w-6 h-6" />
        </button>
        <span className="text-white/50 text-sm">
          {currentIndex + 1} / {logos.length}
        </span>
      </div>

      {/* Main image area */}
      <div className="flex-1 flex items-center justify-center relative px-4">
        <button
          onClick={goPrev}
          className="absolute left-2 md:left-4 p-2 text-white/50 hover:text-white transition-colors z-10"
          aria-label="上一个"
        >
          <ChevronLeft className="w-8 h-8" />
        </button>

        <div className={`w-full max-w-2xl aspect-square rounded-2xl flex items-center justify-center p-4 transition-colors ${bgStyle}`}>
          <img
            src={logos[currentIndex]}
            alt={`Logo 放大预览 ${currentIndex + 1}`}
            className="max-w-full max-h-full object-contain"
            style={{ touchAction: "pinch-zoom" }}
          />
        </div>

        <button
          onClick={goNext}
          className="absolute right-2 md:right-4 p-2 text-white/50 hover:text-white transition-colors z-10"
          aria-label="下一个"
        >
          <ChevronRight className="w-8 h-8" />
        </button>
      </div>

      {/* Scene toggle */}
      <div className="flex items-center justify-center gap-3 px-4 py-4 shrink-0">
        {SCENES.map((name, i) => (
          <button
            key={name}
            onClick={() => setScene(i)}
            className={`px-4 py-2 text-sm rounded-lg transition-colors ${
              scene === i
                ? "bg-white text-neutral-900 font-medium"
                : "bg-white/10 text-white/70 hover:bg-white/20"
            }`}
          >
            {name}
          </button>
        ))}
      </div>
      <p className="text-center text-xs text-white/30 pb-2">{mockupName}</p>
    </div>
  );
}