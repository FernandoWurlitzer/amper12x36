"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import { Clock, Coffee, Sunrise, Sunset, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Technician } from "./ScheduleManager";
import { useFirestore, useCollection, useMemoFirebase, useUser, setDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase";
import { collection, doc, serverTimestamp, getDocs } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

type Props = {
  technician: Technician;
  isEditable?: boolean;
  compact?: boolean;
};

export function TechnicianRow({ technician, isEditable = false, compact = false }: Props) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
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
    
    // Turno Manhã: 08:00 às 14:00 (6 horas para alinhar com a tarde)
    for (let h = 8; h < 14; h++) {
      for (let m = 0; m < 60; m += 15) {
        morning.push(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`);
      }
    }
    // Turno Tarde: 14:00 às 20:00 (6 horas)
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

  const handleClearAll = async () => {
    if (!isEditable || !firestore || !scheduledBlocksRef) return;
    
    if (confirm(`Deseja limpar todos os horários de ${technician.name}?`)) {
      try {
        const snapshot = await getDocs(scheduledBlocksRef);
        snapshot.docs.forEach(d => {
          deleteDocumentNonBlocking(d.ref);
        });
        toast({
          title: "Agenda Limpa",
          description: `Todos os horários de ${technician.name} foram liberados.`,
        });
      } catch (e) {
        // Error is handled by global emitter
      }
    }
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
    <div className="space-y-1 select-none">
      <div className="flex items-center gap-2 text-[8px] font-bold text-muted-foreground uppercase tracking-wider px-1">
        {type === 'morning' ? <Sunrise className="h-2.5 w-2.5" /> : <Sunset className="h-2.5 w-2.5" />}
        {type === 'morning' ? 'Turno 1 (08:00 - 14:00)' : 'Turno 2 (14:00 - 20:00)'}
      </div>
      <div className={cn(
        "flex h-16 items-stretch border border-border rounded-xl overflow-hidden bg-muted/5 shadow-inner",
        compact && "h-12",
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
          const dragDistance = (dragStart !== null && isInDragRange) ? Math.abs(index - dragStart.index) : 0;

          return (
            <div
              key={time}
              onMouseDown={() => handleMouseDown(type, index)}
              onMouseEnter={() => handleMouseEnter(type, index)}
              style={{ 
                transitionDelay: isInDragRange ? `${dragDistance * 5}ms` : '0ms'
              }}
              className={cn(
                "group flex-1 relative flex items-center justify-center transition-all duration-200 border-r border-border last:border-r-0 hover:z-10",
                isEditable ? "cursor-pointer" : "cursor-default",
                isHourStart && "border-l-2 border-l-white",
                visualOccupied ? "bg-accent shadow-inner" : "bg-available/20 hover:bg-available/40",
                isInDragRange && dragAction === 'free' && "bg-muted/40 ring-2 ring-inset ring-accent/20"
              )}
            >
              {isHourStart && (
                <div className={cn(
                  "text-[10px] font-bold leading-none select-none pointer-events-none transition-colors",
                  "text-foreground/80 font-black",
                  visualOccupied ? "text-primary-foreground" : ""
                )}>
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
    <div className={cn(
      "bg-card border rounded-2xl p-4 space-y-1 shadow-sm hover:shadow-md transition-all duration-300 select-none", 
      isLoading && "opacity-50 animate-pulse",
      compact && "p-3 space-y-0.5"
    )}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex h-10 w-10 items-center justify-center bg-primary/10 border-2 border-primary rounded-xl text-primary font-bold text-sm select-none shadow-sm shadow-primary/20",
            compact && "h-8 w-8 text-xs"
          )}>
            {initials}
          </div>
          <div>
            <h3 className={cn("font-bold text-base text-foreground tracking-tight", compact && "text-sm")}>{technician.name}</h3>
            {!compact && (
              <p className="text-[9px] text-muted-foreground flex items-center gap-1 opacity-70">
                <Clock className="h-2.5 w-2.5" />
                Sincronizado via Nuvem
              </p>
            )}
          </div>
        </div>
        {isEditable && !compact && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleClearAll}
            className="h-8 text-[10px] gap-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 uppercase font-black tracking-wider"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Limpar Agenda
          </Button>
        )}
      </div>

      <div className="space-y-1">
        {renderSlotsBar('morning', slots.morning)}

        <div className="flex justify-center py-1">
          <div className="flex items-center gap-2 bg-muted/30 px-4 py-0.5 rounded-full border border-border/40">
            <Coffee className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] leading-none">
              Intervalo (13:00 - 14:00)
            </span>
          </div>
        </div>

        {renderSlotsBar('afternoon', slots.afternoon)}
      </div>

      <div className="flex justify-between items-center pt-2 text-[9px] text-muted-foreground border-t border-border/50 mt-1">
        <div className="flex gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-sm bg-accent shadow-sm" />
            <span className="font-medium">Ocupado</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-sm bg-available shadow-sm" />
            <span className="font-medium">Livre</span>
          </div>
        </div>
        <p className="text-white font-black text-[10px] uppercase tracking-[0.1em] drop-shadow-sm">
          CLIQUE E ARRASTE PARA MARCAR MÚLTIPLOS HORÁRIOS
        </p>
      </div>
    </div>
  );
}
