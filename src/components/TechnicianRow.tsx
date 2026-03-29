
"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import { Clock, Coffee, Sunrise, Sunset } from "lucide-react";
import { cn } from "@/lib/utils";
import { Technician } from "./ScheduleManager";
import { useFirestore, useCollection, useMemoFirebase, useUser, setDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase";
import { collection, doc, serverTimestamp } from "firebase/firestore";

type Props = {
  technician: Technician;
  isEditable?: boolean;
  compact?: boolean;
};

export function TechnicianRow({ technician, isEditable = false, compact = false }: Props) {
  const { user } = useUser();
  const firestore = useFirestore();
  const [dragStart, setDragStart] = useState<{ type: 'morning' | 'afternoon', index: number } | null>(null);
  const [dragEnd, setDragEnd] = useState<{ type: 'morning' | 'afternoon', index: number } | null>(null);
  const [dragAction, setDragAction] = useState<'occupy' | 'free' | null>(null);

  const initials = useMemo(() => {
    return technician.name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }, [technician.name]);

  const scheduledBlocksRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'technicians', technician.id, 'scheduledBlocks');
  }, [firestore, technician.id]);

  const { data: blocksData, isLoading } = useCollection(scheduledBlocksRef);
  
  const occupiedSlots = useMemo(() => {
    if (!blocksData) return [];
    return blocksData.map(doc => doc.id);
  }, [blocksData]);

  const slots = useMemo(() => {
    const morning = [];
    const afternoon = [];
    
    for (let h = 8; h < 13; h++) {
      for (let m = 0; m < 60; m += 15) {
        morning.push(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`);
      }
    }
    for (let h = 14; h < 20; h++) {
      for (let m = 0; m < 60; m += 15) {
        afternoon.push(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`);
      }
    }
    return { morning, afternoon };
  }, []);

  const handleToggleSlots = (slotIds: string[], action: 'occupy' | 'free') => {
    if (!isEditable || !user || !firestore) return;

    slotIds.forEach(time => {
      const docRef = doc(firestore, 'technicians', technician.id, 'scheduledBlocks', time);
      if (action === 'occupy') {
        setDocumentNonBlocking(docRef, {
          technicianId: technician.id,
          startTime: time,
          endTime: time,
          markedByUserId: user.uid,
          updatedAt: serverTimestamp()
        }, { merge: true });
      } else {
        deleteDocumentNonBlocking(docRef);
      }
    });
  };

  const handleMouseDown = (type: 'morning' | 'afternoon', index: number) => {
    if (!isEditable) return;
    const time = type === 'morning' ? slots.morning[index] : slots.afternoon[index];
    setDragStart({ type, index });
    setDragEnd({ type, index });
    setDragAction(occupiedSlots.includes(time) ? 'free' : 'occupy');
  };

  const handleMouseEnter = (type: 'morning' | 'afternoon', index: number) => {
    if (dragStart !== null && dragStart.type === type) {
      setDragEnd({ type, index });
    }
  };

  const handleMouseUp = useCallback(() => {
    if (dragStart !== null && dragEnd !== null && dragAction !== null && dragStart.type === dragEnd.type) {
      const type = dragStart.type;
      const min = Math.min(dragStart.index, dragEnd.index);
      const max = Math.max(dragStart.index, dragEnd.index);
      const targetSlots = type === 'morning' ? slots.morning : slots.afternoon;
      const selectedRange = targetSlots.slice(min, max + 1);
      handleToggleSlots(selectedRange, dragAction);
    }
    setDragStart(null);
    setDragEnd(null);
    setDragAction(null);
  }, [dragStart, dragEnd, dragAction, slots, isEditable, user, firestore, occupiedSlots, technician.id]);

  useEffect(() => {
    if (dragStart !== null) {
      window.addEventListener("mouseup", handleMouseUp);
      return () => window.removeEventListener("mouseup", handleMouseUp);
    }
  }, [dragStart, handleMouseUp]);

  const renderSlotsBar = (type: 'morning' | 'afternoon', timeSlots: string[]) => (
    <div className="space-y-0.5">
      <div className="flex items-center gap-2 text-[8px] font-bold text-muted-foreground uppercase tracking-wider px-1">
        {type === 'morning' ? <Sunrise className="h-2.5 w-2.5" /> : <Sunset className="h-2.5 w-2.5" />}
        {type === 'morning' ? 'Manhã (08:00 - 13:00)' : 'Tarde (14:00 - 20:00)'}
      </div>
      <div className={cn(
        "flex h-9 items-stretch border border-border rounded-xl overflow-hidden bg-muted/5",
        compact && "h-7",
        (!isEditable || isLoading) && "cursor-not-allowed"
      )}>
        {timeSlots.map((time, index) => {
          const isOccupied = occupiedSlots.includes(time);
          const isHourStart = time.endsWith(":00");
          const isInDragRange = dragStart !== null && dragEnd !== null && 
            dragStart.type === type && dragEnd.type === type &&
            index >= Math.min(dragStart.index, dragEnd.index) && 
            index <= Math.max(dragStart.index, dragEnd.index);

          const visualOccupied = isInDragRange ? (dragAction === 'occupy') : isOccupied;
          
          // Calculate distance from drag start for directional animation effect
          const dragDistance = (dragStart !== null && isInDragRange) ? Math.abs(index - dragStart.index) : 0;

          return (
            <div
              key={time}
              onMouseDown={() => handleMouseDown(type, index)}
              onMouseEnter={() => handleMouseEnter(type, index)}
              style={{ 
                transitionDelay: isInDragRange ? `${dragDistance * 10}ms` : '0ms'
              }}
              className={cn(
                "group flex-1 relative flex items-center justify-center transition-all duration-300 border-r border-border last:border-r-0 hover:z-10",
                isEditable ? "cursor-pointer" : "cursor-default",
                isHourStart && "border-l-2 border-l-white/60",
                visualOccupied ? "bg-accent shadow-inner" : "bg-available/20 hover:bg-available/40",
                isInDragRange && dragAction === 'free' && "bg-muted/40 ring-2 ring-inset ring-accent/20"
              )}
            >
              <div className={cn(
                "text-[7px] md:text-[8px] font-bold leading-none select-none pointer-events-none transition-colors",
                isHourStart ? "text-foreground font-black" : "opacity-0",
                visualOccupied ? "text-primary-foreground" : ""
              )}>
                {isHourStart ? time : ""}
              </div>
              <span className="sr-only">{time}</span>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className={cn(
      "bg-card border rounded-2xl p-3 space-y-1 shadow-sm hover:shadow-md transition-all duration-300", 
      isLoading && "opacity-50 animate-pulse",
      compact && "p-2 space-y-0.5"
    )}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex h-8 w-8 items-center justify-center bg-primary/10 border-2 border-primary rounded-xl text-primary font-bold text-xs select-none shadow-sm shadow-primary/20",
            compact && "h-7 w-7"
          )}>
            {initials}
          </div>
          <div>
            <h3 className={cn("font-bold text-sm text-foreground", compact && "text-[13px]")}>{technician.name}</h3>
            {!compact && (
              <p className="text-[8px] text-muted-foreground flex items-center gap-1">
                <Clock className="h-2 w-2" />
                Sincronizado via Nuvem
              </p>
            )}
          </div>
        </div>
      </div>

      <div className={cn("space-y-0.25", compact && "space-y-0")}>
        {renderSlotsBar('morning', slots.morning)}

        <div className="flex justify-center py-0.25">
          <div className={cn(
            "flex items-center gap-2 bg-muted/40 border border-border/50 px-2 py-0.25 rounded-lg backdrop-blur-sm scale-75",
          )}>
            <Coffee className="h-2 w-2 text-muted-foreground" />
            <span className="text-[7px] font-bold text-muted-foreground uppercase tracking-widest">Intervalo (13:00 - 14:00)</span>
          </div>
        </div>

        {renderSlotsBar('afternoon', slots.afternoon)}
      </div>

      <div className="flex justify-between items-center pt-1 text-[8px] text-muted-foreground border-t border-border/50">
        <div className="flex gap-4">
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-sm bg-accent" />
            <span>Ocupado</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-sm bg-available" />
            <span>Livre</span>
          </div>
        </div>
        {!compact && (
          <p className="hidden md:block text-white font-bold text-[9px] uppercase tracking-wider opacity-90">
            CLIQUE E ARRASTE PARA MARCAR MÚLTIPLOS HORÁRIOS
          </p>
        )}
      </div>
    </div>
  );
}
