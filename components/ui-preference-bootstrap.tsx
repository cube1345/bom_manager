"use client";

import { useEffect } from "react";

export default function UiPreferenceBootstrap() {
  useEffect(() => {
    const savedLang = window.localStorage.getItem("bom-manager-lang");
    const lang = savedLang === "en" ? "en-US" : "zh-CN";
    document.documentElement.lang = lang;

    const savedTheme = window.localStorage.getItem("bom-manager-theme");
    const theme = savedTheme === "dark" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", theme);
  }, []);

  return null;
}
