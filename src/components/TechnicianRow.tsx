"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import { User, Clock, Coffee, Sunrise, Sunset } from "lucide-react";
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
  const [dragStart, setDragStart] = useState<{ type: 'morning' | 'afternoon', index: number } | null>(null);
  const [dragEnd, setDragEnd] = useState<{ type: 'morning' | 'afternoon', index: number } | null>(null);
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

  const slots = useMemo(() => {
    const morning = [];
    const afternoon = [];
    
    // Manhã: 08:00 às 13:00 (último slot começa 12:45)
    for (let h = 8; h < 13; h++) {
      for (let m = 0; m < 60; m += 15) {
        morning.push(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`);
      }
    }
    // Tarde: 14:00 às 20:00 (último slot começa 19:45)
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
  }, [dragStart, dragEnd, dragAction, slots, isEditable, user, firestore]);

  useEffect(() => {
    if (dragStart !== null) {
      window.addEventListener("mouseup", handleMouseUp);
      return () => window.removeEventListener("mouseup", handleMouseUp);
    }
  }, [dragStart, handleMouseUp]);

  const renderSlotsBar = (type: 'morning' | 'afternoon', timeSlots: string[]) => (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-1">
        {type === 'morning' ? <Sunrise className="h-3 w-3" /> : <Sunset className="h-3 w-3" />}
        {type === 'morning' ? 'Manhã (08:00 - 13:00)' : 'Tarde (14:00 - 20:00)'}
      </div>
      <div className={cn(
        "flex h-12 items-stretch border border-border rounded-xl overflow-hidden bg-muted/5",
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

          return (
            <div
              key={time}
              onMouseDown={() => handleMouseDown(type, index)}
              onMouseEnter={() => handleMouseEnter(type, index)}
              className={cn(
                "group flex-1 relative transition-all duration-200 border-r border-border last:border-r-0 hover:z-10",
                isEditable ? "cursor-pointer" : "cursor-default",
                isHourStart && "border-l-2 border-l-primary/10",
                visualOccupied ? "bg-accent shadow-inner" : (isEditable ? "bg-transparent hover:bg-secondary/20" : "bg-transparent"),
                isInDragRange && dragAction === 'free' && "bg-muted/40 ring-2 ring-inset ring-accent/20"
              )}
            >
              {isHourStart && (
                <div className="absolute top-0 left-0 text-[7px] font-bold text-muted-foreground/60 pl-0.5 pt-0.5 pointer-events-none">
                  {time}
                </div>
              )}
              <span className="sr-only">{time}</span>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className={cn("bg-card border rounded-2xl p-6 space-y-6 shadow-sm hover:shadow-md transition-shadow", isLoading && "opacity-50 animate-pulse")}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-2.5 rounded-xl text-primary">
            <User className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-bold text-xl text-foreground">{technician.name}</h3>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Sincronizado via Nuvem
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {/* Barra Superior (Manhã) */}
        {renderSlotsBar('morning', slots.morning)}

        {/* Caixa de Intervalo */}
        <div className="flex justify-center py-1">
          <div className="flex items-center gap-2 bg-muted/40 border border-border/50 px-3 py-1.5 rounded-lg backdrop-blur-sm">
            <Coffee className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Intervalo (13:00 - 14:00)</span>
          </div>
        </div>

        {/* Barra Inferior (Tarde) */}
        {renderSlotsBar('afternoon', slots.afternoon)}
      </div>

      <div className="flex justify-between items-center pt-3 text-[9px] text-muted-foreground border-t border-border/50">
        <div className="flex gap-4">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-sm bg-accent" />
            <span>Ocupado</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-sm border border-border" />
            <span>Livre</span>
          </div>
        </div>
        <p className="hidden md:block">Clique e arraste para marcar múltiplos horários</p>
      </div>
    </div>
  );
}
