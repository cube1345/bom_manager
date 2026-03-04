"use client";

import { FormEvent, useEffect, useState } from "react";
import { requestJson } from "@/lib/http-client";

type StorageResponse = {
  dataDir: string;
  configFile?: string;
  message?: string;
};

function getInitialLang(): "zh" | "en" {
  if (typeof window === "undefined") {
    return "zh";
  }
  return window.localStorage.getItem("bom-manager-lang") === "en" ? "en" : "zh";
}

function getInitialTheme(): "light" | "dark" {
  if (typeof window === "undefined") {
    return "light";
  }
  return window.localStorage.getItem("bom-manager-theme") === "dark" ? "dark" : "light";
}

export default function SettingsPage() {
  const [lang, setLang] = useState<"zh" | "en">(getInitialLang);
  const [theme, setTheme] = useState<"light" | "dark">(getInitialTheme);
  const [dataDir, setDataDir] = useState("");
  const [currentDir, setCurrentDir] = useState("");
  const [configFile, setConfigFile] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const text =
    lang === "en"
      ? {
          title: "System Settings",
          desc: "Customize data directory and UI preferences.",
          storeTitle: "Data Storage",
          savePath: "Save Path",
          statusTitle: "Current Status",
          currentDirLabel: "Current data directory:",
          configFileLabel: "Config file:",
          hint: "This directory stores `bom-data.json`, `exports`, and `snapshots`.",
          langTitle: "Language",
          themeTitle: "Theme",
          languageLabel: "Interface language",
          themeLabel: "Color theme",
          zh: "Chinese",
          en: "English",
          light: "Light",
          dark: "Dark",
          loadedError: "Failed to load settings",
          updateError: "Failed to update data path",
          updateOk: "Data path updated",
          prefsSaved: "Language and theme preferences saved",
          dataDirPlaceholder: "For example: D:\\BOMData",
        }
      : {
          title: "系统设置",
          desc: "可自定义数据存储目录，并配置界面语言与主题。",
          storeTitle: "数据存储位置",
          savePath: "保存路径",
          statusTitle: "当前状态",
          currentDirLabel: "当前存储目录：",
          configFileLabel: "配置文件：",
          hint: "该目录下会自动维护 `bom-data.json`、`exports`、`snapshots`。",
          langTitle: "语言设置",
          themeTitle: "主题设置",
          languageLabel: "界面语言",
          themeLabel: "颜色主题",
          zh: "中文",
          en: "英文",
          light: "亮色",
          dark: "暗色",
          loadedError: "加载设置失败",
          updateError: "更新存储路径失败",
          updateOk: "存储路径已更新",
          prefsSaved: "语言与主题偏好已保存",
          dataDirPlaceholder: "例如：D:\\BOMData",
        };

  useEffect(() => {
    document.documentElement.lang = lang === "en" ? "en-US" : "zh-CN";
    document.documentElement.setAttribute("data-theme", theme);
  }, [lang, theme]);

  useEffect(() => {
    void requestJson<StorageResponse>("/api/settings/storage")
      .then((res) => {
        setDataDir(res.dataDir);
        setCurrentDir(res.dataDir);
        setConfigFile(res.configFile ?? "");
      })
      .catch((err) => setError(err instanceof Error ? err.message : text.loadedError));
  }, [text.loadedError]);

  async function submitStorage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setInfo("");
    try {
      const result = await requestJson<StorageResponse>("/api/settings/storage", {
        method: "POST",
        body: JSON.stringify({ dataDir }),
      });
      setCurrentDir(result.dataDir);
      setInfo(result.message ?? text.updateOk);
    } catch (err) {
      setError(err instanceof Error ? err.message : text.updateError);
    }
  }

  function applyLanguage(nextLang: "zh" | "en") {
    setLang(nextLang);
    window.localStorage.setItem("bom-manager-lang", nextLang);
    document.documentElement.lang = nextLang === "en" ? "en-US" : "zh-CN";
    window.dispatchEvent(new CustomEvent("bom-manager-preferences"));
    setInfo(text.prefsSaved);
    setError("");
  }

  function applyTheme(nextTheme: "light" | "dark") {
    setTheme(nextTheme);
    window.localStorage.setItem("bom-manager-theme", nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
    setInfo(text.prefsSaved);
    setError("");
  }

  return (
    <>
      <section className="hero-card">
        <div>
          <h1>{text.title}</h1>
          <p>{text.desc}</p>
        </div>
      </section>

      {error ? <p className="error-banner">{error}</p> : null}
      {info ? <p className="info-banner">{info}</p> : null}

      <section className="grid-two">
        <article className="panel">
          <h2>{text.storeTitle}</h2>
          <form className="stack-form" onSubmit={submitStorage}>
            <div className="form-field">
              <div className="field-head">
                <label className="field-label" htmlFor="settings-data-dir">
                  {lang === "en" ? "Data Directory:" : "数据存储目录："}
                </label>
                <span className="field-required" aria-hidden="true">
                  *
                </span>
              </div>
              <input
                id="settings-data-dir"
                value={dataDir}
                onChange={(event) => setDataDir(event.target.value)}
                placeholder={text.dataDirPlaceholder}
                required
              />
            </div>
            <button type="submit" className="btn-primary">{text.savePath}</button>
          </form>
        </article>

        <article className="panel">
          <h2>{text.statusTitle}</h2>
          <p className="muted">
            {text.currentDirLabel}
            {currentDir || "-"}
          </p>
          <p className="muted">
            {text.configFileLabel}
            {configFile || "-"}
          </p>
          <p className="muted">{text.hint}</p>
        </article>
      </section>

      <section className="grid-two">
        <article className="panel">
          <h2>{text.langTitle}</h2>
          <label className="muted">{text.languageLabel}</label>
          <div className="inline-actions">
            <button
              type="button"
              className={lang === "zh" ? "btn-primary" : "btn-ghost"}
              onClick={() => applyLanguage("zh")}
            >
              {text.zh}
            </button>
            <button
              type="button"
              className={lang === "en" ? "btn-primary" : "btn-ghost"}
              onClick={() => applyLanguage("en")}
            >
              {text.en}
            </button>
          </div>
        </article>

        <article className="panel">
          <h2>{text.themeTitle}</h2>
          <label className="muted">{text.themeLabel}</label>
          <div className="inline-actions">
            <button
              type="button"
              className={theme === "light" ? "btn-primary" : "btn-ghost"}
              onClick={() => applyTheme("light")}
            >
              {text.light}
            </button>
            <button
              type="button"
              className={theme === "dark" ? "btn-primary" : "btn-ghost"}
              onClick={() => applyTheme("dark")}
            >
              {text.dark}
            </button>
          </div>
        </article>
      </section>
    </>
  );
}
