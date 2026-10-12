"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, load, save } from "@/lib/client";
import { matchesRules } from "@/lib/format";
import type { AppState, Group, Video } from "@/lib/types";
import Cartridge from "./Cartridge";
import ChannelSelect, { SIZE_COLUMNS, type ThumbSize } from "./ChannelSelect";
import Cable from "./Cable";
import Deck from "./Deck";
import Header from "./Header";
import Stack from "./Stack";

const STALE_MS = 30 * 60 * 1000; // auto-refresh on load if the cache is older than this
const PAGE = 60;

export default function App() {
  const [state, setState] = useState<AppState | null>(null);
  const [groupId, setGroupId] = useState("all");
  const [hideWatched, setHideWatched] = useState(true);
  const [hideShorts, setHideShorts] = useState(true);
  const [size, setSize] = useState<ThumbSize>("m");
  const [queue, setQueue] = useState<Video[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const [refreshing, setRefreshing] = useState(false);
  const [status, setStatus] = useState("");
  const restored = useRef(false);
  const sentinel = useRef<HTMLDivElement>(null);

  const loadState = useCallback(async () => {
    const s = await api<AppState>("/api/state", "GET");
    setState(s);
    return s;
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const r = await api<{ channels: number; failed: string[] }>("/api/refresh");
      await loadState();
      setStatus(r.failed.length ? `Updated ${r.channels - r.failed.length} of ${r.channels} channels.` : "");
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
    setSize(load<ThumbSize>("mt:thumbSize", "m"));
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
    save("mt:thumbSize", size);
    save("mt:group", groupId);
  }, [queue, hideWatched, hideShorts, size, groupId]);

  const watched = useMemo(() => new Set(state?.watched ?? []), [state?.watched]);
  const laterIds = useMemo(() => new Set(state?.later.map((v) => v.id) ?? []), [state?.later]);
  const queueIds = useMemo(() => new Set(queue.map((v) => v.id)), [queue]);

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

  // Load more cartridges as the end of the rack scrolls into view.
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) setLimit((l) => l + PAGE);
    }, { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [feed.length > limit]);

  // Mutations update local state first, then sync. On failure, reload from the server.
  const sync = (p: Promise<unknown>) =>
    p.catch((err) => {
      setStatus(`Couldn't save: ${err.message}`);
      loadState().catch(() => {});
    });

  function setWatched(ids: string[], on: boolean) {
    setState(
      (s) =>
        s && {
          ...s,
          watched: on ? [...new Set([...s.watched, ...ids])] : s.watched.filter((id) => !ids.includes(id)),
          later: on ? s.later.filter((v) => !ids.includes(v.id)) : s.later,
        },
    );
    sync(api("/api/watched", "POST", { ids, watched: on }));
  }

  // Removing items from Watch now; if the playing one goes, play moves to the next survivor.
  function removeFromQueue(ids: string[]) {
    const gone = new Set(ids);
    if (currentId && gone.has(currentId)) {
      const from = queue.findIndex((v) => v.id === currentId);
      setCurrentId(queue.slice(from + 1).find((v) => !gone.has(v.id))?.id ?? null);
      if (!queue.slice(from + 1).some((v) => !gone.has(v.id))) setPlaying(false);
    }
    setQueue((q) => q.filter((v) => !gone.has(v.id)));
  }

  function toggleQueue(v: Video) {
    if (queueIds.has(v.id)) removeFromQueue([v.id]);
    else setQueue((q) => [...q, v]);
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

  function laterToNow(id: string) {
    const v = state?.later.find((x) => x.id === id);
    if (!v) return;
    setQueue((q) => (q.some((x) => x.id === id) ? q : [...q, v]));
    removeLater([id]);
  }

  function reorder(list: "queue" | "later", ids: string[]) {
    if (list === "queue") {
      setQueue((q) => ids.map((id) => q.find((v) => v.id === id)!).filter(Boolean));
      return;
    }
    setState((s) => s && { ...s, later: ids.map((id) => s.later.find((v) => v.id === id)!).filter(Boolean) });
    sync(api("/api/later", "POST", { action: "reorder", ids }));
  }

  function saveGroups(groups: Group[]) {
    setState((s) => s && { ...s, groups });
    sync(api("/api/groups", "PUT", { groups }));
  }

  function setChannelInGroup(channelId: string, gid: string, on: boolean) {
    if (!state) return;
    saveGroups(
      state.groups.map((g) =>
        g.id !== gid
          ? g
          : { ...g, channelIds: on ? [...new Set([...g.channelIds, channelId])] : g.channelIds.filter((c) => c !== channelId) },
      ),
    );
  }

  function createGroupWithChannel(name: string, channelId: string) {
    if (!state) return;
    saveGroups([...state.groups, { id: crypto.randomUUID(), name, channelIds: [channelId], rules: {} }]);
  }

  function createGroup(name: string) {
    if (!state) return;
    const id = crypto.randomUUID();
  function createGroup(name: string) {
    if (!state) return;
    const id = crypto.randomUUID();
    saveGroups([...state.groups, { id, name, channelIds: [], rules: {} }]);
    setGroupId(id);
  }

  const later = state?.later ?? [];
    setGroupId(id);
  }

  const later = state?.later ?? [];
    setGroupId(id);
  }

  const later = state?.later ?? [];
    setGroupId(id);
  }

  const later = state?.later ?? [];
  const cols = SIZE_COLUMNS[size];

  return (
    <div className="page">
      <div className="console">
        <Header page="feed" refreshing={refreshing} onRefresh={refresh} />
        <div className="body">
          <ChannelSelect
            groups={state?.groups ?? []}
            badges={badges}
            groupId={activeGroup ? groupId : "all"}
            onGroup={setGroupId}
            onAddGroup={createGroup}
            hideWatched={hideWatched}
            onHideWatched={setHideWatched}
            hideShorts={hideShorts}
            onHideShorts={setHideShorts}
            size={size}
            onSize={setSize}
            status={status}
          />

          <div className="feed">
            {!state ? (
              !status && <div className="empty">Loading…</div>
            ) : state.channels.length === 0 ? (
              <div className="empty">No channels yet — import your subscriptions on the Channels page.</div>
            ) : feed.length === 0 ? (
              <div className="empty">
                {state.videos.length === 0 ? "No videos yet — press Refresh." : "Nothing here matches this channel's filters."}
              </div>
            ) : (
              <div className="rack" style={{ "--cols": cols } as React.CSSProperties}>
                {feed.slice(0, limit).map((v, i) => (
                  <Cartridge
                    key={v.id}
                    video={v}
                    num={i + 1}
                    inQueue={queueIds.has(v.id)}
                    inLater={laterIds.has(v.id)}
                    groups={state.groups}
                    badges={channelBadges.get(v.channelId) ?? []}
                    onQueue={() => toggleQueue(v)}
                    onLater={() => toggleLater(v)}
                    onToggleGroup={(gid, on) => setChannelInGroup(v.channelId, gid, on)}
                    onCreateGroup={(name) => createGroupWithChannel(name, v.channelId)}
                  />
                ))}
              </div>
            )}
            {feed.length > limit && <div ref={sentinel} style={{ height: 1 }} />}
          </div>

          <div className="side">
            <Deck
              queue={queue}
              currentId={currentId}
              playing={playing}
              watched={watched}
              width={sideWidth}
              onWidth={setSideWidth}
              onSelect={setCurrentId}
              onPlaying={setPlaying}
              onFinished={(id) => setWatched([id], true)}
            />
            <Cable />
            <Stack
              queue={queue}
              currentId={currentId}
              watched={watched}
              onPlay={(id) => {
                setCurrentId(id);
                setPlaying(true);
              }}
              onReorder={reorderQueue}
              onEject={(id) => removeFromQueue([id])}
              onClearWatched={() => removeFromQueue(queue.filter((v) => watched.has(v.id)).map((v) => v.id))}
            />
            {visibleShelves.map((sh) => (
              <Shelf
                key={sh.id}
                name={sh.name}
                badge={badges.get(sh.id)}
                later={shelves.get(sh.id) ?? []}
                onReorder={(ids) => reorderLater(sh.id, ids)}
                onRemove={(id) => removeLater(sh.id, [id])}
                onToNow={(id) => laterToNow(sh.id, id)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
