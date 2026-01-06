// src/components/items/ResponsibleUserPicker.tsx
// Reusable component for selecting the responsible user for an item

"use client";

import {
  HouseholdMember,
  useHouseholdMembers,
} from "@/hooks/useHouseholdMembers";
import { cn } from "@/lib/utils";
import { Check, ChevronDown, User, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface ResponsibleUserPickerProps {
  value: string | undefined;
  onChange: (userId: string) => void;
  disabled?: boolean;
  isPublic?: boolean;
  className?: string;
  variant?: "default" | "compact";
}

export function ResponsibleUserPicker({
  value,
  onChange,
  disabled = false,
  isPublic = true,
  className,
  variant = "default",
}: ResponsibleUserPickerProps) {
  const { data, isLoading } = useHouseholdMembers();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const members = data?.members || [];
  const currentUserId = data?.currentUserId;
  const hasPartner = data?.hasPartner || false;

  // Get selected member info
  const selectedMember = members.find((m) => m.id === value);
  const displayName = selectedMember?.displayName || "Me";
  const isMe = selectedMember?.isCurrentUser ?? true;

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Auto-select current user if no value and currentUserId is available
  useEffect(() => {
    if (!value && currentUserId) {
      onChange(currentUserId);
    }
  }, [value, currentUserId, onChange]);

  // If private item, only show current user (disabled)
  if (!isPublic) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg",
          "bg-white/5 border border-white/10 text-white/50",
          "cursor-not-allowed",
          className
        )}
      >
        <User className="w-4 h-4" />
        <span className="text-sm">Me (Private item)</span>
      </div>
    );
  }

  // If no partner, show disabled state
  if (!hasPartner) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg",
          "bg-white/5 border border-white/10 text-white/50",
          className
        )}
      >
        <User className="w-4 h-4" />
        <span className="text-sm">Me</span>
        <span className="text-xs text-white/30 ml-auto">No partner linked</span>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg",
          "bg-white/5 border border-white/10 animate-pulse",
          className
        )}
      >
        <div className="w-4 h-4 bg-white/10 rounded-full" />
        <div className="h-4 w-20 bg-white/10 rounded" />
      </div>
    );
  }

  const handleSelect = (member: HouseholdMember) => {
    onChange(member.id);
    setIsOpen(false);
  };

  return (
    <div className={cn("relative", className)} ref={dropdownRef}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          "flex items-center gap-2 w-full px-3 py-2 rounded-lg",
          "bg-white/5 border border-white/10 hover:bg-white/10",
          "transition-colors duration-200",
          disabled && "opacity-50 cursor-not-allowed",
          variant === "compact" && "py-1.5 text-sm"
        )}
      >
        {isMe ? (
          <User className="w-4 h-4 text-cyan-400" />
        ) : (
          <Users className="w-4 h-4 text-pink-400" />
        )}
        <span
          className={cn(
            "flex-1 text-left",
            isMe ? "text-white" : "text-pink-300"
          )}
        >
          {displayName}
        </span>
        <ChevronDown
          className={cn(
            "w-4 h-4 text-white/50 transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          className={cn(
            "absolute z-50 mt-1 w-full rounded-lg",
            "bg-slate-800 border border-white/10 shadow-xl",
            "py-1 overflow-hidden"
          )}
        >
          {members.map((member) => (
            <button
              key={member.id}
              type="button"
              onClick={() => handleSelect(member)}
              className={cn(
                "flex items-center gap-2 w-full px-3 py-2",
                "hover:bg-white/5 transition-colors duration-150",
                member.id === value && "bg-white/10"
              )}
            >
              {member.isCurrentUser ? (
                <User className="w-4 h-4 text-cyan-400" />
              ) : (
                <Users className="w-4 h-4 text-pink-400" />
              )}
              <span
                className={cn(
                  "flex-1 text-left",
                  member.isCurrentUser ? "text-white" : "text-pink-300"
                )}
              >
                {member.displayName}
              </span>
              {member.email && !member.isCurrentUser && (
                <span className="text-xs text-white/40">{member.email}</span>
              )}
              {member.id === value && (
                <Check className="w-4 h-4 text-green-400" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Simple inline display component for showing who is responsible
interface ResponsibleUserBadgeProps {
  userId: string;
  className?: string;
}

export function ResponsibleUserBadge({
  userId,
  className,
}: ResponsibleUserBadgeProps) {
  const { data } = useHouseholdMembers();
  const members = data?.members || [];
  const member = members.find((m) => m.id === userId);
  const isMe = member?.isCurrentUser ?? false;

  if (!member) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs",
        isMe ? "bg-cyan-500/20 text-cyan-300" : "bg-pink-500/20 text-pink-300",
        className
      )}
    >
      {isMe ? <User className="w-3 h-3" /> : <Users className="w-3 h-3" />}
      {member.displayName}
    </span>
  );
}
