"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Globe } from "lucide-react";
import { LANG_COOKIE, SUPPORTED_LANGUAGES } from "@/lib/constants";

export function LanguageSwitcher() {
  const router = useRouter();
  const [current, setCurrent] = useState("en");

  useEffect(() => {
    const match = document.cookie.match(new RegExp(`(?:^|; )${LANG_COOKIE}=([^;]*)`));
    if (match) setCurrent(match[1]);
  }, []);

  function switchLanguage(code: string) {
    document.cookie = `${LANG_COOKIE}=${code};path=/;samesite=lax`;
    setCurrent(code);
    router.refresh();
  }

  const activeLang = SUPPORTED_LANGUAGES.find((l) => l.code === current) ?? SUPPORTED_LANGUAGES[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 px-2 text-gray-500 hover:text-blue-600 hover:bg-gray-100"
          />
        }
      >
        <Globe className="h-4 w-4" />
        <span className="text-xs font-medium" style={{ fontFamily: "var(--font-geist-sans), sans-serif" }}>
          {activeLang.short}
        </span>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="bg-white border-gray-300 min-w-[140px]">
        {SUPPORTED_LANGUAGES.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => switchLanguage(lang.code)}
            className={`text-sm cursor-pointer ${
              lang.code === current
                ? "text-blue-600 bg-gray-100"
                : "text-gray-500 hover:text-blue-600 hover:bg-gray-100"
            }`}
            style={{ fontFamily: "var(--font-geist-sans), sans-serif" }}
          >
            <span className="mr-2 text-base">{lang.short}</span>
            {lang.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
