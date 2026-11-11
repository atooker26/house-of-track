"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/lib/admin/auth";
import { setProductImages } from "@/lib/admin/actions/catalog";
import { createClient, MEDIA_BUCKET } from "@/lib/supabase/client";
import Msg from "./Msg";

const ACCEPT = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX_BYTES = 10 * 1024 * 1024; // matches the bucket's limit (supabase/admin.sql)
const MAX_PHOTOS = 12;

/**
 * Uploads go straight from the browser to the public `media` bucket with the
 * admin's own session (storage policies check public.is_admin()), then the
 * ordered list of URLs is saved on the product. First photo = the cover.
 */
export default function Photos({ productId, images }: { productId: number; images: string[] }) {
  const router = useRouter();
  const [list, setList] = useState(images);
  const [busy, setBusy] = useState(false);
  const [r, setR] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();

  function save(next: string[]) {
    setList(next);
    start(async () => {
      setR(await setProductImages(productId, next));
      router.refresh();
    });
  }

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setR(null);
    const picked = Array.from(files).slice(0, MAX_PHOTOS - list.length);
    for (const f of picked) {
      if (!ACCEPT.includes(f.type))
        return setR({ ok: false, error: `${f.name}: use JPEG, PNG or WebP. iPhone photos: Share → Options → Most Compatible.` });
      if (f.size > MAX_BYTES) return setR({ ok: false, error: `${f.name} is over 10 MB. Export a smaller JPEG.` });
    }
    setBusy(true);
    const sb = createClient();
    const urls: string[] = [];
    try {
      for (const f of picked) {
        const ext = (f.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
        const path = `products/${productId}/${crypto.randomUUID()}.${ext}`;
        const { error } = await sb.storage.from(MEDIA_BUCKET).upload(path, f, { cacheControl: "31536000", contentType: f.type });
        if (error) throw error;
        urls.push(sb.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl);
      }
    } catch (e) {
      setBusy(false);
      return setR({ ok: false, error: `Upload failed: ${e instanceof Error ? e.message : "try again"}` });
    }
    setBusy(false);
    save([...list, ...urls]);
  }

  const move = (i: number, d: -1 | 1) => {
    const next = [...list];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    save(next);
  };

  return (
    <div className="adm-form">
      <div className="adm-photos">
        {list.map((src, i) => (
          <div key={src} className="adm-photo">
            <img src={src} alt={`Photo ${i + 1}`} />
            {i === 0 && <span className="cover">Cover</span>}
            <div className="tools">
              <span style={{ display: "flex", gap: 4 }}>
                <button type="button" aria-label="Move left" disabled={i === 0 || pending} onClick={() => move(i, -1)}>
                  ←
                </button>
                <button type="button" aria-label="Move right" disabled={i === list.length - 1 || pending} onClick={() => move(i, 1)}>
                  →
                </button>
              </span>
              <button type="button" disabled={pending} onClick={() => save(list.filter((_, j) => j !== i))}>
                Remove
              </button>
            </div>
          </div>
        ))}
        {list.length < MAX_PHOTOS && (
          <label className="adm-drop" style={{ position: "relative" }}>
            <input type="file" accept={ACCEPT.join(",")} multiple disabled={busy} onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }} />
            <span>{busy ? "Uploading…" : "+ Add photos"}<br /><span className="adm-sub">JPEG, PNG, WebP · 10 MB</span></span>
          </label>
        )}
      </div>
      <span className="adm-sub">Square photos look best. The first one is the cover on /shop and in TEGO emails.</span>
      <Msg r={r} />
    </div>
  );
}
