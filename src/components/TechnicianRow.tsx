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
  
  // Local state for active team (exclusive selection)
  const [activeEquipe, setActiveEquipe] = useState<number | null>(null);

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
    
    // Aligned 6h turns (08:00 to 14:00 and 14:00 to 20:00)
    for (let h = 8; h < 14; h++) {
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
          updatedAt: serverTimestamp(),
          equipe: activeEquipe // Store which equipe marked it
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
    
    if (activeEquipe === null) {
      toast({
        variant: "destructive",
        title: "Selecione uma Equipe",
        description: "É necessário selecionar EQUIPE 1 ou EQUIPE 2 antes de marcar horários.",
      });
      return;
    }

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
  }, [dragStart, dragEnd, dragAction, slots, isEditable, user, firestore, occupiedSlots, technician.id, activeEquipe]);

  useEffect(() => {
    if (dragStart !== null) {
      window.addEventListener("mouseup", handleMouseUp);
      return () => window.removeEventListener("mouseup", handleMouseUp);
    }
  }, [dragStart, handleMouseUp]);

  const renderSlotsBar = (type: 'morning' | 'afternoon', timeSlots: string[]) => (
    <div className="space-y-0.5 select-none">
      <div className="flex items-center gap-1.5 text-[8px] font-bold text-muted-foreground uppercase tracking-wider px-1 mb-0.5">
        {type === 'morning' ? <Sunrise className="h-2 w-2" /> : <Sunset className="h-2 w-2" />}
        {type === 'morning' ? 'Turno 1 (08:00 - 14:00)' : 'Turno 2 (14:00 - 20:00)'}
      </div>
      <div className={cn(
        "flex h-24 items-stretch border border-border rounded-xl overflow-hidden bg-muted/5 shadow-inner",
        compact && "h-16",
        (!isEditable || isLoading) && "cursor-not-allowed",
        isEditable && activeEquipe === null && "cursor-not-allowed opacity-80"
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
                "group flex-1 relative flex items-center justify-center transition-all duration-200 border-r border-border/40 last:border-r-0 hover:z-10",
                isEditable && activeEquipe !== null ? "cursor-pointer" : "cursor-default",
                isHourStart && "border-l-2 border-l-white/20",
                visualOccupied 
                  ? (activeEquipe === 2 ? "bg-green-500 shadow-inner" : "bg-accent shadow-inner") 
                  : "bg-available/20 hover:bg-available/40",
                isInDragRange && dragAction === 'free' && "bg-muted/40 ring-2 ring-inset ring-accent/20"
              )}
            >
              {isHourStart && (
                <div className={cn(
                  "text-[10px] font-black leading-none select-none pointer-events-none transition-colors",
                  "text-foreground/40",
                  visualOccupied ? "text-white drop-shadow-sm" : ""
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
      "bg-card border rounded-2xl p-4 space-y-0.5 shadow-sm hover:shadow-md transition-all duration-300 select-none", 
      isLoading && "opacity-50 animate-pulse",
      compact && "p-3"
    )}>
      <div className="flex items-center justify-between mb-1.5">
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
        
        <div className="flex items-center gap-6">
          {isEditable && (
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setActiveEquipe(activeEquipe === 1 ? null : 1)}
                className="flex items-center gap-1.5 transition-all hover:opacity-80 active:scale-95 group"
              >
                <div className={cn(
                  "w-3 h-3 rounded-full border border-white/10 transition-all duration-300",
                  activeEquipe === 1 ? "bg-accent shadow-[0_0_10px_hsl(var(--accent))]" : "bg-muted"
                )} />
                <span className={cn(
                  "text-[10px] font-black uppercase tracking-wider transition-colors",
                  activeEquipe === 1 ? "text-foreground" : "text-muted-foreground group-hover:text-foreground/70"
                )}>Equipe 1</span>
              </button>

              <button 
                onClick={() => setActiveEquipe(activeEquipe === 2 ? null : 2)}
                className="flex items-center gap-1.5 transition-all hover:opacity-80 active:scale-95 group"
              >
                <div className={cn(
                  "w-3 h-3 rounded-full border border-white/10 transition-all duration-300",
                  activeEquipe === 2 ? "bg-green-500 shadow-[0_0_10px_#22c55e]" : "bg-muted"
                )} />
                <span className={cn(
                  "text-[10px] font-black uppercase tracking-wider transition-colors",
                  activeEquipe === 2 ? "text-foreground" : "text-muted-foreground group-hover:text-foreground/70"
                )}>Equipe 2</span>
              </button>
            </div>
          )}

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
      </div>

      <div className="space-y-1">
        {renderSlotsBar('morning', slots.morning)}

        <div className="flex justify-center py-1.5">
          <div className="flex items-center gap-2 bg-muted/30 px-5 py-1 rounded-full border border-border/40">
            <Coffee className="h-3.5 w-3.5 text-muted-foreground/60" />
            <span className="text-[12px] font-black text-muted-foreground/80 uppercase tracking-[0.2em] leading-none">
              Intervalo
            </span>
          </div>
        </div>

        {renderSlotsBar('afternoon', slots.afternoon)}
      </div>

      <div className="flex justify-between items-center pt-2 text-[9px] text-muted-foreground border-t border-border/30 mt-1.5">
        <div className="flex gap-4">
          <div className="flex items-center gap-1.5">
            <div className={cn("w-2 h-2 rounded-sm shadow-sm", activeEquipe === 2 ? "bg-green-500" : "bg-accent")} />
            <span className="font-medium">Ocupado</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-sm bg-available shadow-sm" />
            <span className="font-medium">Livre</span>
          </div>
        </div>
        <p className="text-white/60 font-black text-[9px] uppercase tracking-[0.1em]">
          {activeEquipe === null ? "SELECIONE UMA EQUIPE PARA EDITAR" : "CLIQUE E ARRASTE PARA MARCAR HORÁRIOS"}
        </p>
      </div>
    </div>
  );
}
