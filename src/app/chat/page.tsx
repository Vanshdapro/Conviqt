import { redirect } from "next/navigation";

// The chat surface was rebuilt as Research (playbook Phase 3). Old deep links
// (/chat?q=… from lessons, stock pages, practice) land on the new surface with
// the question prefilled.

export const dynamic = "force-dynamic";

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  redirect(q ? `/research?q=${encodeURIComponent(q)}` : "/research");
}
