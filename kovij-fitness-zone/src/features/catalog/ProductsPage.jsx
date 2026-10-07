import { useEffect, useMemo, useRef, useState } from "react";
import { Eye, EyeOff, ImagePlus, Package, Pencil, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { productsResource, useUploadProductImage } from "./api";
import { prepareProductPhoto } from "./productPhoto";
import { usePermission } from "../auth/permissions";
import { useOnlineStatus } from "../../shared/hooks/useOnlineStatus";
import {
  Badge,
  Button,
  Card,
  Dialog,
  EmptyState,
  ErrorState,
  Field,
  FilterChips,
  FormError,
  InlineAlert,
  Input,
  PageHeader,
  SearchInput,
  Select,
  SkeletonList,
  Switch,
  Textarea,
  useConfirm,
  useToast,
} from "../../shared/ui";
import { cn } from "../../shared/lib/cn";
import { formatINR } from "../../shared/lib/format";

/** Same categories as the website shop (server: models/Product.js). */
const CATEGORIES = [
  { value: "protein", label: "Protein" },
  { value: "preworkout", label: "Pre-workout" },
  { value: "vitamins", label: "Vitamins" },
  { value: "accessories", label: "Gear and accessories" },
];
const CATEGORY_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.value, c.label]));

const EMPTY = { name: "", brand: "", sku: "", category: "protein", price: "", discountPrice: "", stock: "0", image: "", badge: "", rating: "", description: "", showOnFrontend: true };
const num = (v) => (v === "" || v == null ? undefined : Number(v));

/** Product photo, or a placeholder when there is none or it can't load. */
function ProductImage({ src, className }) {
  const [failed, setFailed] = useState(null);
  if (!src || failed === src) {
    return (
      <span className={cn("grid shrink-0 place-items-center bg-surface-2 text-ink-3", className)}>
        <Package className="size-1/3" aria-hidden />
      </span>
    );
  }
  return <img src={src} alt="" loading="lazy" onError={() => setFailed(src)} className={cn("shrink-0 bg-white object-cover", className)} />;
}

