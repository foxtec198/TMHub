import { applyAppearance, applyParticles, getStoredAppearance, getStoredParticles } from "./theme";

applyAppearance(getStoredAppearance(), { notify: false });
applyParticles(getStoredParticles(), { notify: false });
