"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { confirmAnexoUpload, removeAnexo, requestAnexoUploadUrl } from "./anexo-actions";

interface AnexoExistente {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  descricao: string | null;
  createdAt: Date;
}

const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const MAX_SIZE = 10 * 1024 * 1024;

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function iconForMime(mime: string): string {
  if (mime === "application/pdf") return "📄";
  if (mime.startsWith("image/")) return "🖼️";
  return "📎";
}

export function AnexoUploader({
  cidadaoId,
  anexos,
  podeEditar,
}: {
  cidadaoId: string;
  anexos: AnexoExistente[];
  podeEditar: boolean;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        await uploadOne(file);
      }
    } finally {
      setUploading(false);
      setProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = "";
      router.refresh();
    }
  }

  async function uploadOne(file: File) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError(`"${file.name}": tipo não permitido. Aceitos: PDF, JPG, PNG.`);
      return;
    }
    if (file.size > MAX_SIZE) {
      setError(`"${file.name}": maior que 10MB.`);
      return;
    }

    // 1) Pede URL presigned
    const urlResult = await requestAnexoUploadUrl({
      cidadaoId,
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
    });
    if (!urlResult.ok) {
      setError(`"${file.name}": ${urlResult.error}`);
      return;
    }

    // 2) Upload direto pro MinIO
    setProgress(0);
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", urlResult.data.uploadUrl);
    xhr.setRequestHeader("Content-Type", file.type);
    await new Promise<void>((resolve, reject) => {
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
      });
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(`HTTP ${xhr.status}`));
      };
      xhr.onerror = () => reject(new Error("Erro de rede no upload"));
      xhr.send(file);
    }).catch((e) => {
      setError(`"${file.name}": ${e.message}`);
      throw e;
    });

    // 3) Confirma upload no server
    const confirmResult = await confirmAnexoUpload({
      cidadaoId,
      storageKey: urlResult.data.storageKey,
      fileName: file.name,
      mimeType: file.type,
    });
    if (!confirmResult.ok) {
      setError(`"${file.name}": ${confirmResult.error}`);
    }
  }

  function handleRemove(anexoId: string, fileName: string) {
    if (!confirm(`Remover "${fileName}"?`)) return;
    startTransition(async () => {
      const result = await removeAnexo(anexoId);
      if (!result.ok) {
        setError(result.error);
      } else {
        router.refresh();
      }
    });
  }

  const totalSize = anexos.reduce((sum, a) => sum + a.sizeBytes, 0);
  const totalPct = (totalSize / (100 * 1024 * 1024)) * 100;

  return (
    <div className="space-y-4">
      {podeEditar && (
        <div
          className="rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center transition hover:border-[rgb(var(--ifp-laranja))]"
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
          }}
          onDrop={(e) => {
            e.preventDefault();
            handleFiles(e.dataTransfer.files);
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
            multiple
            disabled={uploading}
            onChange={(e) => handleFiles(e.target.files)}
            className="hidden"
            id="anexo-input"
          />
          <label
            htmlFor="anexo-input"
            className={`inline-block cursor-pointer rounded bg-[rgb(var(--ifp-laranja))] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 ${
              uploading ? "pointer-events-none opacity-60" : ""
            }`}
          >
            {uploading ? "Enviando…" : "Escolher arquivos"}
          </label>
          <p className="mt-3 text-xs text-[rgb(var(--ifp-muted))]">
            ou arraste e solte aqui. PDF, JPG, PNG. Máximo 10MB por arquivo.
          </p>
          {uploading && progress > 0 && (
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded bg-slate-200">
              <div
                className="h-full rounded bg-[rgb(var(--ifp-laranja))] transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-[rgb(var(--ifp-muted))]">
        <span>
          {anexos.length} {anexos.length === 1 ? "arquivo" : "arquivos"}
        </span>
        <span>
          {formatSize(totalSize)} / 100 MB ({totalPct.toFixed(0)}%)
        </span>
      </div>

      {anexos.length > 0 && (
        <ul className="space-y-2">
          {anexos.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between gap-3 rounded border border-slate-200 bg-white px-4 py-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="text-2xl">{iconForMime(a.mimeType)}</span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[rgb(var(--ifp-ink))]">
                    {a.fileName}
                  </p>
                  <p className="text-xs text-[rgb(var(--ifp-muted))]">
                    {formatSize(a.sizeBytes)} •{" "}
                    {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(a.createdAt)}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <a
                  href={`/api/cidadao-anexo/${a.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded border border-slate-300 px-3 py-1 text-xs text-slate-700 transition hover:bg-slate-50"
                >
                  Abrir
                </a>
                {podeEditar && (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleRemove(a.id, a.fileName)}
                    className="rounded border border-red-200 px-3 py-1 text-xs text-red-700 transition hover:bg-red-50 disabled:opacity-60"
                  >
                    Remover
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
