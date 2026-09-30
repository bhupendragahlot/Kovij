import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, ImageUp, Trash2 } from "lucide-react";
import { useMemberPhoto } from "./api";
import { captureFrame, preparePhoto } from "./photo";
import { useMediaQuery } from "../../shared/hooks/useMediaQuery";
import { useOnlineStatus } from "../../shared/hooks/useOnlineStatus";
import { Avatar, Button, Dialog, FormError, InlineAlert, useConfirm, useToast } from "../../shared/ui";

/** Live webcam capture for desk computers (phones use the camera app through the file input). */
function CameraDialog({ open, onClose, onCapture }) {
  const videoRef = useRef(null);
  const [error, setError] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    let stream;
    let cancelled = false;
    setError(null);
    setReady(false);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("This browser can't use the camera. Choose a file instead.");
      return undefined;
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })
      .then((s) => {
        if (cancelled) return s.getTracks().forEach((t) => t.stop());
        stream = s;
        if (videoRef.current) videoRef.current.srcObject = s;
      })
      .catch((e) =>
        setError(
          e?.name === "NotAllowedError"
            ? "Camera access is blocked. Allow the camera for this site in the browser, or choose a file instead."
            : "No camera was found. Choose a file instead."
        )
      );
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [open]);

  const take = async () => {
    try {
      onCapture(await captureFrame(videoRef.current));
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Take photo"
      description="Ask the member to look at the camera."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" icon={Camera} onClick={take} disabled={!ready || Boolean(error)}>
            Take photo
          </Button>
        </>
      }
    >
      {error ? (
        <InlineAlert tone="warning">{error}</InlineAlert>
      ) : (
        <div className="overflow-hidden rounded-tile bg-surface-3">
          {/* Mirrored like a selfie so people can line themselves up; the saved photo isn't mirrored. */}
          <video ref={videoRef} autoPlay playsInline muted onLoadedData={() => setReady(true)} className="aspect-video w-full -scale-x-100 object-cover" aria-label="Camera preview" />
        </div>
      )}
    </Dialog>
  );
}

/**
 * Profile photo chooser: preview, "Take photo" (camera) and "Choose file". Returns a resized JPEG.
 * On phones "Take photo" opens the back camera, since staff photograph the member at the desk.
 *
 * @param {{ name: string, currentUrl?: string, file: File|null, onChange: (file: File|null) => void, onRemoveCurrent?: () => void }} props
 */
export function PhotoPicker({ name, currentUrl, file, onChange, onRemoveCurrent, disabled }) {
  const fileRef = useRef(null);
  const cameraRef = useRef(null);
  const touch = useMediaQuery("(pointer: coarse)");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

  const accept = async (raw) => {
    if (!raw) return;
    setError(null);
    setBusy(true);
    try {
      onChange(await preparePhoto(raw));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const onPick = (e) => {
    accept(e.target.files?.[0]);
    e.target.value = "";
  };

  const shown = preview || currentUrl;
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
      <Avatar name={name || "New member"} src={shown} size="xl" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" icon={Camera} loading={busy} disabled={disabled} onClick={() => (touch ? cameraRef.current?.click() : setCameraOpen(true))}>
            Take photo
          </Button>
          <Button variant="secondary" icon={ImageUp} disabled={disabled || busy} onClick={() => fileRef.current?.click()}>
            Choose file
          </Button>
          {file ? (
            <Button variant="ghost" icon={Trash2} disabled={disabled} onClick={() => onChange(null)}>
              Clear
            </Button>
          ) : (
            currentUrl &&
            onRemoveCurrent && (
              <Button variant="ghost" icon={Trash2} disabled={disabled} onClick={onRemoveCurrent}>
                Remove photo
              </Button>
            )
          )}
        </div>
        {error ? (
          <p role="alert" className="mt-2 text-[13px] font-medium text-bad">
            {error}
          </p>
        ) : (
          <p className="mt-2 text-[13px] text-ink-3">{file ? "New photo ready. It's saved with the member." : "Helps the desk recognise members at check-in."}</p>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/*" className="sr-only" tabIndex={-1} aria-hidden onChange={onPick} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden onChange={onPick} />
      <CameraDialog
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={(shot) => {
          setCameraOpen(false);
          accept(shot);
        }}
      />
    </div>
  );
}

/** Change or remove an existing member's photo (from the profile header). */
export function ProfilePhotoDialog({ open, onClose, member }) {
  const { upload, remove } = useMemberPhoto(member?._id);
  const online = useOnlineStatus();
  const toast = useToast();
  const confirm = useConfirm();
  const [file, setFile] = useState(null);

  useEffect(() => {
    if (open) {
      setFile(null);
      upload.reset();
      remove.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const save = () =>
    upload.mutate(file, {
      onSuccess: () => {
        toast.success("Photo saved");
        onClose();
      },
    });

  const removeCurrent = async () => {
    const ok = await confirm({ title: "Remove this photo?", body: "The member will show their initials until a new photo is added.", confirmLabel: "Remove photo", cancelLabel: "Keep photo", tone: "danger" });
    if (!ok) return;
    remove.mutate(undefined, {
      onSuccess: () => {
        toast.success("Photo removed");
        onClose();
      },
      onError: (e) => toast.error("Couldn't remove the photo", { description: e.message }),
    });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Profile photo"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} loading={upload.isPending} disabled={!file || !online}>
            Save photo
          </Button>
        </>
      }
    >
      {!online && (
        <InlineAlert tone="offline" className="mb-4">
          Saving a photo needs a connection. Reconnect to continue.
        </InlineAlert>
      )}
      <FormError error={upload.error} />
      <PhotoPicker name={member?.name} currentUrl={member?.profilePhoto} file={file} onChange={setFile} onRemoveCurrent={removeCurrent} disabled={upload.isPending || remove.isPending} />
    </Dialog>
  );
}
