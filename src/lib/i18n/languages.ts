// Conviqt Translate — language registry.
//
// English is the canonical language the app is authored in. Every other
// language is produced at runtime by the translation engine
// (see components/i18n/TranslationProvider) which proxies through
// /api/translate. Adding a language here is enough to surface it in the
// switcher and make it translatable end-to-end.

export type LangCode = "en" | "zh" | "hi" | "es" | "de" | "fr" | "ar";

export interface Language {
  /** Internal code — stored in localStorage and on <html lang>. */
  code: LangCode;
  /** Google Translate target code. */
  google: string;
  /** English name of the language. */
  label: string;
  /** Endonym, shown in its own script so it reads natively in any UI language. */
  native: string;
  /** Writing direction. Arabic is the only RTL language we ship. */
  dir: "ltr" | "rtl";
}

export const DEFAULT_LANG: LangCode = "en";

export const LANGUAGES: Language[] = [
  { code: "en", google: "en",    label: "English",  native: "English",   dir: "ltr" },
  { code: "zh", google: "zh-CN", label: "Mandarin", native: "中文",        dir: "ltr" },
  { code: "hi", google: "hi",    label: "Hindi",    native: "हिन्दी",      dir: "ltr" },
  { code: "es", google: "es",    label: "Spanish",  native: "Español",   dir: "ltr" },
  { code: "de", google: "de",    label: "German",   native: "Deutsch",   dir: "ltr" },
  { code: "fr", google: "fr",    label: "French",   native: "Français",  dir: "ltr" },
  { code: "ar", google: "ar",    label: "Arabic",   native: "العربية",    dir: "rtl" },
];

export const LANG_BY_CODE: Record<string, Language> = Object.fromEntries(
  LANGUAGES.map((l) => [l.code, l]),
);

/** Map an internal code to its Google Translate target. Falls back to English. */
export function googleCodeFor(code: string): string {
  return LANG_BY_CODE[code]?.google ?? "en";
}
