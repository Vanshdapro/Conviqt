// One-shot brand icon generator.
// Source: the official Conviqt C-mark (teal C + espresso play triangle on warm
// paper). Produces every favicon / app-icon / PWA / schema size from one master,
// cropping out the dead cream margin so the mark reads at 16px while keeping the
// ORIGINAL textured paper background (crop from source pixels, never a synthetic
// fill — no seam). Also emits a multi-resolution favicon.ico (embedded PNGs).
//
// Run from repo root:  node scripts/gen-brand-icons.mjs
import sharp from "sharp";
import { writeFileSync } from "node:fs";

const SRC = process.argv[2] || "/Users/vanshagarwal/Desktop/logo _official.png";

// 1) Detect the mark's content bounding box from a downscaled raster.
const N = 256;
const { data } = await sharp(SRC)
  .resize(N, N, { fit: "fill" })
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const at = (x, y) => {
  const i = (y * N + x) * 3;
  return [data[i], data[i + 1], data[i + 2]];
};
// Background = average of the four corner regions (pure paper).
let br = 0, bg = 0, bb = 0, bn = 0;
for (const [cx, cy] of [[4, 4], [N - 5, 4], [4, N - 5], [N - 5, N - 5]]) {
  for (let dy = 0; dy < 4; dy++) for (let dx = 0; dx < 4; dx++) {
    const [r, g, b] = at(cx + dx - 1, cy + dy - 1);
    br += r; bg += g; bb += b; bn++;
  }
}
br /= bn; bg /= bn; bb /= bn;
const THRESH = 38; // > paper texture noise, < distance to teal/espresso ink
let minX = N, minY = N, maxX = -1, maxY = -1;
for (let y = 0; y < N; y++) {
  for (let x = 0; x < N; x++) {
    const [r, g, b] = at(x, y);
    const dist = Math.abs(r - br) + Math.abs(g - bg) + Math.abs(b - bb);
    if (dist > THRESH) {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
}
const meta = await sharp(SRC).metadata();
const S = meta.width; // source is square
const sc = S / N;
// Content bbox in source coords.
const cxw = (maxX - minX + 1) * sc;
const cyh = (maxY - minY + 1) * sc;
const ccx = ((minX + maxX) / 2) * sc;
const ccy = ((minY + maxY) / 2) * sc;
console.log(`bg≈(${br | 0},${bg | 0},${bb | 0})  bbox(src)= ${cxw | 0}x${cyh | 0} @ center(${ccx | 0},${ccy | 0})`);

// 2) Square crop = mark + ~10% margin each side, clamped to source bounds.
const side = Math.min(S, Math.max(cxw, cyh) * 1.20);
let left = Math.round(ccx - side / 2);
let top = Math.round(ccy - side / 2);
const sz = Math.round(side);
left = Math.max(0, Math.min(left, S - sz));
top = Math.max(0, Math.min(top, S - sz));
console.log(`crop= ${sz}x${sz} @ (${left},${top})  → mark fills ~${Math.round((Math.max(cxw, cyh) / side) * 100)}% of canvas`);

const cropped = await sharp(SRC).extract({ left, top, width: sz, height: sz }).toBuffer();

// 3) Emit every size. mark=cropped (icons), full=untouched source (brand asset).
// ensureAlpha(): Next.js's Rust ICO decoder rejects embedded PNGs that aren't
// RGBA ("The PNG is not in RGBA format!"), which 500s the whole app. The paper
// background is opaque, so adding a full-255 alpha channel changes nothing
// visually and keeps every consumer (Next, browsers, Google) happy.
const png = (buf, size) =>
  sharp(buf)
    .resize(size, size, { fit: "fill", kernel: "lanczos3" })
    .ensureAlpha()
    .png({ compressionLevel: 9 })
    .toBuffer();

const ROOT = "/Users/vanshagarwal/Desktop/Conviqt/conviqt";
// path -> [bufferSource, size]
const jobs = [
  // Next.js App Router file conventions (auto <link>)
  ["src/app/icon.png", cropped, 512],
  ["src/app/apple-icon.png", cropped, 180],
  // public/ — referenced by metadata.icons, manifest, JSON-LD, OG
  ["public/icon.png", cropped, 512],
  ["public/favicon.png", cropped, 64],
  ["public/icon-192.png", cropped, 192],
  ["public/icon-512.png", cropped, 512],
  ["public/apple-icon.png", cropped, 180],
  ["public/icon-48.png", cropped, 48],
  ["public/logo.png", cropped, 1024],
  ["public/logo1.png", cropped, 1024],
];
for (const [rel, buf, size] of jobs) {
  writeFileSync(`${ROOT}/${rel}`, await png(buf, size));
  console.log(`wrote ${rel}  (${size}px)`);
}
// Full-bleed master kept as the canonical brand source at repo root + public.
const full1024 = await sharp(SRC).resize(1024, 1024, { fit: "fill" }).png({ compressionLevel: 9 }).toBuffer();
writeFileSync(`${ROOT}/logo_official.png`, full1024);
writeFileSync(`${ROOT}/logo.png`, full1024);
writeFileSync(`${ROOT}/public/logo-full.png`, full1024);
console.log("wrote logo_official.png, logo.png, public/logo-full.png (full-bleed master 1024px)");

// 4) favicon.ico — embed real PNGs at 16/32/48 (valid + crawlable for Google).
const icoSizes = [16, 32, 48];
const pngs = await Promise.all(icoSizes.map((s) => png(cropped, s)));
const count = pngs.length;
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);      // reserved
header.writeUInt16LE(1, 2);      // type: icon
header.writeUInt16LE(count, 4);  // image count
const dir = Buffer.alloc(16 * count);
let offset = 6 + 16 * count;
pngs.forEach((buf, i) => {
  const s = icoSizes[i];
  const e = i * 16;
  dir.writeUInt8(s >= 256 ? 0 : s, e + 0);      // width
  dir.writeUInt8(s >= 256 ? 0 : s, e + 1);      // height
  dir.writeUInt8(0, e + 2);                     // palette
  dir.writeUInt8(0, e + 3);                     // reserved
  dir.writeUInt16LE(1, e + 4);                  // color planes
  dir.writeUInt16LE(32, e + 6);                 // bits per pixel
  dir.writeUInt32LE(buf.length, e + 8);         // size of PNG
  dir.writeUInt32LE(offset, e + 12);            // offset
  offset += buf.length;
});
const ico = Buffer.concat([header, dir, ...pngs]);
writeFileSync(`${ROOT}/src/app/favicon.ico`, ico);
writeFileSync(`${ROOT}/public/favicon.ico`, ico);
console.log(`wrote favicon.ico (${icoSizes.join("/")}px embedded, ${ico.length} bytes)`);

console.log("\nDONE — all brand icons regenerated from the new C-mark.");
