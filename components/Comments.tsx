"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client";
import { timeAgo } from "@/lib/format";
import type { CommentPage } from "@/lib/youtube";

type Props = {
  videoId: string | null;
  title: string | null;
  onClose: () => void;
};

// Pages already fetched this session, so flipping between videos doesn't spend quota again.
const cache = new Map<string, CommentPage>();

const compact = (n: number) => Intl.NumberFormat(undefined, { notation: "compact" }).format(n);

// Read-only comment thread for whatever is loaded in the CRT; scrolls on its own beside the column.
export default function Comments({ videoId, title, onClose }: Props) {
  const [page, setPage] = useState<CommentPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setError("");
    listRef.current?.scrollTo({ top: 0 });
    if (!videoId) return setPage(null);
    const hit = cache.get(videoId);
    if (hit) return setPage(hit);
    let cancelled = false;
    setPage(null);
    setLoading(true);
    api<CommentPage>(`/api/comments?v=${videoId}`, "GET")
      .then((p) => {
        cache.set(videoId, p);
        if (!cancelled) setPage(p);
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [videoId]);

  async function more() {
    if (!videoId || !page?.next || loading) return;
    setLoading(true);
    try {
      const p = await api<CommentPage>(`/api/comments?v=${videoId}&page=${encodeURIComponent(page.next)}`, "GET");
      const merged = { ...p, comments: [...page.comments, ...p.comments] };
      cache.set(videoId, merged);
      setPage(merged);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <aside className="comments" aria-label="Comments">
      <div className="stack-head">
        <span className="stack-title">COMMENTS</span>
        {page && !page.disabled && (
          <span className="count mono">
            {page.comments.length}
            {page.next ? "+" : ""}
          </span>
        )}
        <button className="ckey fold" onClick={onClose} aria-label="Close comments" title="Close">
          ✕
        </button>
      </div>
      {title && <div className="comments-np mono">{title.toUpperCase()}</div>}
      <div ref={listRef} className="comments-well">
        {!videoId ? (
          <div className="empty">Nothing in the CRT.</div>
        ) : page?.disabled ? (
          <div className="empty">Comments are off for this video.</div>
        ) : (
          <>
            {page?.comments.map((c) => (
              <div key={c.id} className="cmt">
                <img className="cmt-avatar" src={c.avatar} alt="" width={28} height={28} loading="lazy" referrerPolicy="no-referrer" />
                <div className="cmt-body">
                  <div className="cmt-meta">
                    <span className="cmt-author">{c.author}</span>
                    <span className="cmt-age">{timeAgo(c.published)}</span>
                  </div>
                  <p className="cmt-text">{c.text}</p>
                  <div className="cmt-meta">
                    <span>▲ {compact(c.likes)}</span>
                    {c.replies > 0 && (
                      <a href={`https://www.youtube.com/watch?v=${videoId}&lc=${c.id}`} target="_blank" rel="noreferrer">
                        {c.replies} {c.replies === 1 ? "reply" : "replies"}
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {page && page.comments.length === 0 && <div className="empty">No comments yet.</div>}
            {loading && <div className="empty">Loading…</div>}
            {error && <div className="empty">Couldn&apos;t load comments: {error}</div>}
            {page?.next && !loading && (
              <button className="ckey cmt-more" onClick={more}>
                LOAD MORE
              </button>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
