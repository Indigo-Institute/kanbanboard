"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { compressImageFile } from "../lib/image";

const COLUMNS = [
  { id: "proposed", label: "Proposed" },
  { id: "in_progress", label: "In Progress" },
  { id: "in_review", label: "In Review" },
  { id: "shipped", label: "Shipped" },
];

const PRIORITIES = [
  { id: "low", label: "Low", dot: "bg-slate-400" },
  { id: "medium", label: "Medium", dot: "bg-amber-500" },
  { id: "high", label: "High", dot: "bg-rose-500" },
];

const CHIP_PALETTE = [
  "bg-rose-100 text-rose-700",
  "bg-amber-100 text-amber-700",
  "bg-emerald-100 text-emerald-700",
  "bg-sky-100 text-sky-700",
  "bg-violet-100 text-violet-700",
  "bg-pink-100 text-pink-700",
  "bg-teal-100 text-teal-700",
  "bg-indigo-100 text-indigo-700",
];

function colorForName(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return CHIP_PALETTE[Math.abs(hash) % CHIP_PALETTE.length];
}

function priorityMeta(id) {
  return PRIORITIES.find((p) => p.id === id) || PRIORITIES[1];
}

const emptyForm = {
  id: null,
  title: "",
  description: "",
  assignee: "",
  priority: "medium",
  link: "",
  status: "proposed",
  hasScreenshot: false,
};

