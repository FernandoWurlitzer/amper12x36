"use client";

import Image from "next/image";
import { Auth } from "./Auth";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import { useState } from "react";

export function Header() {
  const logo = PlaceHolderImages.find(img => img.id === "amper-logo");
  const [imgError, setImgError] = useState(false);

  return (
    <header className="w-full border-b bg-background/90 backdrop-blur-lg">
      <div className="container mx-auto px-4 md:px-8 flex h-20 items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="relative h-16 w-16 overflow-hidden rounded-2xl shadow-xl shadow-primary/10 bg-white/5 flex items-center justify-center border border-white/10">
            <Image
              src={(!imgError && logo?.imageUrl) ? logo.imageUrl : "/logo.png"}
              alt="Amper Logo"
              fill
              className="object-contain scale-125 transition-transform duration-500 hover:scale-150"
              onError={() => setImgError(true)}
              data-ai-hint={logo?.imageHint || "company logo"}
            />
          </div>
          <div className="flex flex-col">
            <h1 className="text-xl md:text-2xl tracking-tight text-foreground leading-none flex items-baseline gap-1.5">
              <span className="font-semibold uppercase">AMPERNET</span>
              <span className="font-light lowercase">12x36</span>
            </h1>
          </div>
        </div>
        <Auth />
      </div>
    </header>
  );
}
