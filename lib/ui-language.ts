"use client";

import { useEffect, useState } from "react";

export type UiLang = "zh" | "en";

const LANG_KEY = "bom-manager-lang";
const LANGUAGE_CHANGED_EVENT = "bom-manager-preferences";

export function getUiLang(): UiLang {
  if (typeof window === "undefined") {
    return "zh";
  }
  return window.localStorage.getItem(LANG_KEY) === "en" ? "en" : "zh";
}

export function useUiLang() {
  const [lang, setLang] = useState<UiLang>(getUiLang);

  useEffect(() => {
    const sync = () => setLang(getUiLang());
    sync();

    const onStorage = (event: StorageEvent) => {
      if (event.key === LANG_KEY) {
        sync();
      }
    };
    const onPreferenceChanged = () => sync();

    window.addEventListener("storage", onStorage);
    window.addEventListener(LANGUAGE_CHANGED_EVENT, onPreferenceChanged);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(LANGUAGE_CHANGED_EVENT, onPreferenceChanged);
    };
  }, []);

  return lang;
}

export function tr(lang: UiLang, zh: string, en: string) {
  return lang === "en" ? en : zh;
}
