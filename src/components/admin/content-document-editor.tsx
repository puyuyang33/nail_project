"use client";

import { useState } from "react";
import type { ContentPage } from "@/data/content";

export function ContentDocumentEditor({
  contentKey,
  initialPage,
  initialVersion,
  initialPublished,
  source,
  configured,
}: {
  contentKey: string;
  initialPage: ContentPage;
  initialVersion: number;
  initialPublished: boolean;
  source: "static" | "mongodb";
  configured: boolean;
}) {
  const [json, setJson] = useState(() => JSON.stringify(initialPage, null, 2));
  const [version, setVersion] = useState(initialVersion);
  const [published, setPublished] = useState(initialPublished);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");

  async function save() {
    setStatus("saving");
    setMessage("");
    let page: unknown;
    try {
      page = JSON.parse(json);
    } catch {
      setStatus("error");
      setMessage("The document is not valid JSON.");
      return;
    }
    const response = await fetch(
      `/api/admin/content/${contentKey
        .split("/")
        .map(encodeURIComponent)
        .join("/")}`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expectedVersion: version,
          published,
          page,
        }),
      },
    );
    const result = (await response.json()) as {
      version?: number;
      error?: string;
      warning?: string;
    };
    if (!response.ok || result.version === undefined) {
      setStatus("error");
      setMessage(result.error ?? "The document could not be saved.");
      return;
    }
    setVersion(result.version);
    setStatus("saved");
    setMessage(result.warning ?? "Saved to MongoDB.");
  }

  return (
    <div className="bg-porcelain border border-black/15 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="eyebrow text-black/45">
            Source: {source} · Version {version}
          </p>
          {!configured && (
            <p className="text-wine mt-2 text-sm">
              MongoDB is disabled. Configure it before saving.
            </p>
          )}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={published}
            onChange={(event) => setPublished(event.target.checked)}
            className="accent-wine"
          />
          Published
        </label>
      </div>
      <label className="mt-6 block">
        <span className="field-label">Versioned content document</span>
        <textarea
          value={json}
          onChange={(event) => setJson(event.target.value)}
          spellCheck={false}
          className="field min-h-[34rem] font-mono text-xs leading-6"
        />
      </label>
      <div className="mt-5 flex items-center gap-4">
        <button
          type="button"
          className="button-primary"
          onClick={() => void save()}
          disabled={!configured || status === "saving"}
        >
          {status === "saving" ? "Saving…" : "Save document"}
        </button>
        <p
          className={`text-sm ${status === "error" ? "text-wine" : "text-black/55"}`}
          role="status"
        >
          {message}
        </p>
      </div>
    </div>
  );
}
