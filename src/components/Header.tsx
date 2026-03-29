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
            <h1 className="text-2xl md:text-3xl tracking-tighter text-foreground leading-none flex items-start font-michroma lowercase">
              <span className="font-normal">ampernet</span>
              <span className="text-[10px] md:text-xs font-medium ml-1.5 mt-0.5 opacity-80 font-body align-top">12x36</span>
            </h1>
          </div>
        </div>
        <Auth />
      </div>
    </header>
  );
}
