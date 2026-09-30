import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Columns2, ImageOff, ImagePlus, Images, Lock, RefreshCw, Trash2 } from "lucide-react";
import { useDeletePhoto, usePhotos, usePrivateImage, useUploadPhoto } from "./api";
import { POSES, POSE_LABEL, dayToDate, formatMeasure } from "./labels";
import { preparePhoto } from "./preparePhoto";
import { shiftDayKey } from "../diet/labels";
import { useOnlineStatus } from "../../shared/hooks/useOnlineStatus";
import { Button, Card, CardHeader, Dialog, EmptyState, ErrorState, Field, FormError, InlineAlert, Input, SegmentedControl, Select, Skeleton, useConfirm, useToast } from "../../shared/ui";
import { cn } from "../../shared/lib/cn";
import { formatDate, gymDayKey } from "../../shared/lib/format";

/** A private photo loaded with the staff token. Portrait frame so poses line up side by side. */
function PrivatePhoto({ photo, alt, className }) {
  const image = usePrivateImage(photo?.url, photo?.updatedAt);
  return (
    <div className={cn("relative aspect-[3/4] overflow-hidden rounded-tile bg-surface-2", className)}>
      {image.isError ? (
        <div className="flex size-full flex-col items-center justify-center gap-1 p-2 text-center text-xs text-ink-3">
          <ImageOff className="size-5" aria-hidden />
          Couldn&apos;t load
          <button type="button" onClick={() => image.refetch()} className="mt-1 inline-flex min-h-8 items-center gap-1 font-semibold text-ink-2 hover:text-ink">
            <RefreshCw className="size-3.5" aria-hidden />
            Retry
          </button>
        </div>
      ) : image.src ? (
        <img src={image.src} alt={alt} className="size-full object-cover" />
      ) : (
        <Skeleton className="size-full rounded-none" />
      )}
    </div>
  );
}

function EmptySlot({ pose }) {
  return (
    <div className="flex aspect-[3/4] items-center justify-center rounded-tile border border-dashed border-line-strong p-2 text-center text-xs text-ink-3">
      No {POSE_LABEL[pose].toLowerCase()} photo
    </div>
  );
}

