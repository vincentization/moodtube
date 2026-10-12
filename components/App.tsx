"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, load, save } from "@/lib/client";
import { matchesRules } from "@/lib/format";
import { groupBadges, nextGroupColor, type GroupBadge } from "@/lib/groups";
import { ALL_SHELF, type AppState, type Group, type LaterItem, type Video } from "@/lib/types";
import Cartridge from "./Cartridge";
import ChannelSelect, { SIZE_COLUMNS, type ThumbSize } from "./ChannelSelect";
import Cable from "./Cable";
import Deck from "./Deck";
import Header from "./Header";
import Shelf from "./Shelf";
import Stack from "./Stack";

const STALE_MS = 30 * 60 * 1000; // auto-refresh on load if the cache is older than this
const PAGE = 60;
const SIDE_DEFAULT = 400;
const NOW = "now"; // the Watch now stack's jack; shelves use their own id

export default function App() {
  const [state, setState] = useState<AppState | null>(null);
  const [groupId, setGroupId] = useState("all");
  const [hideWatched, setHideWatched] = useState(true);
  const [hideShorts, setHideShorts] = useState(true);
  const [size, setSize] = useState<ThumbSize>("m");
  const [sideWidth, setSideWidth] = useState(SIDE_DEFAULT);
  const [queue, setQueue] = useState<Video[]>([]);
  // Watch lists (NOW and each shelf, by jack id) folded down to their header.
  const [folded, setFolded] = useState<string[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  // What the CRT plays from: the Watch now stack (null) or a Watch later shelf.
  const [source, setSource] = useState<string | null>(null);
  // Where each source was when the cable was patched elsewhere, so it resumes there.
  const positions = useRef<Record<string, string | null>>({});
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
    setSideWidth(load("mt:sideWidth", SIDE_DEFAULT));
    setGroupId(load("mt:group", "all"));
    setFolded(load("mt:folded", []));
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
    save("mt:sideWidth", sideWidth);
    save("mt:folded", folded);
  }, [queue, hideWatched, hideShorts, size, groupId, sideWidth, folded]);

  const toggleFold = (id: string) => setFolded((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]));

  const watched = useMemo(() => new Set(state?.watched ?? []), [state?.watched]);
  const queueIds = useMemo(() => new Set(queue.map((v) => v.id)), [queue]);

  const activeGroup = state?.groups.find((g) => g.id === groupId) ?? null;
  const badges = useMemo(() => groupBadges(state?.groups ?? []), [state?.groups]);
  // Badges each video carries: every group its channel belongs to.
  const channelBadges = useMemo(() => {
    const by = new Map<string, GroupBadge[]>();
    for (const g of state?.groups ?? []) {
      for (const c of g.channelIds) by.set(c, [...(by.get(c) ?? []), badges.get(g.id)!]);
    }
    return by;
  }, [state?.groups, badges]);
  // Each group has its own Watch later shelf; LATER on a cartridge files it on the current one.
  const shelf = activeGroup ? activeGroup.id : ALL_SHELF;
  const shelves = useMemo(() => {
    const by = new Map<string, LaterItem[]>();
    for (const v of [...(state?.later ?? [])].sort((a, b) => a.addedAt - b.addedAt)) {
      by.set(v.shelf, [...(by.get(v.shelf) ?? []), v]);
    }
    return by;
  }, [state?.later]);
  const shelfIds = useMemo(() => new Map([...shelves].map(([k, vs]) => [k, new Set(vs.map((v) => v.id))])), [shelves]);
  const laterIds = shelfIds.get(shelf) ?? new Set<string>();
  // On ALL, every group's non-empty shelf is on display too, after ALL's own (shown if filled, or if nothing is).
  const groupShelves = activeGroup
    ? []
    : (state?.groups ?? []).filter((g) => shelves.get(g.id)?.length).map((g) => ({ id: g.id, name: g.name }));
  const shownShelves = activeGroup
    ? [{ id: shelf, name: activeGroup.name }]
    : shelves.get(ALL_SHELF)?.length || groupShelves.length === 0
      ? [{ id: ALL_SHELF, name: "All" }, ...groupShelves]
      : groupShelves;
  // The shelf the cable is plugged into stays on display, even when it's empty or another group is selected.
  const sourceGroup = source && source !== ALL_SHELF ? state?.groups.find((g) => g.id === source) : null;
  const visibleShelves =
    !source || shownShelves.some((sh) => sh.id === source)
      ? shownShelves
      : [...shownShelves, { id: source, name: source === ALL_SHELF ? "All" : (sourceGroup?.name ?? "") }];
  const sourceList = source ? (shelves.get(source) ?? []) : queue;

  // A shelf is the source only while something from it is loaded; when it runs out (or its group is
  // deleted) the cable unplugs and Watch now is the default again.
  useEffect(() => {
    if (!source) return;
    if (state && source !== ALL_SHELF && !sourceGroup) {
      setCurrentId(null);
      setPlaying(false);
    }
    if (!currentId || (state && source !== ALL_SHELF && !sourceGroup)) setSource(null);
  }, [state, source, sourceGroup, currentId]);
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

  // Items leaving the active source; if the playing one goes, play moves to the next survivor.
  function skipPast(list: Video[], ids: string[]) {
    const gone = new Set(ids);
    if (!currentId || !gone.has(currentId)) return;
    const from = list.findIndex((v) => v.id === currentId);
    const next = list.slice(from + 1).find((v) => !gone.has(v.id))?.id ?? null;
    setCurrentId(next);
    if (!next) setPlaying(false);
  }

  function removeFromQueue(ids: string[]) {
    if (source === null) skipPast(queue, ids);
    setQueue((q) => q.filter((v) => !ids.includes(v.id)));
  }

  // Patch the CRT into a source (null = Watch now), resuming where it left off unless told what to play.
  function patch(next: string | null, play?: string) {
    positions.current[source ?? NOW] = currentId;
    const list = next ? (shelves.get(next) ?? []) : queue;
    const resume = positions.current[next ?? NOW];
    const pick = play ?? (list.some((v) => v.id === resume) ? resume : (list.find((v) => !watched.has(v.id)) ?? list[0])?.id) ?? null;
    setSource(next);
    setCurrentId(pick);
    setPlaying(!!pick);
  }

  // A source's play key: patches the cable over, or play/pause once it's already plugged in.
  function pressSource(next: string | null) {
    if (next !== source || !currentId) patch(next);
    else setPlaying(!playing);
  }

  function playFrom(next: string | null, id: string) {
    if (next !== source) return patch(next, id);
    setCurrentId(id);
    setPlaying(true);
  }

  function toggleQueue(v: Video) {
    if (queueIds.has(v.id)) removeFromQueue([v.id]);
    else setQueue((q) => [...q, v]);
  }

  function toggleLater(v: Video, to = shelf) {
    if (shelfIds.get(to)?.has(v.id)) return removeLater(to, [v.id]);
    setState((s) => s && { ...s, later: [...s.later, { ...v, shelf: to, addedAt: Date.now() }] });
    sync(api("/api/later", "POST", { action: "add", shelf: to, videos: [v] }));
  }

  function removeLater(shelf: string, ids: string[]) {
    if (source === shelf) skipPast(shelves.get(shelf) ?? [], ids);
    setState((s) => s && { ...s, later: s.later.filter((v) => v.shelf !== shelf || !ids.includes(v.id)) });
    sync(api("/api/later", "POST", { action: "remove", shelf, ids }));
  }

  function laterToNow(shelf: string, id: string) {
    const v = shelves.get(shelf)?.find((x) => x.id === id);
    if (!v) return;
    setQueue((q) => (q.some((x) => x.id === id) ? q : [...q, v]));
    removeLater(shelf, [id]);
  }

  function reorderQueue(ids: string[]) {
    setQueue((q) => ids.map((id) => q.find((v) => v.id === id)!).filter(Boolean));
  }

  function reorderLater(shelf: string, ids: string[]) {
    // Restamp this shelf's items in the new order; other shelves are untouched.
    const base = Date.now();
    setState(
      (s) =>
        s && {
          ...s,
          later: s.later.map((v) => (v.shelf === shelf && ids.includes(v.id) ? { ...v, addedAt: base + ids.indexOf(v.id) } : v)),
        },
    );
    sync(api("/api/later", "POST", { action: "reorder", shelf, ids }));
  }

  function saveGroups(groups: Group[]) {
    setState((s) => s && { ...s, groups });
    sync(api("/api/groups", "PUT", { groups }));
  }

  // Groups made before badge colors existed: save the colors they're shown with so they stay put.
  useEffect(() => {
    if (!state?.groups.some((g) => !g.color)) return;
    saveGroups(state.groups.map((g) => ({ ...g, color: badges.get(g.id)!.color })));
  }, [state?.groups, badges]);

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
    saveGroups([...state.groups, { id: crypto.randomUUID(), name, channelIds: [channelId], rules: {}, color: nextGroupColor(state.groups) }]);
  }

  function createGroup(name: string) {
    if (!state) return;
    const id = crypto.randomUUID();
    saveGroups([...state.groups, { id, name, channelIds: [], rules: {}, color: nextGroupColor(state.groups) }]);
    setGroupId(id);
  }

  const cols = SIZE_COLUMNS[size];

  return (
    <div className="page">
      <div className="console">
        <Header page="feed" refreshing={refreshing} onRefresh={refresh} />
        <div className="body" style={{ "--crt": `${sideWidth}px` } as React.CSSProperties}>
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
                    groupLater={
                      activeGroup
                        ? []
                        : (channelBadges.get(v.channelId) ?? []).map((b) => ({ badge: b, on: !!shelfIds.get(b.id)?.has(v.id) }))
                    }
                    groups={state.groups}
                    badges={channelBadges.get(v.channelId) ?? []}
                    onQueue={() => toggleQueue(v)}
                    onLater={() => toggleLater(v)}
                    onGroupLater={(gid) => toggleLater(v, gid)}
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
              queue={sourceList}
              currentId={currentId}
              playing={playing}
              watched={watched}
              width={sideWidth}
              onWidth={setSideWidth}
              onSelect={setCurrentId}
              onPlaying={setPlaying}
              onFinished={(id) => setWatched([id], true)}
            />
            {/* Plugged in only once something from a source is loaded into the CRT. */}
            <Cable target={currentId ? (source ?? NOW) : null} />
            <Stack
              queue={queue}
              currentId={source === null ? currentId : null}
              active={source === null}
              folded={folded.includes(NOW)}
              onFold={() => toggleFold(NOW)}
              playing={playing}
              watched={watched}
              onSource={() => pressSource(null)}
              onPlay={(id) => playFrom(null, id)}
              onReorder={reorderQueue}
              onEject={(id) => removeFromQueue([id])}
              onClearWatched={() => removeFromQueue(queue.filter((v) => watched.has(v.id)).map((v) => v.id))}
            />
            {visibleShelves.map((sh) => (
              <Shelf
                key={sh.id}
                id={sh.id}
                name={sh.name}
                badge={badges.get(sh.id)}
                later={shelves.get(sh.id) ?? []}
                currentId={source === sh.id ? currentId : null}
                active={source === sh.id}
                folded={folded.includes(sh.id)}
                onFold={() => toggleFold(sh.id)}
                playing={playing}
                onSource={() => pressSource(sh.id)}
                onPlay={(id) => playFrom(sh.id, id)}
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
