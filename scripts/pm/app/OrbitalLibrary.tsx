import { useEffect, useMemo } from "react";
import { Back, Empty } from "./components";
import { useGameLayer } from "./GameLayer";
import { LibraryCabinet } from "./LibraryCabinet";
import { LibraryRoom } from "./LibraryRoom";
import { libraryCabinetCount, libraryDeliveryBlock } from "./libraryShelves";
import { launchPath } from "./model";
import { go, useRoute, useWorld } from "./state";

export function OrbitalLibrary() {
  const { enabled } = useGameLayer();
  const { world } = useWorld();
  const route = useRoute();
  const from = route.query.get("from") || "";
  const search = /^\/(explore|work|projects?)(?:\?|$)/.test(from) ? from : "/explore";
  const origin = `?from=${encodeURIComponent(search)}`;
  const room = "/library/room";
  const campaign = route.parts[2];
  const space = world.spaces.find(entry => entry.name === campaign);
  const cabinets = useMemo(() => world.spaces.map(entry => ({
    name: entry.name, count: libraryCabinetCount(entry),
  })), [world.spaces]);

  useEffect(() => {
    if (!enabled) location.replace(`#${search}`);
  }, [enabled, search]);
  if (!enabled) return null;
  if (campaign && !space) return (
    <Empty title="Cabinet unavailable">
      <a className="secondary" href={`#${room}${origin}`}>Library</a>
    </Empty>
  );
  if (space) {
    const cabinet = `${room}/${encodeURIComponent(space.name)}`;
    return <LibraryCabinet
      key={space.name}
      world={world} space={space} selectedId={route.parts[3] || null}
      onSelectItem={id => go(`${cabinet}${id ? "/" + encodeURIComponent(id) : ""}${origin}`)}
      onExit={() => go(`${room}${origin}&cabinet=${encodeURIComponent(space.name)}`)}
      onDeliver={work => {
        if (!libraryDeliveryBlock(world, work)) go(`${launchPath(work, route.full)}&library=1`);
      }}
    />;
  }
  return <>
    <Back fallback="/explore" label="Search" />
    <LibraryRoom cabinets={cabinets} initialCabinet={route.query.get("cabinet") || undefined}
      onOpen={name => go(`${room}/${encodeURIComponent(name)}${origin}`)} />
  </>;
}
