
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
      <div className="container mx-auto px-4 md:px-8 flex h-16 items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative h-10 w-10 overflow-hidden rounded-xl shadow-lg shadow-primary/20 bg-primary/5 flex items-center justify-center">
            <Image
              src={(!imgError && logo?.imageUrl) ? logo.imageUrl : "https://picsum.photos/seed/amper/100/100"}
              alt="Amper Logo"
              fill
              className="object-cover"
              onError={() => setImgError(true)}
              data-ai-hint={logo?.imageHint || "company logo"}
            />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-primary">Amper 12x36</h1>
        </div>
        <Auth />
      </div>
    </header>
  );
}
