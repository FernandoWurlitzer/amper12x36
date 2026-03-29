"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import { User, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Technician } from "./ScheduleManager";

type Props = {
  technician: Technician;
  occupiedSlots: string[];
  onToggleSlots: (slotIds: string[]) => void;
};

export function TechnicianRow({ technician, occupiedSlots, onToggleSlots }: Props) {
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [dragEnd, setDragEnd] = useState<number | null>(null);
  const [dragAction, setDragAction] = useState<'occupy' | 'free' | null>(null);

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

  const hourHeaders = useMemo(() => {
    const headers = [];
    for (let h = 8; h < 20; h++) {
      headers.push(h.toString().padStart(2, "0") + ":00");
    }
    return headers;
  }, []);

  const handleMouseDown = (index: number) => {
    setDragStart(index);
    setDragEnd(index);
    setDragAction(occupiedSlots.includes(slots[index]) ? 'free' : 'occupy');
  };

  const handleMouseEnter = (index: number) => {
    if (dragStart !== null) {
      setDragEnd(index);
    }
  };

  const handleMouseUp = useCallback(() => {
    if (dragStart !== null && dragEnd !== null) {
      const min = Math.min(dragStart, dragEnd);
      const max = Math.max(dragStart, dragEnd);
      const selectedRange = slots.slice(min, max + 1);
      onToggleSlots(selectedRange);
    }
    setDragStart(null);
    setDragEnd(null);
    setDragAction(null);
  }, [dragStart, dragEnd, slots, onToggleSlots]);

  useEffect(() => {
    if (dragStart !== null) {
      window.addEventListener("mouseup", handleMouseUp);
      return () => window.removeEventListener("mouseup", handleMouseUp);
    }
  }, [dragStart, handleMouseUp]);

  return (
    <div className="space-y-4 select-none">
      <div className="flex items-center gap-3">
        <div className="bg-secondary p-2 rounded-lg text-primary">
          <User className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-semibold text-lg text-foreground">{technician.name}</h3>
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
              <div key={hour} className="flex-1 text-[10px] font-bold text-muted-foreground border-l border-border pl-1 uppercase">
                {hour}
              </div>
            ))}
          </div>

          {/* Slots grid */}
          <div className="flex h-16 items-stretch border border-border rounded-xl overflow-hidden bg-muted/20">
            {slots.map((time, index) => {
              const isOccupied = occupiedSlots.includes(time);
              const isHourStart = time.endsWith(":00");
              
              const isInDragRange = dragStart !== null && dragEnd !== null && 
                index >= Math.min(dragStart, dragEnd) && 
                index <= Math.max(dragStart, dragEnd);

              return (
                <div
                  key={time}
                  onMouseDown={() => handleMouseDown(index)}
                  onMouseEnter={() => handleMouseEnter(index)}
                  title={`${time} - ${isOccupied ? 'Indisponível' : 'Disponível'}`}
                  className={cn(
                    "group flex-1 relative transition-all duration-300 border-r border-border last:border-r-0 hover:z-10 cursor-pointer",
                    isHourStart && "border-l-2 border-l-primary/10",
                    isOccupied 
                      ? "bg-accent shadow-inner text-white" 
                      : "bg-transparent hover:bg-secondary/50",
                    isInDragRange && (
                      dragAction === 'occupy' 
                        ? "bg-accent/80" 
                        : "bg-muted/40 shadow-none border-dashed ring-2 ring-inset ring-accent/20"
                    )
                  )}
                >
                  <div className={cn(
                    "absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity",
                    isOccupied ? "text-white/40" : "text-primary/20"
                  )}>
                    <div className="h-full w-[1px] bg-current transform scale-y-50" />
                  </div>
                  
                  {isOccupied && !isInDragRange && (
                    <div className="absolute inset-0 bg-accent/20 animate-pulse" />
                  )}

                  <span className="sr-only">{time}</span>
                </div>
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