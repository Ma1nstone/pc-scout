"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Calculator, Check, ExternalLink, ImagePlus, Link2, Plus, Ungroup, Wallet, X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { uploadImage } from "@/lib/uploadImage";
import { usePasteImage } from "@/hooks/usePasteImage";
import { CATEGORIES, ESSENTIAL_CATEGORIES, formatPrice, nextGroupColor } from "@/lib/constants";
import PartPicker from "@/components/PartPicker";
import BuildAssistant from "@/components/BuildAssistant";
import ImageCropModal from "@/components/ImageCropModal";
import CostsPanel from "@/components/CostsPanel";

const OPTIONAL_CATEGORIES = CATEGORIES.filter(
  (c) => !ESSENTIAL_CATEGORIES.includes(c)
);

export default function BuildDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [build, setBuild] = useState(null);
  const [name, setName] = useState("");
  const [link, setLink] = useState("");
  const [allParts, setAllParts] = useState([]);
  const [costGroups, setCostGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pickerCategory, setPickerCategory] = useState(null);
  const [pendingImageFile, setPendingImageFile] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [soldPrice, setSoldPrice] = useState("");
  const [markingSold, setMarkingSold] = useState(false);
  const [listingPrice, setListingPrice] = useState("");
  const [offerPrice, setOfferPrice] = useState("");
  const [sellPrice, setSellPrice] = useState("");

  const [pricingMode, setPricingMode] = useState("estimate");
  const modeInitialized = useRef(false);

  const [selectedIds, setSelectedIds] = useState(new Set());
  const [costsBusy, setCostsBusy] = useState(false);

  // --- Auto-delete-if-untouched -------------------------------------------
  // Only builds opened straight from the "New build" button carry ?new=1.
  // If the person leaves this page without a single change taking effect,
  // the empty shell that was created to get them here is removed instead
  // of sitting in the list forever as an empty "New Build" entry.
  const isNewBuildRef = useRef(searchParams.get("new") === "1");
  const dirtyRef = useRef(false);

  useEffect(() => {
    return () => {
      if (isNewBuildRef.current && !dirtyRef.current) {
        // Page is unmounting (navigated away) — fire-and-forget delete,
        // nothing left to await or show an error for at this point.
        supabase.from("builds").delete().eq("id", id).then(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const [
      { data: buildData, error: buildError },
      { data: partsData },
      { data: costGroupsData },
    ] = await Promise.all([
      supabase.from("builds").select("*").eq("id", id).single(),
      supabase.from("parts").select("*"),
      supabase.from("cost_groups").select("*").eq("build_id", id),
    ]);
    if (buildError) {
      setErrorMsg("Build not found.");
      setLoading(false);
      return;
    }
    setBuild(buildData);
    if (!silent) {
      setName(buildData.name);
      setLink(buildData.link || "");
      setListingPrice(buildData.listing_price != null ? String(buildData.listing_price) : "");
      if (!buildData.sold && buildData.accepted_price != null) {
        setSoldPrice(String(buildData.accepted_price));
      }
      setOfferPrice(buildData.offer_price != null ? String(buildData.offer_price) : "");
      setSellPrice(buildData.sell_price != null ? String(buildData.sell_price) : "");
    }
    setAllParts(partsData || []);
    setCostGroups(costGroupsData || []);
    if (!silent) setLoading(false);

    if (!modeInitialized.current) {
      modeInitialized.current = true;
      setPricingMode(buildData.sold ? "costs" : "estimate");
    }
  }, [id]);

  const loadData = useCallback(() => fetchAll(false), [fetchAll]);
  const refresh = useCallback(() => fetchAll(true), [fetchAll]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const assignedParts = useMemo(
    () => allParts.filter((p) => p.build_id === id),
    [allParts, id]
  );
  const total = assignedParts.reduce((sum, p) => sum + (Number(p.price) || 0), 0);
  const complete = ESSENTIAL_CATEGORIES.every((cat) =>
    assignedParts.some((p) => p.category === cat)
  );

  const groupById = useMemo(() => {
    const map = {};
    costGroups.forEach((g) => (map[g.id] = g));
    return map;
  }, [costGroups]);

  const partCountByGroup = useMemo(() => {
    const map = {};
    assignedParts.forEach((p) => {
      if (!p.cost_group_id) return;
      map[p.cost_group_id] = (map[p.cost_group_id] || 0) + 1;
    });
    return map;
  }, [assignedParts]);

  const totalPurchaseCost = useMemo(() => {
    const groupsTotal = costGroups.reduce((sum, g) => sum + (Number(g.purchase_price) || 0), 0);
    const ungroupedTotal = assignedParts
      .filter((p) => !p.cost_group_id)
      .reduce((sum, p) => sum + (Number(p.purchase_cost) || 0), 0);
    return groupsTotal + ungroupedTotal;
  }, [costGroups, assignedParts]);

  async function saveName() {
    if (!build || name === build.name) return;
    setSaving(true);
    const { error } = await supabase.from("builds").update({ name }).eq("id", id);
    setSaving(false);
    if (error) setErrorMsg(error.message);
    else {
      setBuild((b) => ({ ...b, name }));
      dirtyRef.current = true;
    }
  }

  async function saveLink() {
    if (!build) return;
    const value = link.trim() || null;
    if (value === build.link) return;
    setSaving(true);
    const { error } = await supabase.from("builds").update({ link: value }).eq("id", id);
    setSaving(false);
    if (error) setErrorMsg(error.message);
    else {
      setBuild((b) => ({ ...b, link: value }));
      dirtyRef.current = true;
    }
  }

  async function saveListingPrice() {
    if (!build) return;
    const value = listingPrice === "" ? null : Number(listingPrice);
    if (value === build.listing_price) return;
    setSaving(true);
    const { error } = await supabase.from("builds").update({ listing_price: value }).eq("id", id);
    setSaving(false);
    if (error) setErrorMsg(error.message);
    else {
      setBuild((b) => ({ ...b, listing_price: value }));
      dirtyRef.current = true;
    }
  }

  async function saveOfferPrice() {
    if (!build) return;
    const value = offerPrice === "" ? null : Number(offerPrice);
    if (value === build.offer_price) return;
    setSaving(true);
    const { error } = await supabase.from("builds").update({ offer_price: value }).eq("id", id);
    setSaving(false);
    if (error) setErrorMsg(error.message);
    else {
      setBuild((b) => ({ ...b, offer_price: value }));
      dirtyRef.current = true;
    }
  }

  async function saveSellPrice() {
    if (!build) return;
    const value = sellPrice === "" ? null : Number(sellPrice);
    if (value === build.sell_price) return;
    setSaving(true);
    const { error } = await supabase.from("builds").update({ sell_price: value }).eq("id", id);
    setSaving(false);
    if (error) setErrorMsg(error.message);
    else {
      setBuild((b) => ({ ...b, sell_price: value }));
      dirtyRef.current = true;
    }
  }

  async function uploadAndSetImage(file) {
    if (!file) return;
    setSaving(true);
    try {
      const image_url = await uploadImage(file, "builds");
      const { error } = await supabase.from("builds").update({ image_url }).eq("id", id);
      if (error) throw error;
      setBuild((b) => ({ ...b, image_url }));
      dirtyRef.current = true;
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSaving(false);
    }
  }

  function handleImageChange(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) setPendingImageFile(file);
  }

  function handleCropped(croppedFile) {
    setPendingImageFile(null);
    uploadAndSetImage(croppedFile);
  }

  usePasteImage(!loading && Boolean(build), (file) => setPendingImageFile(file));

  function optionsFor(category) {
    return allParts.filter((p) => p.category === category && !p.build_id);
  }

  async function assignPart(part) {
    const { error } = await supabase
      .from("parts")
      .update({ build_id: id })
      .eq("id", part.id);
    if (error) {
      setErrorMsg(error.message);
      return;
    }
    setAllParts((prev) =>
      prev.map((p) => (p.id === part.id ? { ...p, build_id: id } : p))
    );
    dirtyRef.current = true;
    setPickerCategory(null);
  }

  async function removePart(part) {
    const { error } = await supabase
      .from("parts")
      .update({ build_id: null, cost_group_id: null })
      .eq("id", part.id);
    if (error) {
      setErrorMsg(error.message);
      return;
    }
    setAllParts((prev) =>
      prev.map((p) => (p.id === part.id ? { ...p, build_id: null, cost_group_id: null } : p))
    );
    setSelectedIds((prev) => {
      if (!prev.has(part.id)) return prev;
      const next = new Set(prev);
      next.delete(part.id);
      return next;
    });
  }

  function updatePartField(partId, field, value) {
    setAllParts((prev) =>
      prev.map((p) => (p.id === partId ? { ...p, [field]: value } : p))
    );
  }

  async function savePartField(partId, field) {
    const part = allParts.find((p) => p.id === partId);
    if (!part) return;
    const value = field === "price" ? Number(part.price) || 0 : (part.name || "").trim();
    const { error } = await supabase.from("parts").update({ [field]: value }).eq("id", partId);
    if (error) setErrorMsg(error.message);
    else dirtyRef.current = true;
  }

  async function markAsSold() {
    setMarkingSold(true);
    const { error } = await supabase
      .from("builds")
      .update({
        sold: true,
        sold_price: soldPrice === "" ? null : Number(soldPrice),
        sold_at: new Date().toISOString(),
      })
      .eq("id", id);
    setMarkingSold(false);
    if (error) {
      setErrorMsg(error.message);
      return;
    }
    dirtyRef.current = true;
    router.push("/sales");
  }

  // --- Costs mode: selection + group actions -----------------------------

  function toggleSelect(partId) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(partId)) next.delete(partId);
      else next.add(partId);
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function handleCreateGroup(priceValue) {
    if (selectedIds.size === 0) return;
    setCostsBusy(true);
    try {
      const color = nextGroupColor(costGroups.map((g) => g.color));
      const { data: group, error: groupError } = await supabase
        .from("cost_groups")
        .insert({
          build_id: id,
          purchase_price: priceValue === "" ? 0 : Number(priceValue),
          color,
        })
        .select()
        .single();
      if (groupError) throw groupError;

      const { error: partsError } = await supabase
        .from("parts")
        .update({ cost_group_id: group.id })
        .in("id", Array.from(selectedIds));
      if (partsError) throw partsError;

      dirtyRef.current = true;
      clearSelection();
      await refresh();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setCostsBusy(false);
    }
  }

  async function handleAddToGroup(groupId) {
    if (selectedIds.size === 0) return;
    setCostsBusy(true);
    try {
      const { error } = await supabase
        .from("parts")
        .update({ cost_group_id: groupId })
        .in("id", Array.from(selectedIds));
      if (error) throw error;
      dirtyRef.current = true;
      clearSelection();
      await refresh();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setCostsBusy(false);
    }
  }

  async function handleRemoveFromGroup(partId) {
    setCostsBusy(true);
    try {
      const { error } = await supabase
        .from("parts")
        .update({ cost_group_id: null })
        .eq("id", partId);
      if (error) throw error;
      dirtyRef.current = true;
      await refresh();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setCostsBusy(false);
    }
  }

  async function handleDeleteGroup(groupId) {
    if (!confirm("Delete this purchase group? Its parts go back to ungrouped.")) return;
    setCostsBusy(true);
    try {
      const { error } = await supabase.from("cost_groups").delete().eq("id", groupId);
      if (error) throw error;
      dirtyRef.current = true;
      await refresh();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setCostsBusy(false);
    }
  }

  async function handleUpdateGroupPrice(groupId, value) {
    try {
      const { error } = await supabase
        .from("cost_groups")
        .update({ purchase_price: value === "" ? 0 : Number(value) })
        .eq("id", groupId);
      if (error) throw error;
      dirtyRef.current = true;
      await refresh();
    } catch (err) {
      setErrorMsg(err.message);
    }
  }

  async function handleUpdatePurchaseCost(partId, value) {
    try {
      const { error } = await supabase
        .from("parts")
        .update({ purchase_cost: value === "" ? null : Number(value) })
        .eq("id", partId);
      if (error) throw error;
      dirtyRef.current = true;
      await refresh();
    } catch (err) {
      setErrorMsg(err.message);
    }
  }

  if (loading) return <p className="text-sm text-graphite-500">Loading build…</p>;
  if (!build)
    return (
      <div>
        <p className="mb-4 text-sm text-signal-red">{errorMsg || "Build not found."}</p>
        <Link href="/builds" className="text-trace-400 hover:underline">
          ← Back to builds
        </Link>
      </div>
    );

  const isFromEstimate = build.sell_price != null;
  const inCostsMode = pricingMode === "costs";

  const renderCategorySection = (category) => {
    const items = assignedParts.filter((p) => p.category === category);
    const essential = ESSENTIAL_CATEGORIES.includes(category);
    return (
      <div
        key={category}
        className="rounded-xl border border-graphite-700 bg-graphite-900 p-4"
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <p className="font-mono text-xs uppercase tracking-wide text-trace-400">
              {category}
            </p>
            {essential && (
              <span className="rounded-full bg-graphite-800 px-2 py-0.5 text-[10px] uppercase tracking-wide text-graphite-500 ring-1 ring-graphite-700">
                required
              </span>
            )}
          </div>
          {!inCostsMode && (
            <button
              onClick={() => setPickerCategory(category)}
              className="flex items-center gap-1 rounded-lg bg-graphite-800 px-2.5 py-1 text-xs font-medium text-trace-400 hover:bg-graphite-700"
            >
              <Plus size={13} />
              Add {category}
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <p className="text-xs text-graphite-500">Nothing assigned.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {items.map((p) => {
              const group = inCostsMode && p.cost_group_id ? groupById[p.cost_group_id] : null;
              return (
                <div
                  key={p.id}
                  className="flex items-center gap-2 rounded-lg bg-graphite-800/60 px-3 py-2 text-sm"
                  style={group ? { boxShadow: `inset 3px 0 0 0 ${group.color}` } : undefined}
                >
                  {inCostsMode && (
                    <button
                      onClick={() => toggleSelect(p.id)}
                      className={`grid h-5 w-5 shrink-0 place-items-center rounded border transition ${
                        selectedIds.has(p.id)
                          ? "border-trace-500 bg-trace-500 text-graphite-950"
                          : "border-graphite-600 bg-graphite-900"
                      }`}
                      aria-label={`Select ${p.name}`}
                    >
                      {selectedIds.has(p.id) && <Check size={12} strokeWidth={3} />}
                    </button>
                  )}

                  {inCostsMode ? (
                    <span className="min-w-0 flex-1 truncate text-white">{p.name}</span>
                  ) : (
                    <input
                      value={p.name}
                      onChange={(e) => updatePartField(p.id, "name", e.target.value)}
                      onBlur={() => savePartField(p.id, "name")}
                      className="min-w-0 flex-1 truncate rounded bg-transparent px-1 text-white focus:bg-graphite-900 focus:outline-none focus:ring-1 focus:ring-trace-500"
                    />
                  )}

                  {inCostsMode ? (
                    group ? (
                      <span className="shrink-0 text-xs text-graphite-500">
                        in group ({formatPrice(group.purchase_price)})
                      </span>
                    ) : (
                      <>
                        <span className="shrink-0 font-mono text-graphite-500">£</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          defaultValue={p.purchase_cost ?? ""}
                          onBlur={(e) => handleUpdatePurchaseCost(p.id, e.target.value)}
                          placeholder="0.00"
                          className="w-20 shrink-0 rounded bg-graphite-900 px-2 py-1 text-right font-mono text-graphite-300 placeholder:text-graphite-600 focus:outline-none focus:ring-1 focus:ring-trace-500"
                        />
                      </>
                    )
                  ) : (
                    <>
                      <span className="shrink-0 font-mono text-graphite-500">£</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={p.price}
                        onChange={(e) => updatePartField(p.id, "price", e.target.value)}
                        onBlur={() => savePartField(p.id, "price")}
                        className="w-20 shrink-0 rounded bg-graphite-900 px-2 py-1 text-right font-mono text-graphite-300 focus:outline-none focus:ring-1 focus:ring-trace-500"
                      />
                    </>
                  )}

                  {inCostsMode ? (
                    group ? (
                      <button
                        onClick={() => handleRemoveFromGroup(p.id)}
                        className="shrink-0 text-graphite-500 hover:text-signal-red"
                        aria-label={`Remove ${p.name} from group`}
                        title="Remove from group"
                      >
                        <Ungroup size={14} />
                      </button>
                    ) : (
                      <span className="w-3.5 shrink-0" />
                    )
                  ) : (
                    <button
                      onClick={() => removePart(p)}
                      className="shrink-0 text-graphite-500 hover:text-signal-red"
                      aria-label={`Remove ${p.name}`}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <Link
        href="/builds"
        className="mb-5 inline-flex items-center gap-1.5 text-sm text-graphite-500 hover:text-white"
      >
        <ArrowLeft size={15} />
        Back to builds
      </Link>

      <div className="mb-6 flex flex-col gap-5 rounded-xl border border-graphite-700 bg-graphite-900 p-5 sm:flex-row sm:items-center">
        <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-lg bg-graphite-800 ring-1 ring-graphite-700">
          {build.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={build.image_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImagePlus size={22} className="text-graphite-500" />
          )}
        </div>

        <div className="flex-1">
          <label className="mb-1 block text-xs text-graphite-500">Build name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={saveName}
            className="w-full max-w-sm rounded-lg border border-graphite-700 bg-graphite-800 px-3 py-2 font-display text-lg font-semibold text-white"
          />
          <label className="mt-3 flex w-fit cursor-pointer items-center gap-2 text-xs text-trace-400 hover:underline">
            <ImagePlus size={13} />
            {build.image_url ? "Change photo" : "Add photo"}
            <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
          </label>
          <p className="mt-1 text-[11px] text-graphite-600">or paste an image (Ctrl+V / Cmd+V)</p>

          <label className="mb-1 mt-3 flex items-center gap-1.5 text-xs text-graphite-500">
            <Link2 size={12} />
            Listing link
          </label>
          <div className="flex items-center gap-2">
            <input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              onBlur={saveLink}
              placeholder="https://..."
              className="w-full max-w-sm rounded-lg border border-graphite-700 bg-graphite-800 px-3 py-1.5 text-sm text-white placeholder:text-graphite-500"
            />
            {build.link && (
              <a
                href={build.link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex shrink-0 items-center gap-1 text-xs text-trace-400 hover:text-trace-300"
              >
                Open <ExternalLink size={12} />
              </a>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-6 sm:flex-col sm:items-end sm:gap-1">
          <div className="text-right">
            <p className="text-xs text-graphite-500">Total cost</p>
            <p className="font-mono text-2xl font-bold text-white">
              {formatPrice(totalPurchaseCost)}
            </p>
          </div>
          <span
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
              complete
                ? "bg-signal-green/10 text-signal-green ring-1 ring-signal-green/40"
                : "bg-signal-red/10 text-signal-red ring-1 ring-signal-red/40"
            }`}
          >
            <span className="status-dot h-2 w-2 rounded-full bg-current" />
            {complete ? "Complete" : "Missing parts"}
          </span>
        </div>

        {build.sold ? (
          <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-signal-green/10 px-3 py-1.5 text-xs font-semibold text-signal-green ring-1 ring-signal-green/40 sm:ml-2">
            <Check size={13} />
            Sold{build.sold_price != null ? ` for ${formatPrice(build.sold_price)}` : ""}
          </span>
        ) : (
          <div className="flex shrink-0 flex-col gap-2 sm:ml-2 sm:w-44">
            <input
              type="number"
              step="0.01"
              min="0"
              value={soldPrice}
              onChange={(e) => setSoldPrice(e.target.value)}
              placeholder="Sale price (£)"
              className="rounded-lg border border-graphite-700 bg-graphite-800 px-3 py-2 text-sm text-white placeholder:text-graphite-500"
            />
            <button
              onClick={markAsSold}
              disabled={markingSold}
              className="flex items-center justify-center gap-1.5 rounded-lg bg-signal-green/15 px-3 py-2 text-xs font-semibold text-signal-green ring-1 ring-signal-green/40 transition hover:bg-signal-green/25 disabled:opacity-60"
            >
              <Check size={14} />
              Mark as Sold
            </button>
          </div>
        )}
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 rounded-xl border border-graphite-700 bg-graphite-900 p-4 sm:grid-cols-4">
        <div className="rounded-lg bg-graphite-800/60 p-3">
          <p className="text-xs text-graphite-500">Estimate (sum of parts)</p>
          <p className="mt-1 font-mono text-lg font-bold text-white">{formatPrice(total)}</p>
          <p className="mt-1 text-[11px] text-graphite-600">
            Always the total of the parts below — edit them to change this.
          </p>
        </div>

        <div className="rounded-lg bg-graphite-800/60 p-3">
          <label className="text-xs text-graphite-500">Listing price</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={listingPrice}
            onChange={(e) => setListingPrice(e.target.value)}
            onBlur={saveListingPrice}
            placeholder="£ asking"
            className="mt-1 w-full rounded-lg border border-graphite-700 bg-graphite-900 px-2 py-1.5 font-mono text-lg font-bold text-white placeholder:text-graphite-600"
          />
        </div>

        <div className="rounded-lg bg-signal-red/10 p-3 ring-1 ring-signal-red/30">
          <label className="text-xs text-signal-red">Offer price</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={offerPrice}
            onChange={(e) => setOfferPrice(e.target.value)}
            onBlur={saveOfferPrice}
            placeholder="£ offer"
            className="mt-1 w-full rounded-lg border border-signal-red/30 bg-graphite-800 px-2 py-1.5 font-mono text-lg font-bold text-signal-red placeholder:text-graphite-600"
          />
        </div>

        {isFromEstimate && (
          <div className="rounded-lg bg-signal-green/10 p-3 ring-1 ring-signal-green/30">
            <label className="text-xs text-signal-green">Sell price</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={sellPrice}
              onChange={(e) => setSellPrice(e.target.value)}
              onBlur={saveSellPrice}
              placeholder="£ sell"
              className="mt-1 w-full rounded-lg border border-signal-green/30 bg-graphite-800 px-2 py-1.5 font-mono text-lg font-bold text-signal-green placeholder:text-graphite-600"
            />
          </div>
        )}
      </div>

      <div className="mb-6 flex w-fit gap-1 rounded-full border border-graphite-700 bg-graphite-900 p-1">
        <button
          onClick={() => setPricingMode("costs")}
          className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition ${
            pricingMode === "costs"
              ? "bg-trace-500/15 text-trace-400 ring-1 ring-trace-500/40"
              : "text-graphite-500 hover:text-white"
          }`}
        >
          <Wallet size={14} />
          Costs
        </button>

        <button
          onClick={() => setPricingMode("estimate")}
          className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition ${
            pricingMode === "estimate"
              ? "bg-trace-500/15 text-trace-400 ring-1 ring-trace-500/40"
              : "text-graphite-500 hover:text-white"
          }`}
        >
          <Calculator size={14} />
          Estimate
        </button>
      </div>


      {inCostsMode && (
        <CostsPanel
          costGroups={costGroups}
          partCountByGroup={partCountByGroup}
          selectedIds={selectedIds}
          onClearSelection={clearSelection}
          onCreateGroup={handleCreateGroup}
          onAddToGroup={handleAddToGroup}
          onUpdateGroupPrice={handleUpdateGroupPrice}
          onDeleteGroup={handleDeleteGroup}
          totalPurchaseCost={totalPurchaseCost}
          busy={costsBusy}
        />
      )}

      <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wide text-graphite-500">
        Essential parts
      </h2>
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {ESSENTIAL_CATEGORIES.map(renderCategorySection)}
      </div>

      <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wide text-graphite-500">
        Optional parts
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {OPTIONAL_CATEGORIES.map(renderCategorySection)}
      </div>

      {pendingImageFile && (
        <ImageCropModal
          file={pendingImageFile}
          onCancel={() => setPendingImageFile(null)}
          onCropped={handleCropped}
        />
      )}

      {pickerCategory && (
        <PartPicker
          category={pickerCategory}
          options={optionsFor(pickerCategory)}
          onChoose={assignPart}
          onClose={() => setPickerCategory(null)}
        />
      )}

      <BuildAssistant parts={assignedParts} total={total} buildName={build.name} />
    </div>
  );
}