"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { DEFAULT_LANG, LANG_BY_CODE, type LangCode } from "@/lib/i18n/languages";

// ── Conviqt Translate engine ────────────────────────────────────────────────
//
// The app renders in English (server + client). When a non-English language is
// chosen, this engine walks the live DOM, translates every visible text node
// and a handful of human-readable attributes via /api/translate, and applies
// the result in place. A MutationObserver keeps newly-rendered content (route
// changes, streaming chat, AI research output) translated as it appears.
//
// Everything is heavily cached: each phrase is translated once per language,
// then reused from memory and localStorage — so switching back and forth, or
// returning later, is instant and costs nothing.

const LS_LANG = "conviqt_lang";
const LS_CACHE = "conviqt_tcache_v1";

const TRANSLATABLE_ATTRS = ["placeholder", "aria-label", "title", "alt"] as const;

// Elements whose text we never touch: code/markup, canvas, form controls, and
// anything explicitly opted out (the language switcher marks itself this way).
const SKIP_TAGS = new Set([
  "SCRIPT", "STYLE", "NOSCRIPT", "CODE", "PRE", "KBD", "SAMP",
  "CANVAS", "SVG", "TEXTAREA", "SELECT", "OPTION",
]);

const FLUSH_MS = 250; // debounce DOM mutations (coalesces streaming updates)
const FETCH_BATCH = 80; // strings per /api/translate request
const CACHE_PERSIST_MAX = 4000; // cap localStorage cache size
const PERSIST_DEBOUNCE_MS = 800;

const hasLetters = (s: string): boolean => /\p{L}/u.test(s);

// Skip a node if it (or any ancestor) is non-translatable.
function isSkippable(node: Node | null): boolean {
  let el: Node | null = node;
  while (el && el !== document.body && el.nodeType !== 9) {
    if (el.nodeType === 1) {
      const e = el as Element;
      if (SKIP_TAGS.has(e.tagName)) return true;
      if (e.getAttribute("translate") === "no") return true;
      if (e.hasAttribute("data-no-translate")) return true;
      if ((e as HTMLElement).isContentEditable) return true;
    }
    el = el.parentNode;
  }
  return false;
}

interface Collected {
  texts: Text[];
  attrEls: Element[];
}

