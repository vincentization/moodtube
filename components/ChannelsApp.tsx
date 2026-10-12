"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { nextGroupColor } from "@/lib/groups";
import type { AppState, Group, Rules } from "@/lib/types";
import Header from "./Header";
import Toggle from "./Toggle";

export default function ChannelsApp() {
  const [state, setState] = useState<AppState | null>(null);
  const [status, setStatus] = useState("");
  const [importMsg, setImportMsg] = useState("");
  const [newName, setNewName] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [onlyMembers, setOnlyMembers] = useState(false);

  async function loadState() {
    const s = await api<AppState>("/api/state", "GET");
    setState(s);
    setSelectedId((id) => id ?? s.groups[0]?.id ?? null);
    return s;
  }

  useEffect(() => {
    loadState().catch((err) => setStatus(`Could not load: ${err.message}`));
  }, []);

  const sync = (p: Promise<unknown>) =>
    p.catch((err) => {
      setStatus(`Couldn't save: ${err.message}`);
      loadState().catch(() => {});
    });

  if (!state) {
    return (
      <div className="page">
        <div className="console">
          <Header page="channels" />
          <div className="cbody">
            <div className="empty">{status || "Loading…"}</div>
          </div>
        </div>
      </div>
    );
  }

  const { channels, groups } = state;
  const selected = groups.find((g) => g.id === selectedId) ?? null;

  function saveGroups(next: Group[]) {
    setState((s) => s && { ...s, groups: next });
    sync(api("/api/groups", "PUT", { groups: next }));
  }
  const updateGroup = (patch: Partial<Group>) =>
    selected && saveGroups(groups.map((g) => (g.id === selected.id ? { ...g, ...patch } : g)));
  const updateRules = (patch: Partial<Rules>) => selected && updateGroup({ rules: { ...selected.rules, ...patch } });

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setImportMsg("Importing…");
    try {
      const r = await api<{ found: number; added: number }>("/api/import", "POST", { csv: await file.text() });
      await loadState();
      setImportMsg(`Found ${r.found} channels, ${r.added} new.${r.added ? " Fetching their videos…" : ""}`);
      if (r.added) {
        await api("/api/refresh");
        setImportMsg(`Found ${r.found} channels, ${r.added} new. Videos fetched.`);
      }
    } catch (err) {
      setImportMsg((err as Error).message);
    }
  }

  function createGroup() {
    const name = newName.trim();
    if (!name) return;
    const group: Group = { id: crypto.randomUUID(), name, channelIds: [], rules: {}, color: nextGroupColor(groups) };
    saveGroups([...groups, group]);
    setSelectedId(group.id);
    setNewName("");
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

  const visible = channels.filter(
    (c) =>
      c.title.toLowerCase().includes(filter.toLowerCase()) && (!onlyMembers || !selected || selected.channelIds.includes(c.id)),
  );

  return (
    <div className="page">
      <div className="console">
        <Header page="channels" />
        <div className="cbody">
          {status && <div className="empty">{status}</div>}

          <section className="tray">
            <div className="panel-label">IMPORT SUBSCRIPTIONS</div>
            <div className="sheet row">
              <label className="chip-key" style={{ display: "inline-flex", alignItems: "center" }}>
                CHOOSE SUBSCRIPTIONS.CSV
                <input
                  type="file"
                  accept=".csv,text/csv"
                  hidden
                  onChange={(e) => {
                    handleFile(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </label>
              <p className="note">
                {importMsg ||
                  "Google Takeout → YouTube and YouTube Music → subscriptions/subscriptions.csv. Importing again only adds new channels."}
              </p>
            </div>
          </section>

          <section className="tray">
            <div className="panel-label">GROUPS</div>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
              <div className="chips">
                {groups.map((g) => (
                  <button key={g.id} className={`chip-key${g.id === selectedId ? " on" : ""}`} onClick={() => setSelectedId(g.id)}>
                    {g.name.toUpperCase()} · {g.channelIds.length}
                  </button>
                ))}
              </div>
              <form
                className="row"
                onSubmit={(e) => {
                  e.preventDefault();
                  createGroup();
                }}
              >
                <input className="input" placeholder="New group name" value={newName} onChange={(e) => setNewName(e.target.value)} />
                <button className="chip-key" type="submit" disabled={!newName.trim()}>
                  + NEW GROUP
                </button>
              </form>
            </div>

            {selected ? (
              <div className="sheet" key={selected.id} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div className="row">
                  <label className="field" style={{ flex: 1 }}>
                    GROUP NAME
                    <input
                      className="input"
                      defaultValue={selected.name}
                      onBlur={(e) => e.target.value.trim() && updateGroup({ name: e.target.value.trim() })}
                    />
                  </label>
                  <button
                    className="ckey"
                    style={{ alignSelf: "flex-end", height: 32 }}
                    onClick={() => {
                      if (!window.confirm(`Delete the group “${selected.name}”? Channels stay imported.`)) return;
                      saveGroups(groups.filter((g) => g.id !== selected.id));
                      setSelectedId(groups.find((g) => g.id !== selected.id)?.id ?? null);
                    }}
                  >
                    DELETE GROUP
                  </button>
                </div>
                <div className="rules">
                  <label className="field">
                    TITLE CONTAINS (COMMA = ANY OF)
                    <input
                      className="input"
                      defaultValue={selected.rules.keyword ?? ""}
                      placeholder="optional"
                      onBlur={(e) => updateRules({ keyword: e.target.value.trim() || undefined })}
                    />
                  </label>
                  <label className="field">
                    MINIMUM LENGTH (MIN)
                    <input
                      className="input"
                      type="number"
                      min={0}
                      defaultValue={selected.rules.minMinutes ?? ""}
                      placeholder="any"
                      onBlur={(e) => updateRules({ minMinutes: Number(e.target.value) || undefined })}
                    />
                  </label>
                  <Toggle
                    label="NO SHORTS"
                    tone="now"
                    on={!!selected.rules.noShorts}
                    onClick={() => updateRules({ noShorts: !selected.rules.noShorts || undefined })}
                  />
                </div>
                <div className="row">
                  <input
                    className="input"
                    type="search"
                    placeholder={`Filter ${channels.length} channels`}
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <div style={{ width: 220 }}>
                    <Toggle label="ONLY IN GROUP" tone="now" on={onlyMembers} onClick={() => setOnlyMembers(!onlyMembers)} />
                  </div>
                </div>
                <div className="chan-list">
                  {visible.map((c) => {
                    const on = selected.channelIds.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        className={`chan${on ? " on" : ""}`}
                        role="switch"
                        aria-checked={on}
                        onClick={() =>
                          updateGroup({
                            channelIds: on ? selected.channelIds.filter((id) => id !== c.id) : [...selected.channelIds, c.id],
                          })
                        }
                      >
                        <span className="gmenu-led" />
                        <span title={c.title}>{c.title}</span>
                      </button>
                    );
                  })}
                  {visible.length === 0 && <p className="note">No matching channels.</p>}
                </div>
              </div>
            ) : (
              <p className="note">Create a group to start sorting channels.</p>
            )}
          </section>

          <section className="tray">
            <div className="panel-label">ALL CHANNELS · {channels.length}</div>
            <div className="sheet">
              <div className="chan-list" style={{ maxHeight: "none" }}>
                {channels.map((c) => {
                  const n = groups.filter((g) => g.channelIds.includes(c.id)).length;
                  return (
                    <div className="chan" key={c.id} style={{ cursor: "default" }}>
                      <span className="chan-name" title={c.title}>
                        {c.title}
                      </span>
                      <span className="note" style={{ flex: "none" }}>
                        {n || ""}
                      </span>
                      <button
                        className="ckey eject"
                        title={`Remove ${c.title}`}
                        onClick={() => window.confirm(`Remove ${c.title}?`) && removeChannel(c.id)}
                      >
                        ⏏
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
