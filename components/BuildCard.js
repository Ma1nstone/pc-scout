"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, ChevronDown, ExternalLink, MonitorSmartphone, Pencil, Trash2, User } from "lucide-react";
import { ESSENTIAL_CATEGORIES, formatPrice } from "@/lib/constants";

export default function BuildCard({ build, parts, costGroups = [], ownerName, showOwner, onDelete, onMoveTab }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // Right-click opens the edit page instead of the browser's own context
  // menu — left click stays instant and only ever toggles the dropdown.
  function handleContextMenu(e) {
    e.preventDefault();
    router.push(`/builds/${build.id}`);
  }

  const total = parts.reduce((sum, p) => sum + (Number(p.price) || 0), 0);
  const complete = ESSENTIAL_CATEGORIES.every((cat) =>
    parts.some((p) => p.category === cat)
  );

  const grouped = parts.reduce((acc, p) => {
    acc[p.category] = acc[p.category] || [];
    acc[p.category].push(p);
    return acc;
  }, {});

  const groupById = useMemo(() => {
    const map = {};
    costGroups.forEach((g) => (map[g.id] = g));
    return map;
  }, [costGroups]);

  const totalPurchaseCost = useMemo(() => {
    const groupsTotal = costGroups.reduce((sum, g) => sum + (Number(g.purchase_price) || 0), 0);
    const ungroupedTotal = parts
      .filter((p) => !p.cost_group_id)
      .reduce((sum, p) => sum + (Number(p.purchase_cost) || 0), 0);
    return groupsTotal + ungroupedTotal;
  }, [costGroups, parts]);

  return (
    <div className="overflow-hidden rounded-xl border border-graphite-700 bg-graphite-900 transition hover:border-graphite-600">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen((o) => !o)}
        onContextMenu={handleContextMenu}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setOpen((o) => !o)}
        className="flex cursor-pointer items-center gap-4 p-4"
      >
        <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-lg bg-graphite-800 ring-1 ring-graphite-700">
          {build.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={build.image_url}
              alt={build.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <MonitorSmartphone size={24} className="text-graphite-500" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate font-display font-semibold text-white">
            {build.name}
          </p>
          <p className="flex items-center gap-1.5 text-xs text-graphite-500">
            {parts.length} part{parts.length === 1 ? "" : "s"} assigned
            {showOwner && ownerName && (
              <span className="flex items-center gap-1 rounded-full bg-graphite-800 px-1.5 py-0.5 text-[10px] text-graphite-400 ring-1 ring-graphite-700">
                <User size={9} />
                {ownerName}
              </span>
            )}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-[11px] text-graphite-500">Cost</p>
          <p className="font-mono text-base font-semibold text-white">
            {formatPrice(totalPurchaseCost)}
          </p>
        </div>

        {build.accepted_price != null ? (
          <div className="shrink-0 text-right">
            <p className="text-[11px] text-graphite-500">Accepted</p>
            <p className="font-mono text-base font-semibold text-signal-green">
              {formatPrice(build.accepted_price)}
            </p>
          </div>
        ) : (
          build.listing_price != null && (
            <div className="shrink-0 text-right">
              <p className="text-[11px] text-graphite-500">Listed</p>
              <p className="font-mono text-base font-semibold text-signal-amber">
                {formatPrice(build.listing_price)}
              </p>
            </div>
          )
        )}

        <span
          className={`status-dot h-3 w-3 shrink-0 rounded-full ${
            complete ? "bg-signal-green text-signal-green" : "bg-signal-red text-signal-red"
          }`}
          title={complete ? "Build complete" : "Missing essential parts"}
        />

        {build.link && (
          <a
            href={build.link}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="shrink-0 rounded-lg p-2 text-graphite-500 hover:bg-graphite-800 hover:text-trace-400"
            aria-label="Open listing link"
            title="Open listing link"
          >
            <ExternalLink size={16} />
          </a>
        )}

        <Link
          href={`/builds/${build.id}`}
          onClick={(e) => e.stopPropagation()}
          className="shrink-0 rounded-lg p-2 text-graphite-500 hover:bg-graphite-800 hover:text-trace-400"
          aria-label="Edit build"
          title="Edit build"
        >
          <Pencil size={16} />
        </Link>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(build);
          }}
          className="shrink-0 rounded-lg p-2 text-graphite-500 hover:bg-signal-red/10 hover:text-signal-red"
          aria-label="Delete build"
          title="Delete build"
        >
          <Trash2 size={16} />
        </button>

        <ChevronDown
          size={20}
          className={`chevron-flip shrink-0 text-graphite-500 ${open ? "open" : ""}`}
        />
      </div>

      <div className={`collapse-panel ${open ? "open" : ""}`}>
        <div>
          <div className="border-t border-graphite-700 px-4 pb-4 pt-3">
            {parts.length === 0 ? (
              <p className="text-sm text-graphite-500">
                No parts assigned yet.{" "}
                <Link href={`/builds/${build.id}`} className="text-trace-400 hover:underline">
                  Add some
                </Link>
                .
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {Object.entries(grouped).map(([category, items]) => (
                  <div key={category} className="rounded-lg bg-graphite-800/60 p-3">
                    <p className="mb-1 font-mono text-[11px] uppercase tracking-wide text-trace-400">
                      {category}
                    </p>
                    {items.map((p) => {
                      const group = p.cost_group_id ? groupById[p.cost_group_id] : null;
                      return (
                        <div key={p.id} className="flex items-center justify-between text-sm">
                          <span className="flex min-w-0 items-center gap-1.5 truncate text-graphite-300">
                            {group && (
                              <span
                                className="h-2 w-2 shrink-0 rounded-full"
                                style={{ backgroundColor: group.color }}
                              />
                            )}
                            {p.name}
                          </span>
                          <span className="ml-2 shrink-0 font-mono text-graphite-400">
                            {group
                              ? `in group (${formatPrice(group.purchase_price)})`
                              : formatPrice(p.purchase_cost)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}

            <div className="mt-3 flex items-center justify-between border-t border-graphite-700 pt-3 text-sm">
              <span className="text-graphite-500">Total purchase cost</span>
              <span className="font-mono font-semibold text-white">
                {formatPrice(totalPurchaseCost)}
              </span>
            </div>

            {!complete && (
              <p className="mt-3 text-xs text-signal-red">
                Missing:{" "}
                {ESSENTIAL_CATEGORIES.filter(
                  (cat) => !parts.some((p) => p.category === cat)
                ).join(", ")}
              </p>
            )}

            {onMoveTab && (
              <button
                onClick={() => onMoveTab(build)}
                className="mt-4 flex w-fit items-center gap-1.5 rounded-lg bg-graphite-800 px-3 py-1.5 text-xs font-medium text-graphite-400 transition hover:bg-graphite-700 hover:text-white"
              >
                <ArrowLeftRight size={13} />
                Move to {build.source === "estimate" ? "Builds" : "Estimate Builds"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}