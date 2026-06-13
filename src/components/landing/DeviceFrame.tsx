// CSS-drawn device frames for the landing's REAL app screenshots — a phone
// bezel for the hero and a Safari-style browser window for the feature rows.
// Pure tokens: the bezel is espresso ink (--text), never #000; elevation is
// tone + border per the brand law (max shadow --shadow-card). The browser
// frame can carry an optional scripted "recorded usage" DemoOverlay.

import Image from "next/image";
import { DemoOverlay, type DemoScript } from "./DemoOverlay";

export function PhoneFrame({
  src,
  alt,
  width,
  height,
  priority = false,
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  priority?: boolean;
}) {
  return (
    <div className="cvq-phone" role="img" aria-label={alt}>
      <span className="cvq-phone-notch" aria-hidden="true" />
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        priority={priority}
        className="cvq-phone-screen"
        sizes="(max-width: 768px) 78vw, 360px"
      />
    </div>
  );
}

export function BrowserFrame({
  src,
  alt,
  width,
  height,
  url,
  demo,
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  url: string;
  demo?: DemoScript;
}) {
  return (
    <div className="cvq-browser">
      <div className="cvq-browser-bar" aria-hidden="true">
        <span className="cvq-browser-dots">
          <i />
          <i />
          <i />
        </span>
        <span className="cvq-browser-url">
          <svg className="cvq-browser-lock" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="5" y="11" width="14" height="9" rx="2" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" />
          </svg>
          <span className="cvq-browser-urltext">{url}</span>
          <svg className="cvq-browser-reload" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 12a9 9 0 1 1-2.64-6.36" />
            <path d="M21 4v5h-5" />
          </svg>
        </span>
      </div>
      <div className="cvq-browser-screenwrap">
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          className="cvq-browser-screen"
          sizes="(max-width: 768px) 92vw, 620px"
        />
        {demo ? <DemoOverlay script={demo} /> : null}
      </div>
    </div>
  );
}
