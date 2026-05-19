"use client";

import {
  useCallback,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";

interface DashboardGridProps {
  initialOrder: string[];
  initialCollapsed: string[];
  cards: Record<string, ReactNode>;
  saveOrder: (order: string[]) => Promise<void>;
  saveCollapsed: (key: string, collapsed: boolean) => Promise<void>;
}

// Per-card grid spans. The MD/CRNA card carries the longest text on the
// dashboard (`cPaoliTrBeep 11p-7a` etc.) so it gets a wider slot at lg.
const CARD_SPAN: Record<string, string | undefined> = {
  spinfusion: "lg:col-span-2",
};

export function DashboardGrid({
  initialOrder,
  initialCollapsed,
  cards,
  saveOrder,
  saveCollapsed,
}: DashboardGridProps) {
  const [order, setOrder] = useState(initialOrder);
  const [collapsed, setCollapsedState] = useState<Set<string>>(
    () => new Set(initialCollapsed),
  );
  const [editMode, setEditMode] = useState(false);
  const [draggedKey, setDraggedKey] = useState<string | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const lastSavedOrderRef = useRef<string>(initialOrder.join("|"));

  const persistOrder = useCallback(
    (next: string[]) => {
      const sig = next.join("|");
      if (sig === lastSavedOrderRef.current) return;
      lastSavedOrderRef.current = sig;
      startTransition(() => {
        saveOrder(next).catch(() => {});
      });
    },
    [saveOrder],
  );

  const move = useCallback(
    (key: string, direction: -1 | 1) => {
      setOrder((cur) => {
        const idx = cur.indexOf(key);
        if (idx < 0) return cur;
        const next = idx + direction;
        if (next < 0 || next >= cur.length) return cur;
        const out = [...cur];
        const [removed] = out.splice(idx, 1);
        out.splice(next, 0, removed);
        persistOrder(out);
        return out;
      });
    },
    [persistOrder],
  );

  const reorderTo = useCallback(
    (fromKey: string, toKey: string) => {
      if (fromKey === toKey) return;
      setOrder((cur) => {
        const from = cur.indexOf(fromKey);
        const to = cur.indexOf(toKey);
        if (from < 0 || to < 0) return cur;
        const out = [...cur];
        const [moved] = out.splice(from, 1);
        out.splice(to, 0, moved);
        persistOrder(out);
        return out;
      });
    },
    [persistOrder],
  );

  const toggleCollapsed = useCallback(
    (key: string) => {
      setCollapsedState((cur) => {
        const next = new Set(cur);
        const willCollapse = !next.has(key);
        if (willCollapse) next.add(key);
        else next.delete(key);
        startTransition(() => {
          saveCollapsed(key, willCollapse).catch(() => {});
        });
        return next;
      });
    },
    [saveCollapsed],
  );

  return (
    <div>
      <div className="flex items-center justify-end mb-3 gap-2">
        {editMode && (
          <span className="text-[10px] font-mono uppercase tracking-widest text-ink-3">
            Drag to reorder · ↑↓ buttons · tap ⌃ to collapse
          </span>
        )}
        <button
          type="button"
          onClick={() => setEditMode((v) => !v)}
          className={cn(
            "text-[11px] font-mono uppercase tracking-widest px-3 py-1.5 rounded-pill border transition-colors",
            editMode
              ? "border-teal text-teal bg-teal-soft/40"
              : "border-border text-ink-3 hover:text-ink hover:border-border-2",
          )}
        >
          {editMode ? "Done" : "Rearrange"}
        </button>
      </div>

      <section className="grid gap-4 md:gap-5 md:grid-cols-2 lg:grid-cols-3 items-start">
        {order
          .filter((k) => cards[k] !== undefined)
          .map((key, i, arr) => (
            <CardSlot
              key={key}
              cardKey={key}
              editMode={editMode}
              collapsed={collapsed.has(key)}
              isDragged={draggedKey === key}
              isDragOver={overKey === key && draggedKey !== key}
              canMoveUp={i > 0}
              canMoveDown={i < arr.length - 1}
              extraClassName={CARD_SPAN[key]}
              onToggleCollapsed={() => toggleCollapsed(key)}
              onDragStart={() => setDraggedKey(key)}
              onDragEnd={() => {
                setDraggedKey(null);
                setOverKey(null);
              }}
              onDragOver={() => setOverKey(key)}
              onDrop={(from) => {
                reorderTo(from, key);
                setDraggedKey(null);
                setOverKey(null);
              }}
              onMoveUp={() => move(key, -1)}
              onMoveDown={() => move(key, +1)}
            >
              {cards[key]}
            </CardSlot>
          ))}
      </section>
    </div>
  );
}

interface SlotProps {
  cardKey: string;
  editMode: boolean;
  collapsed: boolean;
  isDragged: boolean;
  isDragOver: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  extraClassName?: string;
  onToggleCollapsed: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: () => void;
  onDrop: (fromKey: string) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  children: ReactNode;
}

function CardSlot({
  cardKey,
  editMode,
  collapsed,
  isDragged,
  isDragOver,
  canMoveUp,
  canMoveDown,
  extraClassName,
  onToggleCollapsed,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onMoveUp,
  onMoveDown,
  children,
}: SlotProps) {
  return (
    <div
      draggable={editMode}
      onDragStart={(e) => {
        if (!editMode) return;
        e.dataTransfer.setData("text/x-card-key", cardKey);
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onDragEnter={() => editMode && onDragOver()}
      onDragOver={(e) => {
        if (!editMode) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      }}
      onDrop={(e) => {
        if (!editMode) return;
        e.preventDefault();
        const from = e.dataTransfer.getData("text/x-card-key") ?? cardKey;
        onDrop(from);
      }}
      data-card-key={cardKey}
      data-collapsed={collapsed ? "true" : undefined}
      className={cn(
        "relative transition-all duration-200",
        editMode && "cursor-grab",
        isDragged && "opacity-40",
        isDragOver &&
          "ring-2 ring-teal ring-offset-2 ring-offset-cream rounded-card",
        // Hide all children of the Card after the header when collapsed.
        collapsed &&
          "[&>div>*:not(:first-child)]:hidden [&>div>:first-child]:pb-6",
        extraClassName,
      )}
    >
      {editMode && (
        <div className="absolute inset-x-0 -top-3 z-20 flex items-center justify-between px-2 pointer-events-none">
          <div className="flex items-center gap-1 pointer-events-auto">
            <span
              aria-hidden
              className="flex h-6 w-6 items-center justify-center rounded-pill bg-surface border border-border text-ink-3 shadow-sm"
              title="Drag to reorder"
            >
              <GripIcon className="h-3.5 w-3.5" />
            </span>
          </div>
          <div className="flex items-center gap-1 pointer-events-auto">
            <ReorderButton
              disabled={!canMoveUp}
              onClick={onMoveUp}
              label="Move up"
            >
              <ChevronIcon dir="up" />
            </ReorderButton>
            <ReorderButton
              disabled={!canMoveDown}
              onClick={onMoveDown}
              label="Move down"
            >
              <ChevronIcon dir="down" />
            </ReorderButton>
            <ReorderButton
              disabled={false}
              onClick={onToggleCollapsed}
              label={collapsed ? "Expand card" : "Collapse card"}
              active={collapsed}
            >
              <CollapseIcon collapsed={collapsed} />
            </ReorderButton>
          </div>
        </div>
      )}
      {children}
    </div>
  );
}

function ReorderButton({
  onClick,
  disabled,
  label,
  active,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  label: string;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "flex h-6 w-6 items-center justify-center rounded-pill bg-surface border transition-colors shadow-sm",
        disabled
          ? "border-border text-ink-3/40 cursor-not-allowed"
          : active
            ? "border-teal text-teal bg-teal-soft/60"
            : "border-border text-ink-2 hover:text-ink hover:border-border-2",
      )}
    >
      {children}
    </button>
  );
}

function GripIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <circle cx="5" cy="4" r="1.2" />
      <circle cx="5" cy="8" r="1.2" />
      <circle cx="5" cy="12" r="1.2" />
      <circle cx="11" cy="4" r="1.2" />
      <circle cx="11" cy="8" r="1.2" />
      <circle cx="11" cy="12" r="1.2" />
    </svg>
  );
}

function ChevronIcon({ dir }: { dir: "up" | "down" }) {
  return (
    <svg
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5"
      aria-hidden
      style={{ transform: dir === "down" ? "rotate(180deg)" : undefined }}
    >
      <path d="M3 9l4-4 4 4" />
    </svg>
  );
}

function CollapseIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5"
      aria-hidden
    >
      {collapsed ? (
        // Plus when collapsed — click to expand
        <>
          <path d="M3 7h8" />
          <path d="M7 3v8" />
        </>
      ) : (
        // Minus when expanded — click to collapse
        <path d="M3 7h8" />
      )}
    </svg>
  );
}
