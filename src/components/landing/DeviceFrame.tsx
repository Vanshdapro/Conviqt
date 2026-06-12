// CSS-drawn device frames for the landing's REAL app screenshots — a phone
// bezel for the hero and a browser window for the feature rows. Pure tokens:
// the bezel is espresso ink (--text), never #000; elevation is tone + border
// per the brand law (max shadow --shadow-card).

import Image from "next/image";

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
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  url: string;
}) {
  return (
    <div className="cvq-browser">
      <div className="cvq-browser-bar" aria-hidden="true">
        <span className="cvq-browser-dots">
          <i />
          <i />
          <i />
        </span>
        <span className="cvq-browser-url" data-no-translate>
          {url}
        </span>
      </div>
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        className="cvq-browser-screen"
        sizes="(max-width: 768px) 92vw, 620px"
      />
    </div>
  );
}