function ProductDialog({ open, product, onClose }) {
  const save = productsResource.useSave();
  const upload = useUploadProductImage();
  const toast = useToast();
  const online = useOnlineStatus();
  const fileRef = useRef(null);
  const [form, setForm] = useState(EMPTY);
  const [clientErrors, setClientErrors] = useState({});
  const [preparing, setPreparing] = useState(false);

  useEffect(() => {
    if (!open) return;
    save.reset();
    upload.reset();
    setClientErrors({});
    setForm(
      product
        ? {
            ...EMPTY,
            ...product,
            price: String(product.price ?? ""),
            discountPrice: product.discountPrice != null ? String(product.discountPrice) : "",
            stock: String(product.stock ?? 0),
            rating: product.rating ? String(product.rating) : "",
            badge: product.badge || "",
            description: product.description || "",
          }
        : EMPTY
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const errors = { ...(save.error?.fields || {}), ...clientErrors };
  const busyPhoto = preparing || upload.isPending;

  const choosePhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPreparing(true);
    setClientErrors((c) => ({ ...c, image: undefined }));
    try {
      const prepared = await prepareProductPhoto(file);
      setPreparing(false);
      const { url } = await upload.mutateAsync(prepared);
      set({ image: url });
    } catch (err) {
      setPreparing(false);
      setClientErrors((c) => ({ ...c, image: err.message || "The photo couldn’t be uploaded. Try again." }));
    }
  };

  const submit = (e) => {
    e.preventDefault();
    const next = {};
    if (!form.name.trim()) next.name = "Name the product";
    if (!form.brand.trim()) next.brand = "Add the brand";
    if (!form.sku.trim()) next.sku = "Add the SKU (stock code)";
    if (form.price === "" || Number(form.price) < 0) next.price = "Enter the price in rupees";
    if (form.discountPrice !== "" && Number(form.discountPrice) >= Number(form.price)) next.discountPrice = "The sale price must be lower than the price";
    if (!form.image.trim()) next.image = "Add a photo of the product";
    setClientErrors(next);
    if (Object.keys(next).length) return;
    const payload = {
      name: form.name,
      brand: form.brand,
      sku: form.sku,
      category: form.category,
      price: Number(form.price),
      discountPrice: form.discountPrice === "" ? null : Number(form.discountPrice),
      stock: num(form.stock) ?? 0,
      image: form.image.trim(),
      badge: form.badge || undefined,
      rating: num(form.rating),
      description: form.description || undefined,
      showOnFrontend: form.showOnFrontend,
    };
    save.mutate({ id: product?._id, payload }, { onSuccess: () => (toast.success(product ? "Product saved" : "Product added", { description: form.name }), onClose()) });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={product ? `Edit ${product.name}` : "New product"}
      description="Products marked “Show on website” appear in the shop."
      placement="side"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="product-form" variant="primary" loading={save.isPending} disabled={!online || busyPhoto}>
            {product ? "Save product" : "Add product"}
          </Button>
        </>
      }
    >
      {!online && (
        <InlineAlert tone="offline" className="mb-4">
          Saving products needs a connection. Reconnect to continue.
        </InlineAlert>
      )}
      <FormError error={save.error} />
      <form id="product-form" onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
        <Field label="Photo" required error={errors.image} hint="A square photo on a plain background looks best in the shop." className="sm:col-span-2">
          <div className="flex items-center gap-4">
            <ProductImage src={form.image} className="size-24 rounded-tile border border-line" />
            <div className="flex flex-col items-start gap-2">
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={choosePhoto} tabIndex={-1} aria-hidden />
              <Button variant="secondary" icon={ImagePlus} loading={busyPhoto} disabled={!online} onClick={() => fileRef.current?.click()}>
                {busyPhoto ? "Uploading…" : form.image ? "Change photo" : "Upload photo"}
              </Button>
            </div>
          </div>
        </Field>
        <Field label="Or paste a photo link" optional className="sm:col-span-2">
          <Input
            type="url"
            inputMode="url"
            value={form.image.startsWith("http") ? form.image : ""}
            onChange={(e) => set({ image: e.target.value })}
            placeholder="https://…"
            maxLength={1000}
          />
        </Field>
        <Field label="Product name" required error={errors.name} className="sm:col-span-2">
          <Input value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Whey protein isolate 1 kg" maxLength={120} />
        </Field>
        <Field label="Brand" required error={errors.brand}>
          <Input value={form.brand} onChange={(e) => set({ brand: e.target.value })} maxLength={80} />
        </Field>
        <Field label="SKU" required hint="Your stock code. Each product needs its own." error={errors.sku}>
          <Input value={form.sku} onChange={(e) => set({ sku: e.target.value })} autoCapitalize="characters" maxLength={60} />
        </Field>
        <Field label="Category" error={errors.category}>
          <Select value={form.category} onChange={(e) => set({ category: e.target.value })}>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="In stock" error={errors.stock}>
          <Input type="number" inputMode="numeric" min="0" step="1" value={form.stock} onChange={(e) => set({ stock: e.target.value })} suffix="units" />
        </Field>
        <Field label="Price" required error={errors.price}>
          <Input prefix="₹" type="number" inputMode="decimal" min="0" value={form.price} onChange={(e) => set({ price: e.target.value })} />
        </Field>
        <Field label="Sale price" optional hint="Shown with the price struck through." error={errors.discountPrice}>
          <Input prefix="₹" type="number" inputMode="decimal" min="0" value={form.discountPrice} onChange={(e) => set({ discountPrice: e.target.value })} />
        </Field>
        <Field label="Label" optional hint="e.g. Best seller, New" error={errors.badge}>
          <Input value={form.badge} onChange={(e) => set({ badge: e.target.value })} maxLength={40} />
        </Field>
        <Field label="Rating" optional hint="Out of 5, shown as stars." error={errors.rating}>
          <Input type="number" inputMode="decimal" min="0" max="5" step="0.1" value={form.rating} onChange={(e) => set({ rating: e.target.value })} />
        </Field>
        <Field label="Description" optional error={errors.description} className="sm:col-span-2">
          <Textarea value={form.description} onChange={(e) => set({ description: e.target.value })} rows={3} maxLength={1000} />
        </Field>
        <div className="sm:col-span-2">
          <Switch label="Show on website" description="Turn off to hide it from the shop without deleting it." checked={form.showOnFrontend} onChange={(showOnFrontend) => set({ showOnFrontend })} />
        </div>
      </form>
    </Dialog>
  );
}

function Price({ product }) {
  const onSale = product.discountPrice != null && product.discountPrice < product.price;
  return (
    <div className="text-right">
      <p className="tabular text-title-lg font-bold">{formatINR(onSale ? product.discountPrice : product.price)}</p>
      {onSale && <p className="tabular text-body-sm text-ink-3 line-through">{formatINR(product.price)}</p>}
    </div>
  );
}

export default function ProductsPage() {
  const products = productsResource.useList();
  const remove = productsResource.useRemove();
  const canManage = usePermission("plans.manage");
  const confirm = useConfirm();
  const toast = useToast();
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("all");

  const all = useMemo(() => products.data || [], [products.data]);
  const term = q.trim().toLowerCase();
  const shown = all.filter(
    (p) => (category === "all" || p.category === category) && (!term || [p.name, p.brand, p.sku].some((v) => String(v || "").toLowerCase().includes(term)))
  );
  const chips = [{ value: "all", label: "All", count: all.length }, ...CATEGORIES.map((c) => ({ ...c, count: all.filter((p) => p.category === c.value).length }))];

  const onDelete = async (product) => {
    const ok = await confirm({
      title: `Delete ${product.name}?`,
      body: "It is removed from the shop and can't be brought back. To take it off the website for now, hide it instead.",
      confirmLabel: "Delete product",
      tone: "danger",
    });
    if (!ok) return;
    remove.mutate(product._id, {
      onSuccess: () => toast.success(`${product.name} deleted`),
      onError: (e) => toast.error("Couldn't delete the product", { description: e.message }),
    });
  };

  const addButton = canManage && (
    <Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>
      New product
    </Button>
  );

  return (
    <>
      <PageHeader title="Products" description="Supplements and gear for the website shop." actions={addButton} />
      {products.isPending ? (
        <Card>
          <SkeletonList rows={4} />
        </Card>
      ) : products.isError ? (
        <Card>
          <ErrorState error={products.error} onRetry={() => products.refetch()} />
        </Card>
      ) : all.length === 0 ? (
        <Card>
          <EmptyState
            icon={ShoppingBag}
            title="No products yet"
            body="Add the supplements and gear you sell, with a photo and price. They appear in the website shop."
            action={addButton}
          />
        </Card>
      ) : (
        <>
          <div className="mb-4 flex flex-col gap-3">
            <SearchInput value={q} onChange={setQ} label="Search products" placeholder="Name, brand or SKU" className="md:max-w-sm" />
            <FilterChips label="Category" value={category} onChange={setCategory} options={chips} />
          </div>
          {shown.length === 0 ? (
            <Card>
              <EmptyState
                compact
                icon={Package}
                title="No products match"
                body="Try another search or category."
                action={
                  <Button variant="secondary" onClick={() => (setQ(""), setCategory("all"))}>
                    Clear filters
                  </Button>
                }
              />
            </Card>
          ) : (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
              {shown.map((p) => (
                <li key={p._id}>
                  <Card padding="sm" className={cn("flex h-full flex-col", !p.showOnFrontend && "opacity-75")}>
                    <div className="flex items-start gap-3">
                      <ProductImage src={p.image} className="size-16 rounded-tile" />
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-title font-semibold">{p.name}</p>
                        <p className="line-clamp-2 break-words text-body-sm text-ink-3">
                          {[p.brand, CATEGORY_LABEL[p.category], p.sku].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <Price product={p} />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {p.stock > 0 ? (
                        <Badge size="sm" tone="good">
                          {p.stock} in stock
                        </Badge>
                      ) : (
                        <Badge size="sm" tone="warn">
                          Out of stock
                        </Badge>
                      )}
                      {p.showOnFrontend ? (
                        <Badge size="sm" icon={Eye}>
                          On website
                        </Badge>
                      ) : (
                        <Badge size="sm" icon={EyeOff}>
                          Hidden from website
                        </Badge>
                      )}
                      {p.badge && (
                        <Badge size="sm" tone="brand">
                          {p.badge}
                        </Badge>
                      )}
                    </div>
                    {canManage && (
                      <div className="mt-auto flex gap-2 pt-3">
                        <Button size="sm" variant="quiet" icon={Pencil} onClick={() => setEditing(p)}>
                          Edit
                        </Button>
                        <Button size="sm" variant="ghost" icon={Trash2} onClick={() => onDelete(p)}>
                          Delete
                        </Button>
                      </div>
                    )}
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      <ProductDialog open={creating || Boolean(editing)} product={editing} onClose={() => (setCreating(false), setEditing(null))} />
    </>
  );
}
