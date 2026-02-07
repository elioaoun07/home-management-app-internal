// src/app/g/[tag]/page.tsx
import GuestPortalClient from "./guest-portal-client";

export const dynamic = "force-static";

export default async function GuestPortalPage({
  params,
}: {
  params: Promise<{ tag: string }>;
}) {
  const { tag } = await params;
  return <GuestPortalClient tag={tag} />;
}
