import { useMutation, useQuery } from "@tanstack/react-query";
import { isLoopbackOrigin } from "../../delivery-v2/local-auth-browser.mjs";
import { read, v2Post } from "./api";
import { ErrorNotice } from "./components";
import { client, pmKeys } from "./state";
import { transport } from "./transport";

type Settings = { setting: { remote: string; branch: string; mode: string; url: string } | null; destination: string };

export function SetupDeliveryPush() {
  const enabled = transport().capabilities.kind === "local" && isLoopbackOrigin(location.origin);
  const settings = useQuery({
    queryKey: pmKeys.localPushSettings,
    queryFn: ({ signal }) => read<Settings>("/api/delivery/v2/local/push-settings", signal),
    enabled,
  });
  const configure = useMutation({
    mutationFn: (url: string) => v2Post<Settings>("local", { action: "configure-push", expected_url: url }),
    onSuccess: (result) => {
      client.setQueryData(pmKeys.localPushSettings, result);
      void client.invalidateQueries({ queryKey: pmKeys.localRunListPrefix });
    },
  });
  if (!enabled) return null;
  const setting = settings.data?.setting;
  const url = settings.data?.destination;
  return (
    <section className="cockpit-panel" aria-label="Delivery push destination">
      <h2>Delivery push destination</h2>
      <p><code>git push --force-with-lease internal main</code></p>
      {url && <p>{url}</p>}
      {setting && url === setting.url ? <strong>Configured</strong> :
        <button className="secondary" disabled={!url || configure.isPending}
          onClick={() => url && configure.mutate(url)}>{setting ? "Update destination" : "Use internal/main"}</button>}
      <ErrorNotice error={settings.error || configure.error} />
    </section>
  );
}
