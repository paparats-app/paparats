import { useNav } from "@/app/navigation";
import { NotableRow } from "@/components/AppListItem";
import { useAppAction } from "@/hooks";
import { toActionView, useStoreAppView } from "@/screens/shared";
import type { App } from "@/services/types";

/** "New and notable" wide row with the 34px action; identity opens the app page (328–334). */
export function BrowseNotableRow({ app }: { app: App }) {
  const { go } = useNav();
  const action = useAppAction(app);
  const view = useStoreAppView(app);
  return (
    <NotableRow
      name={app.name}
      icon={view.icon}
      tagline={view.tagline}
      category={view.category}
      channel={view.channel}
      action={toActionView(action)}
      onOpen={() => go({ to: "app", appId: app.id })}
    />
  );
}
