import { DashNav } from "@/components/DashNav";
import { AlphaGate } from "@/components/AlphaGate";

// Never statically prerender — picks + unlock state are per-user at runtime.
export const dynamic = "force-dynamic";

export default function AlphaPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#050d1a" }}>
      <DashNav active="alpha" />
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "48px 24px" }}>
        <AlphaGate />
      </main>
    </div>
  );
}
