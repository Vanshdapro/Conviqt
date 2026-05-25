"use client";

import { Suspense, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Chat, { type ChatHandle } from "@/components/Chat";

function ChatInner() {
  const params = useSearchParams();
  const q = params.get("q") ?? "";
  const chatRef = useRef<ChatHandle>(null);
  const firedRef = useRef(false);

  useEffect(() => {
    if (q && !firedRef.current && chatRef.current) {
      firedRef.current = true;
      chatRef.current.send(q);
    }
  }, [q]);

  return <Chat ref={chatRef} />;
}

export default function ChatWithQuery() {
  return (
    <Suspense fallback={<Chat />}>
      <ChatInner />
    </Suspense>
  );
}