function UploadDialog({ open, onClose, memberId, photos }) {
  const upload = useUploadPhoto(memberId);
  const online = useOnlineStatus();
  const toast = useToast();
  const inputRef = useRef(null);
  const today = gymDayKey();
  const [day, setDay] = useState(today);
  const [pose, setPose] = useState("front");
  const [blob, setBlob] = useState(null);
  const [preview, setPreview] = useState(null);
  const [prepError, setPrepError] = useState("");
  const [preparing, setPreparing] = useState(false);

  useEffect(() => {
    if (!open) return;
    upload.reset();
    setDay(today);
    setPose("front");
    setBlob(null);
    setPrepError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!blob) {
      setPreview(null);
      return undefined;
    }
    const url = URL.createObjectURL(blob);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [blob]);

  const taken = new Set(photos.filter((p) => p.day === day).map((p) => p.pose));
  const replacing = taken.has(pose);

  const choose = async (file) => {
    setPrepError("");
    setBlob(null);
    if (!file) return;
    setPreparing(true);
    try {
      setBlob(await preparePhoto(file));
    } catch (e) {
      setPrepError(e.message);
    } finally {
      setPreparing(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const submit = (e) => {
    e.preventDefault();
    if (!blob) return setPrepError("Choose a photo first.");
    upload.mutate(
      { blob, pose, day },
      {
        onSuccess: (data) => {
          toast.success(data.replaced ? "Photo replaced" : "Photo uploaded", { description: `${POSE_LABEL[pose]}, ${formatDate(dayToDate(day))}` });
          const next = POSES.find((p) => p.value !== pose && !taken.has(p.value));
          setBlob(null);
          if (next) setPose(next.value);
          else onClose();
        },
      }
    );
  };

  const errors = upload.error?.fields || {};
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add progress photos"
      description="Front, side and back on the same day make the best comparison."
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Done
          </Button>
          <Button type="submit" form="progress-photo" variant="primary" icon={ImagePlus} loading={upload.isPending} disabled={!online || !blob || preparing}>
            {replacing ? "Replace photo" : "Upload photo"}
          </Button>
        </>
      }
    >
      {!online && (
        <InlineAlert tone="offline" className="mb-4">
          You&apos;re offline. Reconnect to upload photos.
        </InlineAlert>
      )}
      <FormError error={upload.error} />
      <form id="progress-photo" onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <Field label="Date" error={errors.day}>
          <Input type="date" value={day} max={today} min={shiftDayKey(today, -365)} onChange={(e) => setDay(e.target.value || today)} />
        </Field>
        <Field label="Pose" error={errors.pose}>
          <SegmentedControl label="Pose" block value={pose} onChange={setPose} options={POSES.map((p) => ({ ...p, label: taken.has(p.value) ? `${p.label} (done)` : p.label }))} />
        </Field>
        <Field label="Photo" error={prepError || errors.photo} hint="Resized and stripped of location data before upload.">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic"
            onChange={(e) => choose(e.target.files?.[0])}
            className="block w-full text-sm text-ink-2 file:mr-3 file:h-11 file:cursor-pointer file:rounded-control file:border-0 file:bg-surface-2 file:px-4 file:font-semibold file:text-ink hover:file:bg-surface-3"
          />
        </Field>
        {(preview || preparing) && (
          <div className="mx-auto w-40">
            {preview ? <img src={preview} alt={`Preview of the ${POSE_LABEL[pose].toLowerCase()} photo`} className="aspect-[3/4] w-full rounded-tile object-cover" /> : <Skeleton className="aspect-[3/4] w-full" />}
          </div>
        )}
        {replacing && <InlineAlert tone="warning">This replaces the {POSE_LABEL[pose].toLowerCase()} photo already saved for this date.</InlineAlert>}
      </form>
    </Dialog>
  );
}

function PhotoViewer({ photo, onClose, memberId, canManage }) {
  const remove = useDeletePhoto(memberId);
  const confirm = useConfirm();
  const toast = useToast();
  const online = useOnlineStatus();
  const onDelete = async () => {
    const ok = await confirm({ title: "Delete this photo?", body: "It is removed for good, for staff and for the member.", confirmLabel: "Delete photo", tone: "danger" });
    if (!ok) return;
    remove.mutate(photo._id, {
      onSuccess: () => {
        toast.success("Photo deleted");
        onClose();
      },
      onError: (e) => toast.error("Couldn't delete the photo", { description: e.message }),
    });
  };
  return (
    <Dialog
      open={Boolean(photo)}
      onClose={onClose}
      title={photo ? `${POSE_LABEL[photo.pose]}, ${formatDate(dayToDate(photo.day))}` : ""}
      description={photo ? `Added by ${photo.uploadedByKind === "member" ? "the member" : photo.uploadedByName || "staff"}` : undefined}
      size="md"
      footer={
        canManage && (
          <Button variant="danger" icon={Trash2} onClick={onDelete} loading={remove.isPending} disabled={!online}>
            Delete photo
          </Button>
        )
      }
    >
      {photo && <PrivatePhoto photo={photo} alt={`${POSE_LABEL[photo.pose]} progress photo from ${formatDate(dayToDate(photo.day))}`} className="mx-auto max-w-sm" />}
    </Dialog>
  );
}

function Compare({ photos, days, weightByDay }) {
  const [before, setBefore] = useState(days[days.length - 1]);
  const [after, setAfter] = useState(days[0]);
  const [pose, setPose] = useState("front");
  const find = (day) => photos.find((p) => p.day === day && p.pose === pose);
  const side = (day, label) => (
    <figure className="m-0 min-w-0">
      {find(day) ? <PrivatePhoto photo={find(day)} alt={`${label}: ${POSE_LABEL[pose].toLowerCase()} photo from ${formatDate(dayToDate(day))}`} /> : <EmptySlot pose={pose} />}
      <figcaption className="mt-1.5 text-[13px]">
        <span className="font-semibold text-ink">{label}</span>
        <span className="block text-ink-3">
          {formatDate(dayToDate(day))}
          {weightByDay.get(day) != null ? `, ${formatMeasure(weightByDay.get(day), "kg")}` : ""}
        </span>
      </figcaption>
    </figure>
  );
  return (
    <section aria-label="Compare photos" className="rounded-tile border border-line p-3 md:p-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Before">
          <Select value={before} onChange={(e) => setBefore(e.target.value)}>
            {days.map((d) => (
              <option key={d} value={d}>
                {formatDate(dayToDate(d))}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="After">
          <Select value={after} onChange={(e) => setAfter(e.target.value)}>
            {days.map((d) => (
              <option key={d} value={d}>
                {formatDate(dayToDate(d))}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <SegmentedControl label="Pose to compare" block size="sm" value={pose} onChange={setPose} options={POSES} className="mt-3" />
      <div className="mt-3 grid grid-cols-2 gap-3">
        {side(before, "Before")}
        {side(after, "After")}
      </div>
    </section>
  );
}

/**
 * Progress photos: private uploads streamed with the staff token. Grouped by date, with a
 * before/after comparison of the same pose.
 */
export function PhotosSection({ memberId, entries, canManage }) {
  const query = usePhotos(memberId);
  const [uploading, setUploading] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [comparing, setComparing] = useState(false);
  const [shownDays, setShownDays] = useState(4);
  const photos = useMemo(() => query.data?.photos || [], [query.data]);
  const days = query.data?.days || [];
  const weightByDay = useMemo(() => new Map(entries.filter((e) => e.weightKg != null).map((e) => [e.day, e.weightKg])), [entries]);

  return (
    <Card>
      <CardHeader
        title="Progress photos"
        description={
          <span className="inline-flex items-center gap-1">
            <Lock className="size-3.5" aria-hidden />
            Private: only staff and the member can see them.
          </span>
        }
        action={
          canManage && (
            <Button size="sm" variant="quiet" icon={Camera} onClick={() => setUploading(true)}>
              Add photos
            </Button>
          )
        }
      />
      {query.isPending ? (
        <div className="grid grid-cols-3 gap-2" role="status" aria-label="Loading photos">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="aspect-[3/4] w-full" />
          ))}
        </div>
      ) : query.isError ? (
        <ErrorState compact error={query.error} onRetry={() => query.refetch()} />
      ) : photos.length === 0 ? (
        <EmptyState
          compact
          icon={Images}
          title="No progress photos yet"
          body="Take front, side and back photos on the same day every few weeks. They often show changes the scale misses."
          action={
            canManage && (
              <Button variant="secondary" icon={Camera} onClick={() => setUploading(true)}>
                Add photos
              </Button>
            )
          }
        />
      ) : (
        <div className="flex flex-col gap-4">
          {days.length > 1 && (
            <div>
              <Button size="sm" variant={comparing ? "secondary" : "quiet"} icon={Columns2} onClick={() => setComparing((v) => !v)} aria-expanded={comparing}>
                {comparing ? "Hide comparison" : "Compare two dates"}
              </Button>
              {comparing && (
                <div className="mt-3">
                  <Compare photos={photos} days={days} weightByDay={weightByDay} />
                </div>
              )}
            </div>
          )}
          <ol className="flex flex-col gap-4">
            {days.slice(0, shownDays).map((day) => (
              <li key={day}>
                <p className="mb-2 text-sm font-semibold text-ink">
                  {formatDate(dayToDate(day))}
                  {weightByDay.get(day) != null && <span className="ml-2 font-medium text-ink-3">{formatMeasure(weightByDay.get(day), "kg")}</span>}
                </p>
                <div className="grid grid-cols-3 gap-2 sm:max-w-md">
                  {POSES.map(({ value }) => {
                    const photo = photos.find((p) => p.day === day && p.pose === value);
                    return photo ? (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setViewing(photo)}
                        className="block rounded-tile text-left"
                        aria-label={`Open the ${POSE_LABEL[value].toLowerCase()} photo from ${formatDate(dayToDate(day))}`}
                      >
                        <PrivatePhoto photo={photo} alt="" />
                        <span className="mt-1 block text-center text-xs text-ink-3">{POSE_LABEL[value]}</span>
                      </button>
                    ) : (
                      <div key={value}>
                        <EmptySlot pose={value} />
                        <span className="mt-1 block text-center text-xs text-ink-3">{POSE_LABEL[value]}</span>
                      </div>
                    );
                  })}
                </div>
              </li>
            ))}
          </ol>
          {days.length > shownDays && (
            <Button variant="secondary" size="sm" className="self-start" onClick={() => setShownDays((n) => n + 8)}>
              Show earlier photos ({days.length - shownDays} more {days.length - shownDays === 1 ? "date" : "dates"})
            </Button>
          )}
        </div>
      )}
      <UploadDialog open={uploading} onClose={() => setUploading(false)} memberId={memberId} photos={photos} />
      <PhotoViewer photo={viewing} onClose={() => setViewing(null)} memberId={memberId} canManage={canManage} />
    </Card>
  );
}
