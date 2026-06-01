import { permanentRedirect } from "next/navigation";

// Learn moved under the Academy. The old /learn URL now lives at /academy/learn;
// a permanent redirect preserves inbound links and SEO equity (the canonical is
// declared on the new page).
export default function LearnRedirect(): never {
  permanentRedirect("/academy/learn");
}
