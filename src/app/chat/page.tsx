import { DashNav } from "@/components/DashNav";
import ChatWithQuery from "@/components/ChatWithQuery";

export default function ChatPage() {
  return (
    <div className="flex flex-col min-h-screen" style={{ background: "#050d1a" }}>
      <DashNav active="chat" />
      <ChatWithQuery />
    </div>
  );
}
