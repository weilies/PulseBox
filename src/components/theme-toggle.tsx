"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
 const { theme, setTheme } = useTheme();
 const [mounted, setMounted] = useState(false);

 useEffect(() => setMounted(true), []);

 if (!mounted) {
 return (
 <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400">
 <Sun className="h-4 w-4" />
 </Button>
 );
 }

 return (
 <Button
 variant="ghost"
 size="icon"
 className="h-8 w-8 text-gray-500 hover:text-blue-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-blue-400 dark:hover:bg-gray-800"
 onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
 aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
 >
 {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
 </Button>
 );
}