"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import { User, Clock, Coffee } from "lucide-react";
import { cn } from "@/lib/utils";
import { Technician } from "./ScheduleManager";
import { useFirestore, useCollection, useMemoFirebase, useUser, setDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase";
import { collection, doc, serverTimestamp } from "firebase/firestore";

type Props = {
  technician: Technician;
  isEditable?: boolean;
};

export function TechnicianRow({ technician, isEditable = false }: Props) {
  const { user } = useUser();
  const firestore = useFirestore();
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [dragEnd, setDragEnd] = useState<number | null>(null);
  const [dragAction, setDragAction] = useState<'occupy' | 'free' | null>(null);

  // Firestore sync for slots
  const scheduledBlocksRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'technicians', technician.id, 'scheduledBlocks');
  }, [firestore, technician.id]);

  const { data: blocksData, isLoading } = useCollection(scheduledBlocksRef);
  
  const occupiedSlots = useMemo(() => {
    if (!blocksData) return [];
    return blocksData.map(doc => doc.id);
  }, [blocksData]);

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

  const handleToggleSlots = (slotIds: string[], action: 'occupy' | 'free') => {
    if (!isEditable || !user || !firestore) return;

    slotIds.forEach(time => {
      // Prevent editing the hardcoded interval slots
      const isInterval = time >= "13:00" && time < "14:00";
      if (isInterval) return;

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

  const handleMouseDown = (index: number) => {
    if (!isEditable) return;
    const time = slots[index];
    if (time >= "13:00" && time < "14:00") return; // Prevent interaction with interval

    setDragStart(index);
    setDragEnd(index);
    setDragAction(occupiedSlots.includes(time) ? 'free' : 'occupy');
  };

  const handleMouseEnter = (index: number) => {
    if (dragStart !== null) {
      setDragEnd(index);
    }
  };

  const handleMouseUp = useCallback(() => {
    if (dragStart !== null && dragEnd !== null && dragAction !== null) {
      const min = Math.min(dragStart, dragEnd);
      const max = Math.max(dragStart, dragEnd);
      const selectedRange = slots.slice(min, max + 1);
      handleToggleSlots(selectedRange, dragAction);
    }
    setDragStart(null);
    setDragEnd(null);
    setDragAction(null);
  }, [dragStart, dragEnd, dragAction, slots, isEditable, user, firestore]);

  useEffect(() => {
    if (dragStart !== null) {
      window.addEventListener("mouseup", handleMouseUp);
      return () => window.removeEventListener("mouseup", handleMouseUp);
    }
  }, [dragStart, handleMouseUp]);

  return (
    <div className={cn("space-y-4 select-none", isLoading && "opacity-50 animate-pulse")}>
      <div className="flex items-center gap-3">
        <div className="bg-secondary p-2 rounded-lg text-primary">
          <User className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-semibold text-lg text-foreground">{technician.name}</h3>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Agenda Sincronizada
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
          <div className={cn(
            "flex h-16 items-stretch border border-border rounded-xl overflow-hidden bg-muted/20",
            (!isEditable || isLoading) && "cursor-not-allowed"
          )}>
            {slots.map((time, index) => {
              const isOccupied = occupiedSlots.includes(time);
              const isHourStart = time.endsWith(":00");
              const isInterval = time >= "13:00" && time < "14:00";
              
              const isInDragRange = dragStart !== null && dragEnd !== null && 
                index >= Math.min(dragStart, dragEnd) && 
                index <= Math.max(dragStart, dragEnd);

              // Visual state during drag
              const visualOccupied = isInDragRange 
                ? (dragAction === 'occupy') 
                : (isOccupied || isInterval);

              return (
                <div
                  key={time}
                  onMouseDown={() => handleMouseDown(index)}
                  onMouseEnter={() => handleMouseEnter(index)}
                  title={`${time} - ${isInterval ? 'INTERVALO' : (isOccupied ? 'Indisponível' : 'Disponível')}${!isEditable ? ' (Apenas visualização)' : ''}`}
                  className={cn(
                    "group flex-1 relative transition-all duration-300 border-r border-border last:border-r-0 hover:z-10",
                    isEditable && !isInterval ? "cursor-pointer" : "cursor-default",
                    isHourStart && "border-l-2 border-l-primary/10",
                    isInterval 
                      ? "bg-muted shadow-none cursor-not-allowed" 
                      : (visualOccupied ? "bg-accent shadow-inner text-white" : (isEditable ? "bg-transparent hover:bg-secondary/50" : "bg-transparent")),
                    isInDragRange && dragAction === 'free' && "bg-muted/40 shadow-none border-dashed ring-2 ring-inset ring-accent/20"
                  )}
                >
                  {/* Interval Label logic - centered across 4 slots (13:00 to 14:00) */}
                  {isInterval && time === "13:00" && (
                    <div className="absolute inset-y-0 left-0 w-[400%] flex items-center justify-center pointer-events-none z-20 overflow-hidden">
                      <div className="flex items-center gap-1 whitespace-nowrap bg-background/60 px-2 py-0.5 rounded-full border border-border/50 backdrop-blur-md shadow-sm scale-75 md:scale-90">
                        <Coffee className="h-2.5 w-2.5 text-muted-foreground" />
                        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Intervalo</span>
                      </div>
                    </div>
                  )}

                  <div className={cn(
                    "absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity",
                    visualOccupied ? "text-white/40" : "text-primary/20"
                  )}>
                    <div className="h-full w-[1px] bg-current transform scale-y-50" />
                  </div>
                  
                  {isOccupied && !isInDragRange && !isInterval && (
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