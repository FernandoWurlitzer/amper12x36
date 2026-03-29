"use client";

import { useMemo } from "react";
import { User, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Technician } from "./ScheduleManager";

type Props = {
  technician: Technician;
  occupiedSlots: string[];
  onToggleSlot: (slotId: string) => void;
};

export function TechnicianRow({ technician, occupiedSlots, onToggleSlot }: Props) {
  // Generate slots from 08:00 to 20:00 every 15 mins
  const slots = useMemo(() => {
    const hours = [];
    for (let h = 8; h < 20; h++) {
      for (let m = 0; m < 60; m += 15) {
        const hour = h.toString().padStart(2, "0");
        const minute = m.toString().padStart(2, "0");
        hours.push(`${hour}:${minute}`);
      }
    }
    return hours;
  }, []);

  // Visual grouping of hours for labels
  const hourHeaders = useMemo(() => {
    const headers = [];
    for (let h = 8; h < 20; h++) {
      headers.push(h.toString().padStart(2, "0") + ":00");
    }
    return headers;
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="bg-secondary p-2 rounded-lg text-primary">
          <User className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-semibold text-lg">{technician.name}</h3>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Agenda Diária
          </p>
        </div>
      </div>

      <div className="relative overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent">
        <div className="min-w-[1200px]">
          {/* Hour labels */}
          <div className="flex mb-2">
            {hourHeaders.map((hour) => (
              <div key={hour} className="flex-1 text-[10px] font-bold text-muted-foreground border-l pl-1 uppercase">
                {hour}
              </div>
            ))}
          </div>

          {/* Slots grid */}
          <div className="flex h-16 items-stretch border rounded-xl overflow-hidden bg-white/50">
            {slots.map((time, index) => {
              const isOccupied = occupiedSlots.includes(time);
              const isHourStart = time.endsWith(":00");
              
              return (
                <button
                  key={time}
                  onClick={() => onToggleSlot(time)}
                  title={`${time} - ${isOccupied ? 'Indisponível' : 'Disponível'}`}
                  className={cn(
                    "group flex-1 relative transition-all duration-300 border-r last:border-r-0 hover:z-10",
                    isHourStart && "border-l-2 border-l-primary/10",
                    isOccupied 
                      ? "bg-accent shadow-inner text-white" 
                      : "bg-transparent hover:bg-secondary/50"
                  )}
                >
                  <div className={cn(
                    "absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity",
                    isOccupied ? "text-white/40" : "text-primary/20"
                  )}>
                    <div className="h-full w-[1px] bg-current transform scale-y-50" />
                  </div>
                  
                  {isOccupied && (
                    <div className="absolute inset-0 bg-accent/20 animate-pulse" />
                  )}

                  {/* Tiny accessibility label or visual hint */}
                  <span className="sr-only">{time}</span>
                </button>
              );
            })}
          </div>
          
          <div className="flex mt-1 justify-between px-1">
            <span className="text-[9px] text-muted-foreground">Início 08:00</span>
            <span className="text-[9px] text-muted-foreground">Término 20:00</span>
          </div>
        </div>
      </div>
    </div>
  );
}