"use client";

import { createContext, useContext, type ReactNode } from "react";

type UserData = {
  name: string;
  email: string;
  avatarUrl?: string;
};

const UserContext = createContext<UserData | null>(null);

export function UserProvider({
  children,
  userData,
}: {
  children: ReactNode;
  userData: UserData | null;
}) {
  return (
    <UserContext.Provider value={userData}>{children}</UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  return context;
}
