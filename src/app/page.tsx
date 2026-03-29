"use client";

import { useState, useEffect } from "react";
import { ScheduleManager } from "@/components/ScheduleManager";
import { Header as AppHeader } from "@/components/Header";
import { cn } from "@/lib/utils";

export default function Home() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    const handleResize = () => {
      setIsFullscreen(window.innerHeight === window.screen.height);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <div className={cn(
      "min-h-screen flex flex-col font-body bg-background selection:bg-primary/20 transition-all duration-500",
      isFullscreen && "p-0 bg-black"
    )}>
      {!isFullscreen && <AppHeader />}
      
      <main className={cn(
        "flex-1 transition-all duration-500",
        isFullscreen ? "p-4 md:p-6" : "p-4 md:p-8 max-w-7xl mx-auto w-full"
      )}>
        <div className={cn(
          "bg-card rounded-2xl shadow-sm border transition-all duration-500",
          isFullscreen ? "p-4 border-none bg-transparent" : "p-6 md:p-10 space-y-8"
        )}>
          {!isFullscreen && (
            <div className="space-y-2">
              <h2 className="text-2xl font-bold tracking-tight text-foreground uppercase">Agenda de Atendimento</h2>
              <p className="text-muted-foreground text-sm">
                Visualize e gerencie a disponibilidade dos técnicos 12x36. Horário de atendimento: 08:00 às 20:00.
              </p>
            </div>
          )}
          <ScheduleManager isFullscreen={isFullscreen} />
        </div>
      </main>

      {!isFullscreen && (
        <footer className="p-8 text-center text-sm text-muted-foreground uppercase tracking-widest opacity-50">
          AMPERNET TELECOM ® - Fernando Wurlitzer
        </footer>
      )}
    </div>
  );
}
