"use client";

import { useState } from "react";
import type { Channel, Group, Rules } from "@/lib/types";

type Props = {
  channels: Channel[];
  groups: Group[];
  onImport: (csv: string) => Promise<string>;
  onGroupsChange: (groups: Group[]) => void;
  onRemoveChannel: (id: string) => void;
};

export default function ChannelsView({ channels, groups, onImport, onGroupsChange, onRemoveChannel }: Props) {
  const [importMsg, setImportMsg] = useState("");
  const [newName, setNewName] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(groups[0]?.id ?? null);
  const [filter, setFilter] = useState("");
  const [onlyMembers, setOnlyMembers] = useState(false);

  const selected = groups.find((g) => g.id === selectedId) ?? null;
  const updateGroup = (patch: Partial<Group>) =>
    selected && onGroupsChange(groups.map((g) => (g.id === selected.id ? { ...g, ...patch } : g)));
  const updateRules = (patch: Partial<Rules>) => selected && updateGroup({ rules: { ...selected.rules, ...patch } });

  const visibleChannels = channels.filter(
    (c) =>
      c.title.toLowerCase().includes(filter.toLowerCase()) &&
      (!onlyMembers || !selected || selected.channelIds.includes(c.id)),
  );
  const groupCount = (id: string) => groups.filter((g) => g.channelIds.includes(id)).length;

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setImportMsg("Importing…");
    setImportMsg(await onImport(await file.text()));
  }

  function createGroup() {
    const name = newName.trim();
    if (!name) return;
    const group: Group = { id: crypto.randomUUID(), name, channelIds: [], rules: {} };
    onGroupsChange([...groups, group]);
    setSelectedId(group.id);
    setNewName("");
  }

  function toggleMember(channelId: string, on: boolean) {
    if (!selected) return;
    updateGroup({
      channelIds: on ? [...selected.channelIds, channelId] : selected.channelIds.filter((id) => id !== channelId),
    });
  }

  return (
    <>
      <section className="section">
        <h2>Import subscriptions</h2>
        <p className="muted small">
          Google Takeout → YouTube and YouTube Music → subscriptions/subscriptions.csv. Importing again only adds new
          channels.
        </p>
        <div className="form-row">
          <label className="btn">
            Choose subscriptions.csv
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
          {importMsg && <span className="status">{importMsg}</span>}
        </div>
      </section>

      <section className="section">
        <h2>Groups</h2>
        <p className="muted small">A channel can belong to any number of groups. Rules only apply inside that group.</p>
        <div className="form-row" style={{ marginBottom: 14 }}>
          <div className="chips" style={{ flex: "1 1 auto" }}>
            {groups.map((g) => (
              <button
                key={g.id}
                className={`chip${g.id === selectedId ? " active" : ""}`}
                onClick={() => setSelectedId(g.id)}
              >
                {g.name} <span style={{ opacity: 0.7 }}>{g.channelIds.length}</span>
              </button>
            ))}
          </div>
          <form
            className="form-row"
            onSubmit={(e) => {
              e.preventDefault();
              createGroup();
            }}
          >
            <input
              type="text"
              placeholder="New group name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              style={{ width: 180 }}
            />
            <button className="btn" type="submit" disabled={!newName.trim()}>
              Add
            </button>
          </form>
        </div>

        {selected ? (
          <div className="panel" key={selected.id}>
            <div className="form-row">
              <input
                type="text"
                defaultValue={selected.name}
                aria-label="Group name"
                onBlur={(e) => e.target.value.trim() && updateGroup({ name: e.target.value.trim() })}
                style={{ flex: 1, fontWeight: 600 }}
              />
              <button
                className="btn ghost danger"
                onClick={() => {
                  if (!window.confirm(`Delete the group “${selected.name}”? Channels stay imported.`)) return;
                  onGroupsChange(groups.filter((g) => g.id !== selected.id));
                  setSelectedId(groups.find((g) => g.id !== selected.id)?.id ?? null);
                }}
              >
                Delete group
              </button>
            </div>

            <div className="rules">
              <label className="field">
                Title contains (comma = any of)
                <input
                  type="text"
                  defaultValue={selected.rules.keyword ?? ""}
                  placeholder="optional"
                  onBlur={(e) => updateRules({ keyword: e.target.value.trim() || undefined })}
                />
              </label>
              <label className="field">
                Minimum length (min)
                <input
                  type="number"
                  min={0}
                  defaultValue={selected.rules.minMinutes ?? ""}
                  placeholder="any"
                  onBlur={(e) => updateRules({ minMinutes: Number(e.target.value) || undefined })}
                />
              </label>
              <label className="toggle" style={{ paddingBottom: 8 }}>
                <input
                  type="checkbox"
                  checked={!!selected.rules.noShorts}
                  onChange={(e) => updateRules({ noShorts: e.target.checked || undefined })}
                />
                No Shorts
              </label>
            </div>

            <div className="form-row">
              <input
                type="search"
                placeholder={`Filter ${channels.length} channels`}
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                style={{ flex: 1, minWidth: 160 }}
              />
              <label className="toggle">
                <input type="checkbox" checked={onlyMembers} onChange={(e) => setOnlyMembers(e.target.checked)} />
                Only in group
              </label>
            </div>
            <div className="channel-list">
              {visibleChannels.map((c) => (
                <label className="channel-item" key={c.id}>
                  <input
                    type="checkbox"
                    checked={selected.channelIds.includes(c.id)}
                    onChange={(e) => toggleMember(c.id, e.target.checked)}
                  />
                  <span title={c.title}>{c.title}</span>
                </label>
              ))}
              {visibleChannels.length === 0 && <p className="muted small">No matching channels.</p>}
            </div>
          </div>
        ) : (
          <p className="muted small">Create a group to start sorting channels.</p>
        )}
      </section>

      <section className="section">
        <h2>All channels</h2>
        <p className="muted small">
          {channels.length} channels. Ones in no group still show up under “All”.
        </p>
        <div className="channel-list" style={{ maxHeight: "none" }}>
          {channels.map((c) => (
            <div className="channel-item" key={c.id}>
              <a
                href={`https://www.youtube.com/channel/${c.id}`}
                target="_blank"
                rel="noreferrer"
                title={c.title}
                style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
              >
                {c.title}
              </a>
              <span className="muted small" style={{ flex: "none" }}>
                {groupCount(c.id) || ""}
              </span>
              <button
                className="btn ghost sm"
                aria-label={`Remove ${c.title}`}
                onClick={() => window.confirm(`Remove ${c.title}?`) && onRemoveChannel(c.id)}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
