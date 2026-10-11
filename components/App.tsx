"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { matchesRules } from "@/lib/format";
import type { AppState, Group, Video } from "@/lib/types";
import ChannelsView from "./ChannelsView";
import LaterView from "./LaterView";
import QueueBar from "./QueueBar";
import VideoCard from "./VideoCard";

type Tab = "feed" | "later" | "channels";

const STALE_MS = 30 * 60 * 1000; // auto-refresh on load if the cache is older than this
const PAGE = 60;

// localStorage can throw (private mode, blocked storage), and the app must work without it.
function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

async function api<T = unknown>(path: string, method = "POST", body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`);
  return data as T;
}

export default function App() {
  const [state, setState] = useState<AppState | null>(null);
  const [tab, setTab] = useState<Tab>("feed");
  const [groupId, setGroupId] = useState("all");
  const [hideWatched, setHideWatched] = useState(true);
  const [hideShorts, setHideShorts] = useState(true);
  const [queue, setQueue] = useState<Video[]>([]);
  const [limit, setLimit] = useState(PAGE);
  const [refreshing, setRefreshing] = useState(false);
  const [status, setStatus] = useState("");
  const restored = useRef(false);

  const loadState = useCallback(async () => {
    const s = await api<AppState>("/api/state", "GET");
    setState(s);
    return s;
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setStatus("Fetching feeds…");
    try {
      const r = await api<{ channels: number; failed: string[] }>("/api/refresh");
      await loadState();
      setStatus(
        r.failed.length
          ? `Updated ${r.channels - r.failed.length} of ${r.channels} channels. Failed: ${r.failed.slice(0, 3).join(", ")}${r.failed.length > 3 ? "…" : ""}`
          : "",
      );
    } catch (err) {
      setStatus(`Refresh failed: ${(err as Error).message}`);
    } finally {
      setRefreshing(false);
    }
  }, [loadState]);

  // Initial load: restore local prefs, fetch cached state, refresh if stale.
  useEffect(() => {
    setQueue(load("mt:queue", []));
    setHideWatched(load("mt:hideWatched", true));
    setHideShorts(load("mt:hideShorts", true));
    setGroupId(load("mt:group", "all"));
    restored.current = true;
    loadState()
      .then((s) => {
        if (s.channels.length && (!s.lastRefresh || Date.now() - s.lastRefresh > STALE_MS)) refresh();
      })
      .catch((err) => setStatus(`Could not load: ${err.message}`));
  }, [loadState, refresh]);

  useEffect(() => {
    if (!restored.current) return;
    save("mt:queue", queue);
    save("mt:hideWatched", hideWatched);
    save("mt:hideShorts", hideShorts);
    save("mt:group", groupId);
  }, [queue, hideWatched, hideShorts, groupId]);

  const watched = useMemo(() => new Set(state?.watched ?? []), [state?.watched]);
  const laterIds = useMemo(() => new Set(state?.later.map((v) => v.id) ?? []), [state?.later]);
  const queuePos = useMemo(() => new Map(queue.map((v, i) => [v.id, i + 1])), [queue]);

  const activeGroup = state?.groups.find((g) => g.id === groupId) ?? null;
  const feed = useMemo(() => {
    if (!state) return [];
    const members = activeGroup ? new Set(activeGroup.channelIds) : null;
    return state.videos.filter(
      (v) =>
        (!members || (members.has(v.channelId) && matchesRules(v, activeGroup!.rules))) &&
        (!hideWatched || !watched.has(v.id)) &&
        (!hideShorts || !v.isShort),
    );
  }, [state, activeGroup, hideWatched, hideShorts, watched]);

  useEffect(() => setLimit(PAGE), [groupId, hideWatched, hideShorts]);

  // Mutations update local state first, then sync. On failure, reload from the server.
  const sync = (p: Promise<unknown>) =>
    p.catch((err) => {
      setStatus(`Couldn't save: ${err.message}`);
      loadState().catch(() => {});
    });

  function toggleQueue(v: Video) {
    setQueue((q) => (q.some((x) => x.id === v.id) ? q.filter((x) => x.id !== v.id) : [...q, v]));
  }

  function setWatched(ids: string[], on: boolean) {
    setState((s) =>
      s && {
        ...s,
        watched: on ? [...new Set([...s.watched, ...ids])] : s.watched.filter((id) => !ids.includes(id)),
        later: on ? s.later.filter((v) => !ids.includes(v.id)) : s.later,
      },
    );
    sync(api("/api/watched", "POST", { ids, watched: on }));
  }

  function toggleLater(v: Video) {
    if (laterIds.has(v.id)) return removeLater([v.id]);
    setState((s) => s && { ...s, later: [...s.later, { ...v, addedAt: Date.now() }] });
    sync(api("/api/later", "POST", { action: "add", videos: [v] }));
  }

  function removeLater(ids: string[]) {
    setState((s) => s && { ...s, later: s.later.filter((v) => !ids.includes(v.id)) });
    sync(api("/api/later", "POST", { action: "remove", ids }));
  }

  function moveLaterToQueue(items: Video[]) {
    setQueue((q) => [...q, ...items.filter((v) => !q.some((x) => x.id === v.id))]);
    removeLater(items.map((v) => v.id));
  }

  function moveInQueue(index: number, delta: number) {
    setQueue((q) => {
      const next = [...q];
      const [item] = next.splice(index, 1);
      next.splice(index + delta, 0, item);
      return next;
    });
  }

  function saveGroups(groups: Group[]) {
    setState((s) => s && { ...s, groups });
    sync(api("/api/groups", "PUT", { groups }));
  }

  async function importCsv(csv: string): Promise<string> {
    try {
      const r = await api<{ found: number; added: number }>("/api/import", "POST", { csv });
      await loadState();
      if (r.added > 0) refresh();
      return `Found ${r.found} channels, ${r.added} new.`;
    } catch (err) {
      return (err as Error).message;
    }
  }

  function removeChannel(id: string) {
    setState(
      (s) =>
        s && {
          ...s,
          channels: s.channels.filter((c) => c.id !== id),
          videos: s.videos.filter((v) => v.channelId !== id),
          groups: s.groups.map((g) => ({ ...g, channelIds: g.channelIds.filter((c) => c !== id) })),
        },
    );
    sync(api(`/api/channels?id=${encodeURIComponent(id)}`, "DELETE"));
  }

  const lastRefresh = state?.lastRefresh
    ? new Date(state.lastRefresh).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <span className="brand-dot" />
            Moodtube
          </div>
          <nav className="tabs">
            <button className={`tab${tab === "feed" ? " active" : ""}`} onClick={() => setTab("feed")}>
              Feed
            </button>
            <button className={`tab${tab === "later" ? " active" : ""}`} onClick={() => setTab("later")}>
              Later
              {state && state.later.length > 0 && <span className="count">{state.later.length}</span>}
            </button>
            <button className={`tab${tab === "channels" ? " active" : ""}`} onClick={() => setTab("channels")}>
              Channels
            </button>
          </nav>
          <div className="topbar-actions">
            <button className="btn sm" onClick={refresh} disabled={refreshing || !state?.channels.length}>
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
            <form action="/api/logout" method="post">
              <button className="btn ghost sm" type="submit">
                Log out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="shell">
        {!state ? (
          <div className="empty">{status || "Loading…"}</div>
        ) : tab === "feed" ? (
          state.channels.length === 0 ? (
            <div className="empty">
              <h2>No channels yet</h2>
              <p>Import your subscriptions.csv from Google Takeout to get started.</p>
              <button className="btn primary" onClick={() => setTab("channels")}>
                Import subscriptions
              </button>
            </div>
          ) : (
            <>
              <div className="toolbar">
                <div className="chips">
                  <button className={`chip${!activeGroup ? " active" : ""}`} onClick={() => setGroupId("all")}>
                    All
                  </button>
                  {state.groups.map((g) => (
                    <button
                      key={g.id}
                      className={`chip${activeGroup?.id === g.id ? " active" : ""}`}
                      onClick={() => setGroupId(g.id)}
                    >
                      {g.name}
                    </button>
                  ))}
                </div>
                <div className="toggles">
                  <label className="toggle">
                    <input type="checkbox" checked={hideShorts} onChange={(e) => setHideShorts(e.target.checked)} />
                    Hide Shorts
                  </label>
                  <label className="toggle">
                    <input type="checkbox" checked={hideWatched} onChange={(e) => setHideWatched(e.target.checked)} />
                    Hide watched
                  </label>
                </div>
              </div>
              <p className="status" style={{ margin: "0 0 16px" }}>
                {status || (
                  <>
                    {feed.length} videos{lastRefresh && ` · updated ${lastRefresh}`}
                    {" · "}tap a thumbnail to queue it
                  </>
                )}
              </p>
              {feed.length === 0 ? (
                <div className="empty">
                  <h2>All caught up</h2>
                  <p>
                    {state.videos.length === 0
                      ? "Hit Refresh to fetch the latest videos."
                      : "Nothing here matches this group and its rules."}
                  </p>
                </div>
              ) : (
                <div className="grid">
                  {feed.slice(0, limit).map((v) => (
                    <VideoCard
                      key={v.id}
                      video={v}
                      queuePos={queuePos.get(v.id) ?? 0}
                      watched={watched.has(v.id)}
                      later={laterIds.has(v.id)}
                      onToggleQueue={() => toggleQueue(v)}
                      onToggleLater={() => toggleLater(v)}
                      onToggleWatched={() => setWatched([v.id], !watched.has(v.id))}
                    />
                  ))}
                </div>
              )}
              {feed.length > limit && (
                <div className="more">
                  <button className="btn" onClick={() => setLimit(limit + PAGE)}>
                    Show more ({feed.length - limit})
                  </button>
                </div>
              )}
            </>
          )
        ) : tab === "later" ? (
          <LaterView
            later={state.later}
            onMoveToQueue={moveLaterToQueue}
            onWatched={(id) => setWatched([id], true)}
            onRemove={(id) => removeLater([id])}
          />
        ) : (
          <ChannelsView
            channels={state.channels}
            groups={state.groups}
            onImport={importCsv}
            onGroupsChange={saveGroups}
            onRemoveChannel={removeChannel}
          />
        )}
      </main>

      <QueueBar
        queue={queue}
        onMove={moveInQueue}
        onRemove={(id) => setQueue((q) => q.filter((v) => v.id !== id))}
        onClear={() => setQueue([])}
        onMarkAllWatched={() => {
          setWatched(
            queue.map((v) => v.id),
            true,
          );
          setQueue([]);
        }}
      />
    </>
  );
}
