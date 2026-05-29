"use client";

import { useEffect, useRef } from "react";

const BG = "#050d1a";

export default function LogoScrollAnimation() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const raf = useRef<number>(0);

  useEffect(() => {
    const section = sectionRef.current!;
    const vid = videoRef.current!;

    const draw = () => {
      const dur = vid.duration;
      if (!dur || isNaN(dur)) return;
      const scrollable = section.offsetHeight - window.innerHeight;
      const p = Math.max(
        0,
        Math.min(1, -section.getBoundingClientRect().top / scrollable)
      );
      vid.currentTime = p * dur;
    };

    const onScroll = () => {
      cancelAnimationFrame(raf.current);
      raf.current = requestAnimationFrame(draw);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    draw();

    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf.current);
    };
  }, []);

  return (
    <div ref={sectionRef} style={{ height: "600vh" }}>
      <div
        className="sticky top-0 h-screen w-full overflow-hidden"
        style={{ background: BG }}
      >
        {/* video.currentTime scrubbing — all-keyframe encode eliminates seek lag */}
        <video
          ref={videoRef}
          src="/video.mp4"
          muted
          playsInline
          preload="auto"
          className="absolute inset-0 w-full h-full"
          style={{
            objectFit: "cover",
            mixBlendMode: "screen",
          }}
        />

        {/* Radial vignette for premium depth */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 85% 85% at 58% 48%, transparent 20%, rgba(5,13,26,0.45) 60%, rgba(5,13,26,0.92) 100%)",
          }}
        />
      </div>
    </div>
  );
}