// Gather translatable text nodes and attribute-bearing elements under a root.
function collectFrom(root: Node): Collected {
  const texts: Text[] = [];
  const attrEls: Element[] = [];

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      const v = n.nodeValue;
      if (!v || !hasLetters(v)) return NodeFilter.FILTER_REJECT;
      if (isSkippable(n.parentNode)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  for (let cur = walker.nextNode(); cur; cur = walker.nextNode()) {
    texts.push(cur as Text);
  }

  if (root.nodeType === 1) {
    const el = root as Element;
    const candidates: Element[] = [el];
    const selector = TRANSLATABLE_ATTRS.map((a) => `[${a}]`).join(",");
    el.querySelectorAll(selector).forEach((c) => candidates.push(c));
    for (const c of candidates) {
      if (isSkippable(c)) continue;
      for (const a of TRANSLATABLE_ATTRS) {
        const v = c.getAttribute(a);
        if (v && hasLetters(v)) {
          attrEls.push(c);
          break;
        }
      }
    }
  }

  return { texts, attrEls };
}

class Engine {
  lang: LangCode = DEFAULT_LANG;

  private cache = new Map<string, string>(); // `${lang}::${source}` -> translation
  private pending = new Set<string>(); // `${lang}::${source}` in flight

  // Per-node bookkeeping. `orig` is the English source; `last` is the value we
  // most recently wrote, used to tell our own writes apart from genuine React
  // content changes.
  private origText = new WeakMap<Text, string>();
  private lastText = new WeakMap<Text, string>();
  private origAttr = new WeakMap<Element, Map<string, string>>();
  private touchedText = new Set<Text>();
  private touchedAttr = new Set<Element>();

  private observer: MutationObserver | null = null;
  private dirty = new Set<Node>();
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private applying = false;

  constructor(private onTranslating: (v: boolean) => void) {}

  // ── lifecycle ────────────────────────────────────────────────────────────
  hydrate(): void {
    try {
      const raw = localStorage.getItem(LS_CACHE);
      if (!raw) return;
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        for (const pair of arr) {
          if (Array.isArray(pair) && typeof pair[0] === "string" && typeof pair[1] === "string") {
            this.cache.set(pair[0], pair[1]);
          }
        }
      }
    } catch {
      /* ignore corrupt cache */
    }
  }

  start(): void {
    this.observer = new MutationObserver((m) => this.onMutations(m));
    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...TRANSLATABLE_ATTRS],
    });
  }

  stop(): void {
    this.observer?.disconnect();
    this.observer = null;
    if (this.flushTimer) clearTimeout(this.flushTimer);
    if (this.persistTimer) clearTimeout(this.persistTimer);
  }

  setHtml(lang: LangCode): void {
    const meta = LANG_BY_CODE[lang];
    document.documentElement.lang = lang;
    document.documentElement.dir = meta?.dir === "rtl" ? "rtl" : "ltr";
  }

  // ── switching ──────────────────────────────────────────────────────────────
  async switchTo(lang: LangCode): Promise<void> {
    this.lang = lang;
    this.setHtml(lang);
    if (lang === "en") {
      this.restoreAll();
      this.onTranslating(false);
      return;
    }
    this.onTranslating(true);
    try {
      await this.fullTranslate();
    } finally {
      this.onTranslating(false);
    }
  }

  fullTranslate(): Promise<void> {
    const { texts, attrEls } = collectFrom(document.body);
    return this.translateNodes(texts, attrEls);
  }

  // ── source resolution ──────────────────────────────────────────────────────
  private srcText(node: Text): string {
    const cur = node.nodeValue ?? "";
    const o = this.origText.get(node);
    if (o === undefined) {
      this.origText.set(node, cur);
      this.lastText.set(node, cur);
      this.touchedText.add(node);
      return cur;
    }
    // If the current value is neither the known English source nor the value we
    // last wrote, React changed the content for real — adopt it as the new
    // source so we translate the up-to-date text.
    const last = this.lastText.get(node);
    if (cur !== o && cur !== last) {
      this.origText.set(node, cur);
      return cur;
    }
    return o;
  }

  private srcAttrs(el: Element): Map<string, string> {
    let m = this.origAttr.get(el);
    if (!m) {
      m = new Map();
      this.origAttr.set(el, m);
      this.touchedAttr.add(el);
    }
    for (const a of TRANSLATABLE_ATTRS) {
      const v = el.getAttribute(a);
      if (v && hasLetters(v) && !m.has(a)) m.set(a, v);
    }
    return m;
  }

  // ── translate + apply ──────────────────────────────────────────────────────
  private async translateNodes(texts: Text[], attrEls: Element[]): Promise<void> {
    const lang = this.lang;
    if (lang === "en") return;

    const need = new Set<string>();

    const apply = () => {
      if (this.lang !== lang) return; // language changed mid-flight — abandon
      this.applying = true;
      for (const node of texts) {
        if (!node.isConnected) continue;
        const src = this.srcText(node);
        const tr = this.cache.get(`${lang}::${src}`);
        if (tr !== undefined) {
          if (node.nodeValue !== tr) node.nodeValue = tr;
          this.lastText.set(node, tr);
        }
      }
      for (const el of attrEls) {
        if (!el.isConnected) continue;
        const m = this.srcAttrs(el);
        for (const [attr, src] of m) {
          const tr = this.cache.get(`${lang}::${src}`);
          if (tr !== undefined && el.getAttribute(attr) !== tr) el.setAttribute(attr, tr);
        }
      }
      this.applying = false;
    };

    // Record sources + figure out what's missing from the cache.
    for (const node of texts) {
      const src = this.srcText(node);
      const key = `${lang}::${src}`;
      if (!this.cache.has(key) && !this.pending.has(key)) need.add(src);
    }
    for (const el of attrEls) {
      const m = this.srcAttrs(el);
      for (const src of m.values()) {
        const key = `${lang}::${src}`;
        if (!this.cache.has(key) && !this.pending.has(key)) need.add(src);
      }
    }

    apply(); // paint whatever is already cached, immediately

    if (need.size === 0) return;

    const list = [...need];
    for (const s of list) this.pending.add(`${lang}::${s}`);

    try {
      const batches: string[][] = [];
      for (let i = 0; i < list.length; i += FETCH_BATCH) {
        batches.push(list.slice(i, i + FETCH_BATCH));
      }
      await Promise.all(
        batches.map(async (batch) => {
          const res = await fetch("/api/translate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ q: batch, target: lang }),
          });
          if (!res.ok) return;
          const data = (await res.json()) as { t?: unknown };
          const t = Array.isArray(data.t) ? data.t : [];
          batch.forEach((s, i) => {
            if (typeof t[i] === "string") this.cache.set(`${lang}::${s}`, t[i] as string);
          });
        }),
      );
      this.persist();
    } catch (err) {
      console.error("[translate] fetch failed:", err);
    } finally {
      for (const s of list) this.pending.delete(`${lang}::${s}`);
    }

    apply(); // re-paint with freshly fetched translations
  }

  restoreAll(): void {
    this.applying = true;
    for (const node of this.touchedText) {
      if (!node.isConnected) continue;
      const o = this.origText.get(node);
      if (o !== undefined) {
        if (node.nodeValue !== o) node.nodeValue = o;
        this.lastText.set(node, o);
      }
    }
    for (const el of this.touchedAttr) {
      if (!el.isConnected) continue;
      const m = this.origAttr.get(el);
      if (m) for (const [attr, o] of m) if (el.getAttribute(attr) !== o) el.setAttribute(attr, o);
    }
    this.applying = false;
  }

  // ── observing dynamic content ──────────────────────────────────────────────
  private onMutations(muts: MutationRecord[]): void {
    if (this.lang === "en" || this.applying) return;
    for (const m of muts) {
      if (m.type === "characterData") {
        const t = m.target;
        if (t.nodeType === 3 && !isSkippable(t.parentNode)) this.dirty.add(t);
      } else if (m.type === "attributes") {
        const el = m.target;
        if (el.nodeType === 1 && !isSkippable(el)) this.dirty.add(el);
      } else if (m.type === "childList") {
        m.addedNodes.forEach((n) => {
          if (n.nodeType === 3) {
            if (!isSkippable(n.parentNode)) this.dirty.add(n);
          } else if (n.nodeType === 1) {
            this.dirty.add(n);
          }
        });
      }
    }
    if (this.dirty.size) this.scheduleFlush();
  }

  private scheduleFlush(): void {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.flush();
    }, FLUSH_MS);
  }

  private flush(): void {
    if (this.lang === "en") {
      this.dirty.clear();
      return;
    }
    const nodes = [...this.dirty];
    this.dirty.clear();

    const texts: Text[] = [];
    const attrEls: Element[] = [];
    const seenText = new Set<Text>();
    const seenAttr = new Set<Element>();

    for (const n of nodes) {
      if (!n.isConnected) continue;
      if (n.nodeType === 3) {
        const tn = n as Text;
        if (hasLetters(tn.nodeValue || "") && !isSkippable(tn.parentNode) && !seenText.has(tn)) {
          seenText.add(tn);
          texts.push(tn);
        }
      } else if (n.nodeType === 1) {
        const c = collectFrom(n);
        for (const t of c.texts) if (!seenText.has(t)) (seenText.add(t), texts.push(t));
        for (const e of c.attrEls) if (!seenAttr.has(e)) (seenAttr.add(e), attrEls.push(e));
      }
    }

    if (texts.length || attrEls.length) void this.translateNodes(texts, attrEls);
  }

  // ── persistence ────────────────────────────────────────────────────────────
  private persist(): void {
    if (this.persistTimer) return;
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      try {
        const entries = [...this.cache.entries()];
        const slice = entries.slice(Math.max(0, entries.length - CACHE_PERSIST_MAX));
        localStorage.setItem(LS_CACHE, JSON.stringify(slice));
      } catch {
        /* quota or serialization failure — cache stays in-memory only */
      }
    }, PERSIST_DEBOUNCE_MS);
  }
}

