"use client";

import { useEffect, useRef, useState } from "react";
import { X, Save, Loader2, Flame, CalendarClock, ShieldAlert, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  TaskRecurrence,
  TaskCategory,
  User,
  RecurrenceFrequency,
  TaskPriority,
  TaskType,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const RANDOM_COLORS = [
  "#CBA35C", "#38BFF5", "#00E676", "#FFD740", "#B026FF",
  "#00bcd4", "#FF5252", "#64748B", "#8bc34a", "#ffc107",
];

const FREQUENCY_OPTIONS: { value: RecurrenceFrequency; label: string }[] = [
  { value: "daily", label: "Diaria" },
  { value: "weekly", label: "Semanal" },
  { value: "biweekly", label: "Quincenal" },
  { value: "monthly", label: "Mensual" },
  { value: "custom", label: "Personalizada" },
];

const DAY_LABELS = [
  { index: 0, label: "Dom" },
  { index: 1, label: "Lun" },
  { index: 2, label: "Mar" },
  { index: 3, label: "Mie" },
  { index: 4, label: "Jue" },
  { index: 5, label: "Vie" },
  { index: 6, label: "Sab" },
];

interface RecurrenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  recurrence?: TaskRecurrence;
  categories: TaskCategory[];
  users: User[];
  currentUser: User;
  onSaved: (recurrence: TaskRecurrence) => void;
  onCategoriesChanged?: (cats: TaskCategory[]) => void;
  onToast?: (type: "success" | "error", message: string) => void;
}

