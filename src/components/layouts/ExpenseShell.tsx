"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { LayoutDashboard, ReceiptText } from "lucide-react";
import React, { useMemo } from "react";

export default function ExpenseShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const nav = [
    {
      title: "Transaction",
      href: "/expense",
      icon: ReceiptText,
    },
    {
      title: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
    },
  ];

  // Find current item based on pathname
  const currentTitle = useMemo(() => {
    const match = nav.find((item) => pathname.startsWith(item.href));
    return match?.title ?? "Expense";
  }, [pathname]);

  return (
    <SidebarProvider suppressHydrationWarning>
      <Sidebar>
        <SidebarHeader />
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {nav.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname.startsWith(item.href)}
                      tooltip={item.title}
                      className="transition-all duration-200 hover:translate-x-1"
                    >
                      <Link href={item.href} className="flex items-center">
                        <item.icon className="size-4 transition-transform duration-200 group-hover:scale-110" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter />
        <SidebarRail />
      </Sidebar>
      <SidebarInset>
        <div
          className="flex h-12 items-center gap-2 border-b px-4 transition-colors duration-200"
          suppressHydrationWarning
        >
          <SidebarTrigger className="transition-transform duration-200 hover:scale-110" />
          <div className="font-medium">{currentTitle}</div>
        </div>
        <div className={cn("flex-1 p-4 page-transition")}>{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