// ── React context ────────────────────────────────────────────────────────────
interface TranslateContextValue {
  lang: LangCode;
  setLang: (lang: LangCode) => void;
  translating: boolean;
}

const TranslateContext = createContext<TranslateContextValue>({
  lang: DEFAULT_LANG,
  setLang: () => {},
  translating: false,
});

export function useLang(): TranslateContextValue {
  return useContext(TranslateContext);
}

export function TranslationProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<LangCode>(DEFAULT_LANG);
  const [translating, setTranslating] = useState(false);
  const engineRef = useRef<Engine | null>(null);

  useEffect(() => {
    const engine = new Engine(setTranslating);
    engineRef.current = engine;
    engine.hydrate();
    engine.start();

    // Restore the visitor's saved language. We render English first (matching
    // the server) and translate after hydration, so there's no markup mismatch.
    let saved: LangCode = DEFAULT_LANG;
    try {
      const s = localStorage.getItem(LS_LANG);
      if (s && LANG_BY_CODE[s]) saved = s as LangCode;
    } catch {
      /* ignore */
    }
    if (saved !== DEFAULT_LANG) {
      setLangState(saved);
      engine.lang = saved;
      engine.setHtml(saved);
      requestAnimationFrame(() => {
        setTranslating(true);
        engine.fullTranslate().finally(() => setTranslating(false));
      });
    }

    return () => engine.stop();
  }, []);

  const setLang = (next: LangCode) => {
    setLangState(next);
    try {
      localStorage.setItem(LS_LANG, next);
    } catch {
      /* ignore */
    }
    void engineRef.current?.switchTo(next);
  };

  return (
    <TranslateContext.Provider value={{ lang, setLang, translating }}>
      {children}
    </TranslateContext.Provider>
  );
}
