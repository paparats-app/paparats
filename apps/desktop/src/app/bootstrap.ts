// Startup before the first render: install the service set, load the stored settings and apply
// theme, motion and language, so the first frame already has the user's appearance.
import { initI18n } from "@/i18n";
import { setServices, type Services } from "@/services";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { applyDocumentSettings, systemPrefersDark } from "./documentSettings";

export async function bootstrap(services: Services): Promise<void> {
  setServices(services);
  await useSettingsStore.getState().hydrate();
  const { settings } = useSettingsStore.getState();
  applyDocumentSettings(settings, systemPrefersDark());
  await initI18n(settings.locale);
}
