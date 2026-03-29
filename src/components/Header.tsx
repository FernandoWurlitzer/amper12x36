"use client";

import Image from "next/image";
import Link from "next/link";
import { Auth } from "./Auth";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CalendarRange } from "lucide-react";

export function Header() {
  const logo = PlaceHolderImages.find(img => img.id === "amper-logo");
  const [imgError, setImgError] = useState(false);

  return (
    <header className="w-full border-b bg-background/90 backdrop-blur-lg sticky top-0 z-50">
      <div className="container mx-auto px-4 md:px-8 flex h-20 items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-4 group cursor-pointer">
            <div className="relative h-14 w-14 overflow-hidden rounded-2xl shadow-xl shadow-primary/10 bg-white/5 flex items-center justify-center border border-white/10 transition-transform group-hover:scale-105">
              <Image
                src={(!imgError && logo?.imageUrl) ? logo.imageUrl : "/logo.png"}
                alt="Amper Logo"
                fill
                className="object-contain scale-125 transition-transform duration-500 group-hover:scale-150"
                onError={() => setImgError(true)}
                data-ai-hint={logo?.imageHint || "company logo"}
              />
            </div>
            <div className="flex flex-col">
              <h1 className="text-xl md:text-2xl tracking-tighter text-foreground leading-none flex items-start font-michroma lowercase">
                <span className="font-normal">ampernet</span>
                <span className="text-[10px] md:text-xs font-medium ml-1.5 mt-0.5 opacity-80 font-body align-top">12x36</span>
              </h1>
            </div>
          </Link>
          
          <div className="hidden md:block h-8 w-px bg-border/50 mx-2" />
          
          <Button variant="ghost" size="sm" asChild className="gap-2 text-[10px] font-bold uppercase tracking-widest hover:bg-primary/10 hover:text-primary transition-all">
            <Link href="/">
              <CalendarRange className="h-4 w-4" />
              Dashboard
            </Link>
          </Button>
        </div>
        <Auth />
      </div>
    </header>
  );
}
