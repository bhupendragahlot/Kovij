import { useState } from "react";
import { promptInstall, useInstallState } from "../../app/install";

/**
 * The install action for this device, or null when it isn't possible (already installed, or a
 * browser that can't install). `install()` opens the browser's dialog, or on iPhone/iPad sets
 * `stepsOpen` so the caller shows <IosInstallDialog>.
 */
export function useInstallAction() {
  const state = useInstallState();
  const [stepsOpen, setStepsOpen] = useState(false);
  if (state.installed || (!state.canPrompt && !state.ios)) return null;
  return {
    install: () => (state.canPrompt ? promptInstall() : setStepsOpen(true)),
    stepsOpen,
    closeSteps: () => setStepsOpen(false),
  };
}