export function RecurrenceModal({
  isOpen,
  onClose,
  recurrence,
  categories,
  users,
  currentUser,
  onSaved,
  onCategoriesChanged,
  onToast,
}: RecurrenceModalProps) {
  const isEditing = !!recurrence;
  const isAdmin =
    currentUser.role === "super_admin" || currentUser.role === "ceo";

  // --- Form state (mirrors task-modal) ---
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [taskType, setTaskType] = useState<TaskType>("planeada");
  const [defaultStatus, setDefaultStatus] = useState("pending");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [frequency, setFrequency] = useState<RecurrenceFrequency>("weekly");
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [categorySearch, setCategorySearch] = useState("");
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [assignedTo, setAssignedTo] = useState("");
  const [attachmentInput, setAttachmentInput] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [blockType, setBlockType] = useState("");
  const [blockReason, setBlockReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const catDropdownRef = useRef<HTMLDivElement>(null);

  // --- Reset / populate on open ---
  useEffect(() => {
    if (recurrence) {
      setTitle(recurrence.title);
      setDescription(recurrence.description ?? "");
      setTaskType((recurrence.task_type as TaskType) ?? "planeada");
      setDefaultStatus(recurrence.default_status ?? "pending");
      setPriority(recurrence.priority);
      setFrequency(recurrence.frequency);
      setDaysOfWeek(recurrence.days_of_week ?? []);
      setCategoryId(recurrence.category_id ?? "");
      setCategorySearch(
        categories.find((c) => c.id === recurrence.category_id)?.name ?? ""
      );
      setAssignedTo(recurrence.assigned_to ?? currentUser.id);
      setAttachments(
        Array.isArray(recurrence.attachments)
          ? (recurrence.attachments as string[])
          : []
      );
    } else {
      setTitle("");
      setDescription("");
      setTaskType("planeada");
      setDefaultStatus("pending");
      setPriority("medium");
      setFrequency("weekly");
      setDaysOfWeek([]);
      setCategoryId("");
      setCategorySearch("");
      setAssignedTo(currentUser.id);
      setAttachments([]);
    }
    setBlockType("");
    setBlockReason("");
    setAttachmentInput("");
    setErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recurrence, isOpen, currentUser.id]);

  // Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  // Close category dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        catDropdownRef.current &&
        !catDropdownRef.current.contains(e.target as Node)
      ) {
        setShowCategoryDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // --- Category helpers ---
  const filteredCategories = categories.filter((c) =>
    c.name.toLowerCase().includes(categorySearch.toLowerCase())
  );
  const exactMatch = categories.find(
    (c) => c.name.toLowerCase() === categorySearch.trim().toLowerCase()
  );

  const handleSelectCategory = (cat: TaskCategory) => {
    setCategoryId(cat.id);
    setCategorySearch(cat.name);
    setShowCategoryDropdown(false);
  };

  const handleCreateCategory = async () => {
    const name = categorySearch.trim();
    if (!name) return;
    try {
      const color =
        RANDOM_COLORS[Math.floor(Math.random() * RANDOM_COLORS.length)];
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, color }),
      });
      if (res.ok) {
        const created: TaskCategory = await res.json();
        setCategoryId(created.id);
        setCategorySearch(created.name);
        setShowCategoryDropdown(false);
        onCategoriesChanged?.([...categories, created]);
      }
    } catch {
      /* ignore */
    }
  };

  const handleDeleteCategory = async (catId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/categories/${catId}`, { method: "DELETE" });
      if (res.ok) {
        const updated = categories.filter((c) => c.id !== catId);
        onCategoriesChanged?.(updated);
        if (categoryId === catId) {
          setCategoryId("");
          setCategorySearch("");
        }
        onToast?.("success", "Categoria eliminada");
      } else {
        const data = await res.json().catch(() => null);
        onToast?.("error", data?.error ?? "Error al eliminar la categoria");
      }
    } catch {
      onToast?.("error", "Error de red al eliminar la categoria");
    }
  };

  // --- Attachments ---
  const handleAddAttachment = () => {
    const url = attachmentInput.trim();
    if (url && !attachments.includes(url)) {
      setAttachments([...attachments, url]);
      setAttachmentInput("");
    }
  };

  // --- Frequency helpers ---
  const showDaysOfWeek =
    frequency === "weekly" ||
    frequency === "biweekly" ||
    frequency === "custom";

  const toggleDay = (day: number) => {
    setDaysOfWeek((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  // --- Validation ---
  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!title.trim()) errs.title = "El titulo es obligatorio";
    if (!defaultStatus) errs.defaultStatus = "Selecciona un estado";
    if (!priority) errs.priority = "Selecciona una prioridad";
    if (!frequency) errs.frequency = "Selecciona una frecuencia";
    if (showDaysOfWeek && daysOfWeek.length === 0)
      errs.daysOfWeek = "Selecciona al menos un dia";
    if (!categoryId && !categorySearch.trim())
      errs.category = "Selecciona o crea una categoria";
    if (!taskType) errs.taskType = "Selecciona el tipo de tarea";
    if (defaultStatus === "blocked") {
      if (!blockType) errs.blockType = "Selecciona el tipo de bloqueo";
      if (!blockReason.trim())
        errs.blockReason = "El motivo del bloqueo es obligatorio";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // --- Submit ---
  const handleSubmit = async () => {
    if (!validate()) return;

    // Auto-create category if typed but not matched
    let finalCategoryId = categoryId;
    if (!finalCategoryId && categorySearch.trim()) {
      try {
        const color =
          RANDOM_COLORS[Math.floor(Math.random() * RANDOM_COLORS.length)];
        const res = await fetch("/api/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: categorySearch.trim(), color }),
        });
        if (res.ok) {
          const created: TaskCategory = await res.json();
          finalCategoryId = created.id;
          onCategoriesChanged?.([...categories, created]);
        } else {
          setErrors({ category: "Error al crear la categoria" });
          return;
        }
      } catch {
        setErrors({ category: "Error al crear la categoria" });
        return;
      }
    }

    setLoading(true);
    setErrors({});

    const body: Record<string, unknown> = {
      title: title.trim(),
      description: description || null,
      task_type: taskType,
      default_status: defaultStatus,
      priority,
      frequency,
      days_of_week: showDaysOfWeek ? daysOfWeek : [],
      category_id: finalCategoryId || null,
      attachments,
    };

    if (!isEditing) {
      body.assigned_to = isAdmin ? assignedTo : currentUser.id;
      body.created_by = currentUser.id;
    } else if (isAdmin) {
      body.assigned_to = assignedTo;
    }

    try {
      const url = isEditing
        ? `/api/recurrences/${recurrence.id}`
        : "/api/recurrences";
      const method = isEditing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Error al guardar");
      }

      const saved = await res.json();
      onSaved(saved);
    } catch (err) {
      setErrors({
        general: err instanceof Error ? err.message : "Error inesperado",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border border-white/10 bg-card-secondary shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
          <h2 className="text-lg font-semibold text-text-heading">
            {isEditing ? "Editar Plantilla" : "Nueva Plantilla Recurrente"}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-7 w-7"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Body */}
        <div className="space-y-4 px-6 py-4">
          {errors.general && (
            <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
              {errors.general}
            </p>
          )}

          {/* Title */}
          <div>
            <label className="mb-1 block text-xs font-medium text-text-muted">
              Titulo *
            </label>
            <Input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Nombre de la plantilla"
              className={errors.title ? "border-danger/50" : ""}
            />
            {errors.title && (
              <p className="mt-1 text-[10px] text-danger">{errors.title}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="mb-1 block text-xs font-medium text-text-muted">
              Descripcion
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Detalles de la tarea recurrente..."
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-text placeholder-text-muted/50 focus:border-accent/50 focus:outline-none resize-none"
            />
          </div>

          {/* Task Type toggle */}
          <div>
            <label className="mb-1 block text-xs font-medium text-text-muted">
              Tipo de tarea *
            </label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setTaskType("planeada")}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-lg border py-2 text-xs font-medium",
                  taskType === "planeada"
                    ? "border-info/50 bg-info/10 text-info"
                    : "border-border bg-card text-text-muted hover:bg-white/5"
                )}
              >
                <CalendarClock className="h-4 w-4" />
                Planeada
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setTaskType("incendio")}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-lg border py-2 text-xs font-medium",
                  taskType === "incendio"
                    ? "border-danger/50 bg-danger/10 text-danger"
                    : "border-border bg-card text-text-muted hover:bg-white/5"
                )}
              >
                <Flame className="h-4 w-4" />
                Incendio
              </Button>
            </div>
            {errors.taskType && (
              <p className="mt-1 text-[10px] text-danger">
                {errors.taskType}
              </p>
            )}
          </div>

          {/* Status + Priority row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-text-muted">
                Estado *
              </label>
              <select
                value={defaultStatus}
                onChange={(e) => setDefaultStatus(e.target.value)}
                className={cn(
                  "h-9 w-full rounded-lg border bg-card px-3 text-xs text-text focus:border-accent/50 focus:outline-none",
                  errors.defaultStatus ? "border-danger/50" : "border-border"
                )}
              >
                <option value="pending">Pendiente</option>
                <option value="in_progress">En Progreso</option>
                <option value="completed">Completada</option>
                <option value="blocked">Bloqueada</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-muted">
                Prioridad *
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className={cn(
                  "h-9 w-full rounded-lg border bg-card px-3 text-xs text-text focus:border-accent/50 focus:outline-none",
                  errors.priority ? "border-danger/50" : "border-border"
                )}
              >
                <option value="low">Baja</option>
                <option value="medium">Media</option>
                <option value="high">Alta</option>
                <option value="urgent">Urgente</option>
              </select>
            </div>
          </div>

          {/* Block reason fields (shown when status is blocked) */}
          {defaultStatus === "blocked" && (
            <div className="rounded-lg border border-danger/20 bg-danger/5 p-3 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-danger">
                <ShieldAlert className="h-4 w-4" />
                Motivo del bloqueo
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-medium uppercase tracking-widest text-text-muted">
                  Tipo de bloqueo *
                </label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setBlockType("interno")}
                    className={cn(
                      "flex flex-1 items-center justify-center rounded-lg border py-2 text-xs font-medium",
                      blockType === "interno"
                        ? "border-warning/50 bg-warning/10 text-warning"
                        : "border-border bg-card text-text-muted hover:bg-white/5"
                    )}
                  >
                    Interno (Equipo)
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setBlockType("externo")}
                    className={cn(
                      "flex flex-1 items-center justify-center rounded-lg border py-2 text-xs font-medium",
                      blockType === "externo"
                        ? "border-danger/50 bg-danger/10 text-danger"
                        : "border-border bg-card text-text-muted hover:bg-white/5"
                    )}
                  >
                    Externo (Cliente)
                  </Button>
                </div>
                {errors.blockType && (
                  <p className="mt-1 text-[10px] text-danger">
                    {errors.blockType}
                  </p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-medium uppercase tracking-widest text-text-muted">
                  Motivo *
                </label>
                <textarea
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  rows={2}
                  placeholder="Explica por que la tarea estara bloqueada..."
                  className={cn(
                    "w-full rounded-lg border bg-card px-3 py-2 text-xs text-text placeholder-text-muted/50 focus:border-accent/50 focus:outline-none resize-none",
                    errors.blockReason ? "border-danger/50" : "border-border"
                  )}
                />
                {errors.blockReason && (
                  <p className="mt-1 text-[10px] text-danger">
                    {errors.blockReason}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Frequency + Category row (replaces Due date + Category) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-text-muted">
                Frecuencia *
              </label>
              <select
                value={frequency}
                onChange={(e) =>
                  setFrequency(e.target.value as RecurrenceFrequency)
                }
                className={cn(
                  "h-9 w-full rounded-lg border bg-card px-3 text-xs text-text focus:border-accent/50 focus:outline-none",
                  errors.frequency ? "border-danger/50" : "border-border"
                )}
              >
                {FREQUENCY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {errors.frequency && (
                <p className="mt-1 text-[10px] text-danger">
                  {errors.frequency}
                </p>
              )}
            </div>

            {/* Category combobox */}
            <div ref={catDropdownRef} className="relative">
              <label className="mb-1 block text-xs font-medium text-text-muted">
                Categoria *
              </label>
              <Input
                type="text"
                value={categorySearch}
                onChange={(e) => {
                  setCategorySearch(e.target.value);
                  setCategoryId("");
                  setShowCategoryDropdown(true);
                }}
                onFocus={() => setShowCategoryDropdown(true)}
                placeholder="Buscar o crear..."
                className={cn("h-9 text-xs", errors.category ? "border-danger/50" : "")}
              />
              {errors.category && (
                <p className="mt-1 text-[10px] text-danger">
                  {errors.category}
                </p>
              )}

              {showCategoryDropdown && (
                <div className="absolute top-full left-0 z-20 mt-1 w-full max-h-40 overflow-y-auto rounded-lg border border-border bg-card shadow-xl">
                  {filteredCategories.map((cat) => (
                    <div
                      key={cat.id}
                      className="flex items-center hover:bg-white/5"
                    >
                      <button
                        type="button"
                        onClick={() => handleSelectCategory(cat)}
                        className="flex flex-1 items-center gap-2 px-3 py-2 text-left text-xs text-text"
                      >
                        <span
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: cat.color }}
                        />
                        {cat.name}
                      </button>
                      {!cat.is_default && (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteCategory(cat.id, e)}
                          className="mr-2 rounded p-1 text-text-muted hover:text-danger transition-colors"
                          title="Eliminar categoria"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  ))}
                  {categorySearch.trim() && !exactMatch && (
                    <button
                      type="button"
                      onClick={handleCreateCategory}
                      className="flex w-full items-center gap-2 border-t border-border/50 px-3 py-2 text-left text-xs text-accent hover:bg-white/5"
                    >
                      + Crear &quot;{categorySearch.trim()}&quot;
                    </button>
                  )}
                  {filteredCategories.length === 0 &&
                    !categorySearch.trim() && (
                      <p className="px-3 py-2 text-xs text-text-muted/50">
                        Sin categorias
                      </p>
                    )}
                </div>
              )}
            </div>
          </div>

          {/* Days of week (conditional) */}
          {showDaysOfWeek && (
            <div>
              <label className="mb-2 block text-xs font-medium text-text-muted">
                Dias de la semana *
              </label>
              <div className="flex flex-wrap gap-2">
                {DAY_LABELS.map(({ index, label }) => {
                  const isSelected = daysOfWeek.includes(index);
                  return (
                    <Button
                      key={index}
                      type="button"
                      variant="ghost"
                      onClick={() => toggleDay(index)}
                      className={cn(
                        "h-8 w-12 text-xs font-medium",
                        isSelected
                          ? "bg-info text-white hover:bg-info/90"
                          : "border border-border bg-card text-text-muted hover:border-border/60 hover:text-text"
                      )}
                    >
                      {label}
                    </Button>
                  );
                })}
              </div>
              {errors.daysOfWeek && (
                <p className="mt-1 text-[10px] text-danger">
                  {errors.daysOfWeek}
                </p>
              )}
            </div>
          )}

          {/* Assignee (admin only) */}
          {isAdmin && (
            <div>
              <label className="mb-1 block text-xs font-medium text-text-muted">
                Asignar a
              </label>
              <select
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="h-9 w-full rounded-lg border border-border bg-card px-3 text-xs text-text focus:border-accent/50 focus:outline-none"
              >
                {users
                  .filter((u) => u.is_active)
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                      {u.id === currentUser.id ? " (yo)" : ""}
                    </option>
                  ))}
              </select>
            </div>
          )}

          {/* Attachments */}
          <div>
            <label className="mb-1 block text-xs font-medium text-text-muted">
              Adjuntos (URLs)
            </label>
            <div className="flex gap-2">
              <Input
                type="text"
                value={attachmentInput}
                onChange={(e) => setAttachmentInput(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" &&
                  (e.preventDefault(), handleAddAttachment())
                }
                placeholder="https://..."
                className="h-9 flex-1 text-xs"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleAddAttachment}
              >
                Agregar
              </Button>
            </div>
            {attachments.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {attachments.map((url, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-text-muted"
                  >
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-info hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {url.length > 30 ? url.slice(0, 30) + "..." : url}
                    </a>
                    <button
                      onClick={() =>
                        setAttachments(attachments.filter((_, j) => j !== i))
                      }
                      className="hover:text-danger"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-white/5 px-6 py-4">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            variant="default"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {isEditing ? "Guardar" : "Crear"}
          </Button>
        </div>
      </div>
    </div>
  );
}
