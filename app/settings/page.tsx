"use client";

import { FormEvent, useEffect, useState } from "react";
import { requestJson } from "@/lib/http-client";

type StorageResponse = {
  dataDir: string;
  configFile?: string;
  message?: string;
};

export default function SettingsPage() {
  const [dataDir, setDataDir] = useState("");
  const [currentDir, setCurrentDir] = useState("");
  const [configFile, setConfigFile] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  useEffect(() => {
    void requestJson<StorageResponse>("/api/settings/storage")
      .then((res) => {
        setDataDir(res.dataDir);
        setCurrentDir(res.dataDir);
        setConfigFile(res.configFile ?? "");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "加载设置失败"));
  }, []);

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
      setInfo(result.message ?? "存储路径已更新");
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新存储路径失败");
    }
  }

  return (
    <>
      <section className="hero-card">
        <div>
          <h1>系统设置</h1>
          <p>可自定义数据存储目录，系统将自动保存 JSON / Excel 与快照到该目录。</p>
        </div>
      </section>

      {error ? <p className="error-banner">{error}</p> : null}
      {info ? <p className="info-banner">{info}</p> : null}

      <section className="grid-two">
        <article className="panel">
          <h2>数据存储位置</h2>
          <form className="stack-form" onSubmit={submitStorage}>
            <input
              value={dataDir}
              onChange={(event) => setDataDir(event.target.value)}
              placeholder="例如：D:\\BOMData"
              required
            />
            <button type="submit" className="btn-primary">保存路径</button>
          </form>
        </article>

        <article className="panel">
          <h2>当前状态</h2>
          <p className="muted">当前存储目录：{currentDir || "-"}</p>
          <p className="muted">配置文件：{configFile || "-"}</p>
          <p className="muted">该目录下会自动维护 `bom-data.json`、`exports`、`snapshots`。</p>
        </article>
      </section>
    </>
  );
}
