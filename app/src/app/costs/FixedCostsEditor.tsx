"use client";

import { useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  addFixedCost,
  deleteFixedCost,
  updateFixedCost,
} from "@/lib/domain/costs/server";

interface FixedCost {
  id: string;
  service: string;
  monthly_usd: number;
  active: boolean;
  notes: string | null;
}

const fmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

export function FixedCostsEditor({ initial }: { initial: FixedCost[] }) {
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div className="space-y-4">
      {initial.length === 0 ? (
        <p className="text-sm text-ink-3">
          No fixed costs yet. Add Supabase, Vercel, Railway, your domain, etc.
        </p>
      ) : (
        <ul className="divide-y divide-border border border-border rounded-input overflow-hidden bg-surface">
          {initial.map((fc) => (
            <Row key={fc.id} fc={fc} />
          ))}
        </ul>
      )}

      <form
        ref={formRef}
        action={(fd) =>
          startTransition(async () => {
            await addFixedCost(fd);
            formRef.current?.reset();
          })
        }
        className="flex flex-wrap items-end gap-2 pt-2"
      >
        <div className="flex-1 min-w-[160px]">
          <label className="text-xs font-mono uppercase tracking-widest text-ink-3 block mb-1">
            Service
          </label>
          <Input name="service" placeholder="Supabase Pro" required />
        </div>
        <div className="w-32">
          <label className="text-xs font-mono uppercase tracking-widest text-ink-3 block mb-1">
            $ / mo
          </label>
          <Input
            name="monthly_usd"
            type="number"
            step="0.01"
            min="0"
            placeholder="25.00"
            required
          />
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Adding…" : "Add"}
        </Button>
      </form>
      <p className="text-xs text-ink-3 font-mono">
        Total active fixed:{" "}
        <span className="text-ink-2">
          {fmt.format(
            initial.filter((f) => f.active).reduce((a, b) => a + b.monthly_usd, 0),
          )}
          /mo
        </span>
      </p>
    </div>
  );
}

function Row({ fc }: { fc: FixedCost }) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  if (editing) {
    return (
      <li className="px-3 py-2">
        <form
          action={(fd) =>
            startTransition(async () => {
              await updateFixedCost(fd);
              setEditing(false);
            })
          }
          className="flex flex-wrap items-center gap-2"
        >
          <input type="hidden" name="id" value={fc.id} />
          <Input
            name="service"
            defaultValue={fc.service}
            className="flex-1 min-w-[160px]"
          />
          <Input
            name="monthly_usd"
            type="number"
            step="0.01"
            min="0"
            defaultValue={fc.monthly_usd}
            className="w-28"
          />
          <label className="flex items-center gap-1 text-xs text-ink-2">
            <input
              type="checkbox"
              name="active"
              defaultChecked={fc.active}
              className="accent-[var(--teal)]"
            />
            Active
          </label>
          <Button type="submit" size="sm" disabled={pending}>
            Save
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setEditing(false)}
            disabled={pending}
          >
            Cancel
          </Button>
        </form>
      </li>
    );
  }

  return (
    <li className="flex items-center px-3 py-2 gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-ink">
          {fc.service}{" "}
          {!fc.active && (
            <span className="text-[10px] font-mono uppercase tracking-widest text-ink-3 ml-1">
              inactive
            </span>
          )}
        </p>
      </div>
      <span className="font-mono tabular-nums text-sm text-ink-2">
        {fmt.format(fc.monthly_usd)}/mo
      </span>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setEditing(true)}
        disabled={pending}
      >
        Edit
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          if (!confirm(`Remove ${fc.service}?`)) return;
          startTransition(() => deleteFixedCost(fc.id));
        }}
        disabled={pending}
        className="text-red"
      >
        Remove
      </Button>
    </li>
  );
}