export default function Home() {
  const [items, setItems] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [filterAssignee, setFilterAssignee] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [dragId, setDragId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [newImage, setNewImage] = useState(null);
  const [imageRemoved, setImageRemoved] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const pollRef = useRef(null);
  const fileInputRef = useRef(null);

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch("/api/items", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setItems(data);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    fetchItems();
    pollRef.current = setInterval(fetchItems, 5000);
    const onFocus = () => fetchItems();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(pollRef.current);
      window.removeEventListener("focus", onFocus);
    };
  }, [fetchItems]);

  const assignees = useMemo(() => {
    const set = new Set(items.map((i) => i.assignee).filter(Boolean));
    return Array.from(set).sort();
  }, [items]);

  const visibleItems = useMemo(() => {
    if (filterAssignee === "all") return items;
    return items.filter((i) => i.assignee === filterAssignee);
  }, [items, filterAssignee]);

  function openNewCard(status) {
    setFormError("");
    setNewImage(null);
    setImageRemoved(false);
    setForm({ ...emptyForm, status: status || "proposed" });
    setModalOpen(true);
  }

  function openEditCard(item) {
    setFormError("");
    setNewImage(null);
    setImageRemoved(false);
    setForm({ ...item });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setForm(emptyForm);
    setNewImage(null);
    setImageRemoved(false);
  }

  async function handleImageFile(file) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setFormError("That file isn't an image.");
      return;
    }
    setImageBusy(true);
    setFormError("");
    try {
      const compressed = await compressImageFile(file);
      setNewImage(compressed);
      setImageRemoved(false);
    } catch (err) {
      setFormError(err.message || "Couldn't process that image.");
    } finally {
      setImageBusy(false);
    }
  }

  function handlePaste(e) {
    const item = Array.from(e.clipboardData?.items || []).find((i) =>
      i.type.startsWith("image/")
    );
    if (!item) return;
    e.preventDefault();
    handleImageFile(item.getAsFile());
  }

  function handleRemoveImage() {
    setNewImage(null);
    setImageRemoved(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.title.trim()) {
      setFormError("Title is required.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const imagePatch = newImage
        ? { image: newImage }
        : imageRemoved
        ? { removeImage: true }
        : {};
      if (form.id) {
        const res = await fetch(`/api/items/${form.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: form.title,
            description: form.description,
            assignee: form.assignee,
            priority: form.priority,
            link: form.link,
            status: form.status,
            ...imagePatch,
          }),
        });
        const updated = await res.json();
        setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      } else {
        const res = await fetch("/api/items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, ...imagePatch }),
        });
        const created = await res.json();
        setItems((prev) => [created, ...prev]);
      }
      closeModal();
    } catch {
      setFormError("Something went wrong. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!form.id) return;
    setSaving(true);
    try {
      await fetch(`/api/items/${form.id}`, { method: "DELETE" });
      setItems((prev) => prev.filter((i) => i.id !== form.id));
      closeModal();
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(item, status) {
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, status } : i)));
    await fetch(`/api/items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  }

  function handleDrop(status) {
    if (!dragId) return;
    const item = items.find((i) => i.id === dragId);
    setDragId(null);
    if (item && item.status !== status) changeStatus(item, status);
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Backlog Board</h1>
            <p className="text-sm text-slate-500">Propose, claim, and ship changes together.</p>
          </div>
          <button
            onClick={() => openNewCard("proposed")}
            className="rounded-lg bg-slate-900 text-white text-sm font-medium px-4 py-2 hover:bg-slate-700"
          >
            + New item
          </button>
        </div>
        {assignees.length > 0 && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-3 flex flex-wrap gap-2">
            <button
              onClick={() => setFilterAssignee("all")}
              className={`text-xs px-3 py-1 rounded-full border ${
                filterAssignee === "all"
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-600 border-slate-300"
              }`}
            >
              Everyone
            </button>
            {assignees.map((name) => (
              <button
                key={name}
                onClick={() => setFilterAssignee(name)}
                className={`text-xs px-3 py-1 rounded-full border ${
                  filterAssignee === name
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-600 border-slate-300"
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        )}
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {!loaded ? (
          <p className="text-sm text-slate-500">Loading board...</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {COLUMNS.map((col) => {
              const colItems = visibleItems.filter((i) => i.status === col.id);
              return (
                <div
                  key={col.id}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDrop(col.id)}
                  className="bg-slate-100/60 rounded-xl p-3 flex flex-col min-h-[200px]"
                >
                  <div className="flex items-center justify-between mb-3 px-1">
                    <h2 className="text-sm font-semibold text-slate-700">{col.label}</h2>
                    <span className="text-xs text-slate-400">{colItems.length}</span>
                  </div>
                  <div className="space-y-2 flex-1">
                    {colItems.map((item) => {
                      const pr = priorityMeta(item.priority);
                      return (
                        <div
                          key={item.id}
                          draggable
                          onDragStart={() => setDragId(item.id)}
                          onClick={() => openEditCard(item)}
                          className="bg-white rounded-lg border border-slate-200 p-3 shadow-sm hover:shadow cursor-pointer transition-shadow"
                        >
                          {item.hasScreenshot && (
                            <img
                              src={`/api/items/${item.id}/image`}
                              alt=""
                              loading="lazy"
                              className="w-full h-24 object-cover rounded-md mb-2 border border-slate-100"
                            />
                          )}
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium text-slate-900 leading-snug">
                              {item.title}
                            </p>
                            <span
                              title={`${pr.label} priority`}
                              className={`mt-1 h-2 w-2 rounded-full shrink-0 ${pr.dot}`}
                            />
                          </div>
                          {item.description && (
                            <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                              {item.description}
                            </p>
                          )}
                          <div className="flex items-center justify-between mt-3 gap-2">
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full font-medium ${colorForName(
                                item.assignee
                              )}`}
                            >
                              {item.assignee}
                            </span>
                            {item.link && (
                              <a
                                href={item.link}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-xs text-sky-600 hover:underline"
                              >
                                Link ↗
                              </a>
                            )}
                          </div>
                          <select
                            value={item.status}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => {
                              e.stopPropagation();
                              changeStatus(item, e.target.value);
                            }}
                            className="mt-3 w-full text-xs border border-slate-200 rounded-md px-2 py-1 bg-slate-50 text-slate-600"
                          >
                            {COLUMNS.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      );
                    })}
                    {colItems.length === 0 && (
                      <p className="text-xs text-slate-400 px-1 py-4 text-center">Nothing here</p>
                    )}
                  </div>
                  <button
                    onClick={() => openNewCard(col.id)}
                    className="mt-3 text-xs text-slate-500 hover:text-slate-800 text-left px-1"
                  >
                    + Add to {col.label}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {modalOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-20"
          onClick={closeModal}
        >
          <form
            onSubmit={handleSave}
            onClick={(e) => e.stopPropagation()}
            onPaste={handlePaste}
            className="bg-white rounded-xl shadow-lg w-full max-w-md p-5 space-y-3 max-h-[90vh] overflow-y-auto"
          >
            <h3 className="text-base font-semibold text-slate-900">
              {form.id ? "Edit item" : "New backlog item"}
            </h3>

            <div>
              <label className="text-xs font-medium text-slate-600">Title</label>
              <input
                autoFocus
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Fix broken signup button on mobile"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-600">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
                placeholder="Any context, steps, or acceptance criteria"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-600">Screenshot</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleImageFile(e.target.files?.[0])}
              />
              {(() => {
                const previewSrc = newImage
                  ? newImage
                  : !imageRemoved && form.hasScreenshot
                  ? `/api/items/${form.id}/image`
                  : null;
                if (previewSrc) {
                  return (
                    <div className="mt-1 space-y-2">
                      <img
                        src={previewSrc}
                        alt="Screenshot preview"
                        className="w-full max-h-48 object-contain rounded-lg border border-slate-200 bg-slate-50"
                      />
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="text-xs text-slate-600 hover:text-slate-900"
                        >
                          Replace
                        </button>
                        <button
                          type="button"
                          onClick={handleRemoveImage}
                          className="text-xs text-rose-600 hover:text-rose-800"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  );
                }
                return (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-1 w-full rounded-lg border border-dashed border-slate-300 px-3 py-4 text-xs text-slate-500 hover:border-slate-400 hover:text-slate-700"
                  >
                    {imageBusy ? "Processing..." : "Click to upload, or paste (⌘/Ctrl+V) a screenshot"}
                  </button>
                );
              })()}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-600">Assignee</label>
                <input
                  list="assignee-options"
                  value={form.assignee}
                  onChange={(e) => setForm({ ...form, assignee: e.target.value })}
                  placeholder="Who's on it?"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
                <datalist id="assignee-options">
                  {assignees.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Priority</label>
                <select
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  {PRIORITIES.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-600">Link (PR, doc, commit)</label>
              <input
                value={form.link}
                onChange={(e) => setForm({ ...form, link: e.target.value })}
                placeholder="https://..."
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-600">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                {COLUMNS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            {formError && <p className="text-sm text-rose-600">{formError}</p>}

            <div className="flex items-center justify-between pt-2">
              <div>
                {form.id && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={saving}
                    className="text-sm text-rose-600 hover:text-rose-800"
                  >
                    Delete
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="text-sm px-4 py-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || imageBusy}
                  className="text-sm px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-700 disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
