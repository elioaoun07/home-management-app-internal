// src/app/g/[tag]/layout.tsx
// Standalone layout for guest portal — no app header/nav/auth
import "../../globals.css";

export const metadata = {
  title: "Welcome Home • Jarvis Home Portal",
  description:
    "Your personal home assistant portal — powered by Jarvis AI ecosystem",
};

export default function GuestPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#0a1628] text-white overflow-x-hidden">
      {children}
    </div>
  );
}
