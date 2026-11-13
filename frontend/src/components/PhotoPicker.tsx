"use client";

import { useEffect, useState } from "react";
import { ImagePlus, X } from "lucide-react";

const MAX_MB = 8;

export function PhotoPicker({
  files,
  onChange,
  max = 10,
  label = "Photos",
}: {
  files: File[];
  onChange: (f: File[]) => void;
  max?: number;
  label?: string;
}) {
  const [previews, setPreviews] = useState<string[]>([]);
  const [warning, setWarning] = useState<string | null>(null);

  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- object URLs must be created/revoked with the files
    setPreviews(urls);
    return () => urls.forEach(URL.revokeObjectURL);
  }, [files]);

  function add(list: FileList | null) {
    if (!list) return;
    const picked = Array.from(list);
    const ok = picked.filter((f) => /^image\/(jpeg|png|webp)$/.test(f.type) && f.size <= MAX_MB * 1024 * 1024);
    setWarning(ok.length < picked.length ? `Skipped files that aren't JPEG, PNG or WebP under ${MAX_MB} MB.` : null);
    onChange([...files, ...ok].slice(0, max));
  }

  return (
    <div>
      <span className="label">{label}</span>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {previews.map((src, i) => (
          <div key={src} className="relative aspect-square overflow-hidden rounded-md border border-curb">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={`Selected photo ${i + 1}`} className="size-full object-cover" />
            <button
              type="button"
              onClick={() => onChange(files.filter((_, j) => j !== i))}
              className="absolute top-1 right-1 rounded-full bg-asphalt/80 p-1 text-plate hover:bg-asphalt"
              aria-label={`Remove photo ${i + 1}`}
            >
              <X size={14} />
            </button>
          </div>
        ))}
        {files.length < max && (
          <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-curb text-sm text-gravel hover:border-asphalt hover:text-asphalt focus-within:outline focus-within:outline-3 focus-within:outline-lane">
            <ImagePlus size={22} />
            Add
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="sr-only"
              onChange={(e) => {
                add(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
        )}
      </div>
      {warning && <p className="mt-2 text-sm text-caution">{warning}</p>}
    </div>
  );
}
