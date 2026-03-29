
"use client";

import Image from "next/image";
import { Auth } from "./Auth";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import { useState } from "react";

export function Header() {
  const logo = PlaceHolderImages.find(img => img.id === "amper-logo");
  const [imgError, setImgError] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md">
      <div className="container mx-auto px-4 md:px-8 flex h-20 items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="relative h-14 w-14 overflow-hidden rounded-2xl shadow-xl shadow-primary/20 bg-white/5 flex items-center justify-center border border-primary/10">
            <Image
              src={(!imgError && logo?.imageUrl) ? logo.imageUrl : "https://picsum.photos/seed/amper/200/200"}
              alt="Amper Logo"
              fill
              className="object-contain scale-125 transition-transform duration-500 hover:scale-150"
              onError={() => setImgError(true)}
              data-ai-hint={logo?.imageHint || "company logo"}
            />
          </div>
          <div className="flex flex-col">
            <h1 className="text-2xl font-black tracking-tighter text-primary leading-none">Amper</h1>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Tecnologia 12x36</span>
          </div>
        </div>
        <Auth />
      </div>
    </header>
  );
}
