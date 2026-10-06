import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Printer, QrCode, RefreshCw } from "lucide-react";
import { useMemberQr, useReissueQr } from "./api";
import { newIdempotencyKey } from "../../shared/lib/apiClient";
import { useOnlineStatus } from "../../shared/hooks/useOnlineStatus";
import { Button, Card, CardHeader, Dialog, ErrorState, Field, FormError, Select, Skeleton, useToast } from "../../shared/ui";
import { formatDate } from "../../shared/lib/format";

const REASONS = ["Card lost", "Code was shared with someone else", "New phone", "Other"];

/** Renders a code as a PNG data URL (black on white, which every scanner reads best). */
function useQrImage(text) {
  const [image, setImage] = useState({ text: null, url: null });
  useEffect(() => {
    if (!text) return undefined;
    let alive = true;
    QRCode.toDataURL(text, { errorCorrectionLevel: "M", margin: 2, width: 480 })
      .then((url) => alive && setImage({ text, url }))
      .catch(() => alive && setImage({ text, url: null }));
    return () => {
      alive = false;
    };
  }, [text]);
  return image.text === text ? image.url : null;
}

/** A printable member card in a new window. Everything is set as text, never as HTML. */
function printCard({ imageUrl, name, memberCode }) {
  const w = window.open("", "_blank", "width=420,height=640");
  if (!w) return false;
  const doc = w.document;
  doc.title = `${name}: member card`;
  const style = doc.createElement("style");
  style.textContent = `
    body { margin: 0; padding: 24px; display: grid; place-items: center; font-family: system-ui, sans-serif; color: black; }
    figure { margin: 0; width: 280px; padding: 20px; text-align: center; border: 1px solid gray; border-radius: 14px; }
    img { width: 240px; height: 240px; }
    h1 { margin: 10px 0 2px; font-size: 20px; }
    p { margin: 0; font-size: 15px; letter-spacing: 0.04em; }
    small { display: block; margin-top: 10px; font-size: 12px; color: dimgray; }
    @media print { body { padding: 0; } }`;
  doc.head.appendChild(style);
  const figure = doc.createElement("figure");
  const img = doc.createElement("img");
  img.alt = `Entry QR code for ${name}`;
  const h1 = doc.createElement("h1");
  h1.textContent = name;
  const code = doc.createElement("p");
  code.textContent = memberCode || "";
  const note = doc.createElement("small");
  note.textContent = "Show this code at the entrance to check in.";
  figure.append(img, h1, code, note);
  doc.body.appendChild(figure);
  img.onload = () => {
    w.focus();
    w.print();
  };
  img.src = imageUrl;
  return true;
}

/**
 * The member's entry QR code on their profile (front desk and up): show it, print a card, or
 * replace it when a card is lost or the code was shared. Replacing stops the old code at once.
 */
export function MemberQrCard({ member }) {
  const qr = useMemberQr(member._id);
  const reissue = useReissueQr(member._id);
  const toast = useToast();
  const online = useOnlineStatus();
  const imageUrl = useQrImage(qr.data?.token);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [reason, setReason] = useState(REASONS[0]);

  const onPrint = () => {
    if (!imageUrl) return;
    if (!printCard({ imageUrl, name: member.name, memberCode: qr.data.memberCode })) {
      toast.error("Couldn't open the card", { description: "Allow pop-ups for this site, then try again." });
    }
  };

  const onReplace = () =>
    reissue.mutate(
      { reason, idempotencyKey: newIdempotencyKey() },
      {
        onSuccess: () => {
          setReplaceOpen(false);
          toast.success("QR code replaced", { description: `The old code no longer works. Print a new card if ${member.name} uses one.` });
        },
      }
    );

  return (
    <Card padding="lg">
      <CardHeader
        title="Entry QR code"
        description="Members show this at the kiosk or the desk to check in. It is also in their Kovij app."
      />
      {qr.isPending ? (
        <div className="flex items-center gap-4">
          <Skeleton className="size-36 rounded-tile" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
      ) : qr.isError ? (
        <ErrorState compact error={qr.error} onRetry={() => qr.refetch()} />
      ) : (
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
          <div className="grid size-40 shrink-0 place-items-center overflow-hidden rounded-tile border border-line bg-surface">
            {imageUrl ? (
              <img src={imageUrl} alt={`Entry QR code for ${member.name}`} className="size-full" />
            ) : (
              <QrCode className="size-10 text-ink-3" aria-hidden />
            )}
          </div>
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <p className="tabular text-title-lg font-bold tracking-wide text-ink">{qr.data.memberCode || "No member code"}</p>
            <p className="mt-0.5 text-sm text-ink-3">
              {qr.data.replacedAt ? `Replaced on ${formatDate(qr.data.replacedAt)}` : "Original code"}
              {qr.data.memberCode && ". The desk can also type this code."}
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
              <Button variant="secondary" icon={Printer} onClick={onPrint} disabled={!imageUrl}>
                Print card
              </Button>
              <Button variant="ghost" icon={RefreshCw} onClick={() => setReplaceOpen(true)}>
                Replace code
              </Button>
            </div>
          </div>
        </div>
      )}

      <Dialog
        open={replaceOpen}
        onClose={() => setReplaceOpen(false)}
        title="Replace this QR code?"
        description={`The current code stops working straight away, including printed cards and screenshots. ${member.name} will see the new code in the Kovij app.`}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setReplaceOpen(false)}>
              Keep current code
            </Button>
            <Button variant="danger" icon={RefreshCw} onClick={onReplace} loading={reissue.isPending} disabled={!online}>
              Replace code
            </Button>
          </>
        }
      >
        <FormError error={reissue.error} />
        <Field label="Why is it being replaced?" hint="Saved in the desk log.">
          <Select value={reason} onChange={(e) => setReason(e.target.value)}>
            {REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
        </Field>
      </Dialog>
    </Card>
  );
}
