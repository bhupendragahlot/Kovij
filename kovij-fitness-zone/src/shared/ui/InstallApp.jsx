import { Download, Share, SquarePlus, X } from "lucide-react";
import { useInstallAction } from "../hooks/useInstallAction";
import { Button, IconButton } from "./Button";
import { Card } from "./Card";
import { Dialog } from "./Dialog";

const Step = ({ n, children }) => (
  <li className="flex items-start gap-3">
    <span className="tabular grid size-7 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-bold text-ink">{n}</span>
    <span className="pt-1">{children}</span>
  </li>
);

/** iPhone/iPad: Safari can only add to the home screen from its Share menu. */
export function IosInstallDialog({ open, onClose, appName }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Add ${appName} to your home screen`}
      size="sm"
      footer={
        <Button variant="primary" onClick={onClose}>
          Done
        </Button>
      }
    >
      <ol className="flex flex-col gap-3 text-sm text-ink-2">
        <Step n={1}>
          In Safari, tap <Share className="mx-0.5 inline size-4 align-text-bottom" aria-label="Share" /> <strong>Share</strong>.
        </Step>
        <Step n={2}>
          Scroll down and tap <SquarePlus className="mx-0.5 inline size-4 align-text-bottom" aria-hidden /> <strong>Add to Home Screen</strong>.
        </Step>
        <Step n={3}>
          Tap <strong>Add</strong>. {appName} appears on your home screen and opens like an app.
        </Step>
      </ol>
    </Dialog>
  );
}

/**
 * A card offering to install the app. `onDismiss` adds a close button. Renders nothing when the
 * app is already installed or this browser can't install it.
 */
export function InstallAppCard({ appName, description, onDismiss, className }) {
  const action = useInstallAction();
  if (!action) return null;
  return (
    <Card className={className}>
      <div className="flex items-start gap-4">
        <img src="/icons/icon-192.png" alt="" width="48" height="48" className="size-12 shrink-0 rounded-[12px]" />
        <div className="min-w-0 flex-1">
          <p className="font-bold text-ink">Install the {appName} app</p>
          <p className="mt-0.5 text-[13px] text-ink-3">{description}</p>
          <Button className="mt-3" variant="primary" size="sm" icon={Download} onClick={action.install}>
            Install
          </Button>
        </div>
        {onDismiss && <IconButton icon={X} label="Not now" size="sm" onClick={onDismiss} />}
      </div>
      <IosInstallDialog open={action.stepsOpen} onClose={action.closeSteps} appName={appName} />
    </Card>
  );
}
