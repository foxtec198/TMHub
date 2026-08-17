// Tema
import { applyAppearance, getStoredAppearance } from "./theme";

// Aplica a aparência salva antes da primeira renderização.
applyAppearance(getStoredAppearance(), { notify: false });
