"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { LucideIcon, ChevronRight, ChevronLeft } from "lucide-react";
import HoverTooltip from "@/component/HoverTooltip";

export interface NavItem {
  type: "link" | "button";
  href?: string;
  label: string;
  icon: LucideIcon;
  onClick?: () => void;
}

export interface BottomNavItem {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  isActive?: (pathname: string) => boolean;
}

interface SidebarProps {
  /** User ID (teacher or student) */
  userId: string;
  /** User role: 'teacher' or 'student' */
  role: "teacher" | "student";
  /** Navigation items to display */
  navItems: NavItem[];
  /** Optional bottom navigation item (e.g., Chat with Admin) */
  bottomNavItem?: BottomNavItem;
  /** Optional custom base path (defaults to /{role}/{userId}) */
  basePath?: string;
  /** Optional: Position below header (for layouts with top header) */
  belowHeader?: boolean;
  /** Optional: Top offset in pixels when belowHeader is true (default: 64px) */
  headerHeight?: number;
}

export default function Sidebar({
  userId,
  role,
  navItems,
  bottomNavItem,
  basePath,
  belowHeader = false,
}: SidebarProps) {
  const pathname = usePathname();

  const baseRoute = basePath || `/${role}/${userId}`;

  // Calculate inline styles for positioning when belowHeader is true
  const inlineStyles = belowHeader
    ? {
        top: '50%',
        transform: 'translateY(-50%)',
        height: 'auto',
        maxHeight: 'calc(100vh - 120px)',
      }
    : {};

  // CSS classes for positioning
  const positionClass = belowHeader ? "" : "top-1/2 -translate-y-1/2";

  return (
    <nav
      style={inlineStyles}
      className={`fixed left-0 ${positionClass}
      w-[70px]
      flex flex-col items-center justify-between
      bg-gradient-to-b from-[#161853] to-[#292C6D]
      rounded-r-3xl shadow-lg py-6 z-30`}
    >
      {/* Scroll area */}
      <div
        className="flex-1 overflow-y-auto
        [&::-webkit-scrollbar]:w-2
        [&::-webkit-scrollbar-track]:rounded-full
        [&::-webkit-scrollbar-track]:bg-[#161853]
        [&::-webkit-scrollbar-thumb]:rounded-full
        [&::-webkit-scrollbar-thumb]:bg-[#FAEDF0] overflow-x-hidden"
      >
        <ul className="space-y-3">
          {navItems.map(({ type, href, label, icon: Icon, onClick }) => {
            let fullHref: string | null = null;
            if (type === "link" && href !== undefined) {
              fullHref = href === "" ? baseRoute : `${baseRoute}${href}`;
            }

            // Check if current item is active
            let isActive = false;
            
            if (type === "link" && href !== undefined) {
              if (href === "") {
                // Dashboard route - exact match for base route
                isActive = pathname === baseRoute;
              } else if (href.startsWith("/documents")) {
                // Special handling for documents route
                isActive = pathname.startsWith(`${baseRoute}/documents`);
              } else {
                // Normal route - check if pathname starts with the full href
                isActive = pathname.startsWith(fullHref!);
              }
            } else if (type === "button") {
              // Check if it's a livestream button that's active
              isActive = pathname.includes("/livestream");
            }

            const commonClass = `
              relative flex items-center justify-center p-2 rounded w-fit mx-auto group
              ${
                isActive
                  ? "bg-[#FAEF5D] text-black"
                  : "text-white hover:bg-[#FAEF5D] hover:text-black"}
            `;

            return (
              <li key={label} className="relative group">
                {type === "link" ? (
                  <a href={fullHref!} className={commonClass}>
                    <HoverTooltip label={label}>
                      <Icon className="w-6 h-6 font-medium" />
                    </HoverTooltip>
                  </a>
                ) : (
                  <button onClick={onClick} className={commonClass}>
                    <HoverTooltip label={label}>
                      <Icon className="w-6 h-6" />
                    </HoverTooltip>
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {/* Fixed bottom item */}
      {bottomNavItem && (
        <div className="mt-5 relative group">
          <button
            onClick={bottomNavItem.onClick}
            className={`relative flex items-center justify-center p-2 rounded w-fit mx-auto ${
              bottomNavItem.isActive
                ? bottomNavItem.isActive(pathname)
                  ? "bg-[#FAEF5D] text-black"
                  : "text-white hover:bg-[#FAEF5D] hover:text-black"
                : pathname.includes("/chat-with-admin")
                ? "bg-[#FAEF5D] text-black"
                : "text-white hover:bg-[#FAEF5D] hover:text-black"
            }`}
          >
            <HoverTooltip label={bottomNavItem.label}>
              <bottomNavItem.icon className="w-6 h-6" />
            </HoverTooltip>
          </button>
        </div>
      )}
    </nav>
  );
}
