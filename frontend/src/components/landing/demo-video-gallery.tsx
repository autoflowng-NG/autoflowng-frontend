/**
 * DemoVideoGallery — landing-page multi-video demo gallery.
 *
 * Fetches published videos from GET /api/public/demo-videos (via React Query,
 * 5-minute staleTime) and renders a category tab bar (All / Getting Started /
 * Affiliate Marketing / Workflows / Integrations / Advanced) filtering a
 * responsive grid of thumbnail cards. Clicking a card opens a modal player
 * that detects mp4 vs YouTube/Vimeo URLs and renders <video> or <iframe>
 * accordingly. Replaces the old single "Watch Demo" button in cta-section.tsx.
 */

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { publicAPI } from "@/lib/api";
import { queryKeys } from "@/lib/queryClient";

interface DemoVideo {
  id: number;
  video_url: string;
  thumbnail_url?: string | null;
  title?: string | null;
  description?: string | null;
  category?: string | null;
}

const CATEGORY_TABS: { value: string; label: string }[] = [
  { value: "all",                  label: "All" },
  { value: "getting_started",      label: "Getting Started" },
  { value: "affiliate_marketing",  label: "Affiliate Marketing" },
  { value: "workflows",            label: "Workflows" },
  { value: "integrations",         label: "Integrations" },
  { value: "advanced",             label: "Advanced" },
];

function PlayIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20">
      <path d="M6.3 2.84A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.27l9.34-5.89a1.5 1.5 0 000-2.54L6.3 2.84z" />
    </svg>
  );
}

/** True if the URL looks like a hosted video file (mp4/webm/mov/…) rather than an embed page. */
function isDirectVideoFile(url: string): boolean {
  return /\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i.test(url);
}

/** Converts a YouTube/Vimeo watch/share URL into its embeddable iframe URL. Falls back to the raw URL. */
function toEmbedUrl(url: string): string {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]+)/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}?autoplay=1`;
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}?autoplay=1`;
  return url;
}

export function DemoVideoGallery() {
  const [category, setCategory] = useState("all");
  const [active, setActive] = useState<DemoVideo | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.demoVideosPublic,
    queryFn: () => publicAPI.demoVideos(),
    staleTime: 5 * 60 * 1000,
  });

  const videos: DemoVideo[] = (data as any)?.videos || [];

  const filtered = useMemo(
    () => (category === "all" ? videos : videos.filter(v => v.category === category)),
    [videos, category]
  );

  if (isLoading) return null;

  if (videos.length === 0) {
    return (
      <div className="flex items-center justify-center">
        <button
          disabled
          className="h-14 px-8 text-base rounded-full border border-primary/20 text-foreground/50 flex items-center gap-2 cursor-not-allowed"
        >
          <PlayIcon className="w-5 h-5" />
          Videos coming soon
        </button>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
          {CATEGORY_TABS.map(t => (
            <button
              key={t.value}
              onClick={() => setCategory(t.value)}
              className={`px-4 py-1.5 text-sm rounded-full border transition-all ${
                category === t.value
                  ? "border-primary bg-primary/10 text-primary font-medium"
                  : "border-white/10 text-foreground/60 hover:border-white/25 hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center text-sm text-foreground/50 py-10">Videos coming soon</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map(v => (
            <button
              key={v.id}
              onClick={() => setActive(v)}
              className="group relative text-left rounded-xl overflow-hidden border border-white/10 hover:border-primary/40 transition-all bg-white/[0.02]"
            >
              <div className="relative aspect-video w-full bg-black/40">
                {v.thumbnail_url ? (
                  <img src={v.thumbnail_url} alt={v.title || "Demo video"} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <PlayIcon className="w-8 h-8 text-white/30" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <PlayIcon className="w-8 h-8 text-white" />
                </div>
              </div>
              {(v.title || v.description) && (
                <div className="p-3">
                  {v.title && <h3 className="font-display text-sm mb-1 truncate">{v.title}</h3>}
                  {v.description && (
                    <p className="text-xs text-white/50 line-clamp-2">{v.description}</p>
                  )}
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {active && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          onClick={() => setActive(null)}
        >
          <div
            className="relative w-full max-w-5xl bg-background rounded-2xl overflow-hidden shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setActive(null)}
              className="absolute top-3 right-3 z-10 text-white/70 hover:text-foreground"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="aspect-video w-full bg-black">
              {isDirectVideoFile(active.video_url) ? (
                <video key={active.id} src={active.video_url} controls autoPlay className="w-full h-full" />
              ) : (
                <iframe
                  key={active.id}
                  src={toEmbedUrl(active.video_url)}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              )}
            </div>
            {(active.title || active.description) && (
              <div className="p-5 border-t border-white/10">
                {active.title && <h3 className="font-display text-lg mb-1">{active.title}</h3>}
                {active.description && <p className="text-sm text-white/60">{active.description}</p>}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
