// Phase 8 retirement: the standalone /watchlist surface was merged into
// Portfolio (the "Watching" tab). This file is a permanent redirect so old
// inbound links — bookmarks, search results, the watchlist email digest —
// still land somewhere useful instead of 404'ing.

import { permanentRedirect } from "next/navigation";

export default function WatchlistRedirect() {
  permanentRedirect("/portfolio?tab=watching");
}
