
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

interface ScheduledBlockData {
  id: string;
  equipe?: number;
  technicianId: string;
  markedByUserId: string;
}

export function TechnicianRow({ technician, isEditable = false, compact = false }: Props) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [dragStart, setDragStart] = useState<{ type: 'morning' | 'afternoon', index: number } | null>(null);
  const [dragEnd, setDragEnd] = useState<{ type: 'morning' | 'afternoon', index: number } | null>(null);
  const [dragAction, setDragAction] = useState<'occupy' | 'free' | null>(null);
  
  const [activeEquipe, setActiveEquipe] = useState<number | null>(null);
  const [isSelectionError, setIsSelectionError] = useState(false);

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

  const { data: blocksData, isLoading } = useCollection<ScheduledBlockData>(scheduledBlocksRef);
  
  const occupiedSlotsMap = useMemo(() => {
    const map: Record<string, number> = {};
    if (blocksData) {
      blocksData.forEach(block => {
        map[block.id] = block.equipe || 1;
      });
    }
    return map;
  }, [blocksData]);

  const slots = useMemo(() => {
    const morning = [];
    const afternoon = [];
    
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
    if (!isEditable || !user || !firestore || activeEquipe === null) return;

    slotIds.forEach(time => {
      const docRef = doc(firestore, 'technicians', technician.id, 'scheduledBlocks', time);
      const existingEquipe = occupiedSlotsMap[time];

      if (action === 'occupy') {
        // Permite se o slot estiver livre OU se a Equipe 2 estiver sobrepondo a Equipe 1
        const canOccupy = !existingEquipe || (activeEquipe === 2 && existingEquipe === 1);
        
        if (canOccupy) {
          setDocumentNonBlocking(docRef, {
            technicianId: technician.id,
            startTime: time,
            endTime: time,
            markedByUserId: user.uid,
            updatedAt: serverTimestamp(),
            equipe: activeEquipe
          }, { merge: true });
        }
      } else {
        // Só permite desmarcar se o slot pertencer à equipe ativa
        if (existingEquipe === activeEquipe) {
          deleteDocumentNonBlocking(docRef);
        }
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
        // Erro tratado globalmente
      }
    }
  };

  const handleMouseDown = (type: 'morning' | 'afternoon', index: number) => {
    if (!isEditable) return;
    
    if (activeEquipe === null) {
      setIsSelectionError(true);
      setTimeout(() => setIsSelectionError(false), 1600);
      toast({
        variant: "destructive",
        title: "Selecione uma Equipe",
        description: "É necessário selecionar EQUIPE 1 ou EQUIPE 2 antes de marcar horários.",
      });
      return;
    }

    const time = type === 'morning' ? slots.morning[index] : slots.afternoon[index];
    const existingEquipe = occupiedSlotsMap[time];
    
    // Se o slot pertence à outra equipe...
    if (existingEquipe && existingEquipe !== activeEquipe) {
      // ...só permitimos se for a Equipe 2 tentando sobrepor a Equipe 1
      if (!(activeEquipe === 2 && existingEquipe === 1)) {
        return;
      }
    }

    setDragStart({ type, index });
    setDragEnd({ type, index });
    setDragAction(existingEquipe === activeEquipe ? 'free' : 'occupy');
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
  }, [dragStart, dragEnd, dragAction, slots, activeEquipe, occupiedSlotsMap, isEditable]);

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
          const equipeId = occupiedSlotsMap[time];
          const isOccupied = !!equipeId;
          const isHourStart = time.endsWith(":00");
          
          const isInDragRange = dragStart !== null && dragEnd !== null && 
            dragStart.type === type && dragEnd.type === type &&
            index >= Math.min(dragStart.index, dragEnd.index) && 
            index <= Math.max(dragStart.index, dragEnd.index);

          let visualEquipe = equipeId;
          let visualOccupied = isOccupied;

          if (isInDragRange && dragAction) {
            if (dragAction === 'occupy') {
              // Permite visual se estiver livre OU se Equipe 2 sobrepõe Equipe 1
              if (!isOccupied || (activeEquipe === 2 && equipeId === 1)) {
                visualOccupied = true;
                visualEquipe = activeEquipe!;
              }
            } else if (dragAction === 'free') {
              if (equipeId === activeEquipe) {
                visualOccupied = false;
                visualEquipe = undefined;
              }
            }
          }

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
                "group flex-1 relative flex items-center justify-center transition-all duration-200 border-r border-border/40 last:border-r-0 hover:z-10",
                isEditable && activeEquipe !== null && (!isOccupied || (activeEquipe === 2 && equipeId === 1) || equipeId === activeEquipe) ? "cursor-pointer" : "cursor-default",
                isHourStart && "border-l-2 border-l-white/20",
                visualOccupied 
                  ? (visualEquipe === 2 ? "bg-green-500 shadow-inner" : "bg-accent shadow-inner") 
                  : "bg-available/20 hover:bg-available/40",
                isInDragRange && dragAction === 'free' && equipeId === activeEquipe && "bg-muted/40 ring-2 ring-inset ring-accent/20"
              )}
            >
              {isHourStart && (
                <div className={cn(
                  "text-[11px] font-black leading-none select-none pointer-events-none transition-colors",
                  "text-foreground/40",
                  visualOccupied ? "text-white drop-shadow-sm" : ""
                )}>
                  {time.split(':')[0]}
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
                className={cn(
                  "flex items-center gap-1.5 transition-all hover:opacity-80 active:scale-95 group p-1.5 rounded-lg border",
                  activeEquipe === 1 ? "bg-accent/10 border-accent/30" : "bg-transparent border-transparent",
                  isSelectionError && activeEquipe === null && "animate-blink ring-2 ring-primary/50"
                )}
              >
                <div className={cn(
                  "w-2.5 h-2.5 rounded-full border border-white/10 transition-all duration-300",
                  activeEquipe === 1 ? "bg-accent shadow-[0_0_10px_hsl(var(--accent))]" : "bg-muted"
                )} />
                <span className={cn(
                  "text-[10px] font-black uppercase tracking-wider transition-colors",
                  activeEquipe === 1 ? "text-foreground" : "text-muted-foreground group-hover:text-foreground/70"
                )}>Equipe 1</span>
              </button>

              <button 
                onClick={() => setActiveEquipe(activeEquipe === 2 ? null : 2)}
                className={cn(
                  "flex items-center gap-1.5 transition-all hover:opacity-80 active:scale-95 group p-1.5 rounded-lg border",
                  activeEquipe === 2 ? "bg-green-500/10 border-green-500/30" : "bg-transparent border-transparent",
                  isSelectionError && activeEquipe === null && "animate-blink ring-2 ring-primary/50"
                )}
              >
                <div className={cn(
                  "w-2.5 h-2.5 rounded-full border border-white/10 transition-all duration-300",
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

        <div className="flex justify-center py-2 relative">
          <div className="flex items-center gap-2 bg-muted/40 px-6 py-1.5 rounded-full border border-border/50 shadow-sm">
            <Coffee className="h-3.5 w-3.5 text-muted-foreground/50" />
            <span className="text-[11px] font-black text-muted-foreground/80 uppercase tracking-[0.2em] leading-none">
              Intervalo
            </span>
          </div>
        </div>

        {renderSlotsBar('afternoon', slots.afternoon)}
      </div>

      <div className="flex justify-between items-center pt-2 text-[9px] text-muted-foreground border-t border-border/30 mt-1.5">
        <div className="flex gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-sm bg-accent shadow-sm" />
            <span className="font-medium">Equipe 1</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-sm bg-green-500 shadow-sm" />
            <span className="font-medium">Equipe 2</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-sm bg-available/50 border border-border shadow-sm" />
            <span className="font-medium">Livre</span>
          </div>
        </div>
        <p className={cn(
          "text-white/60 font-black text-[9px] uppercase tracking-[0.1em] transition-all",
          isSelectionError && "text-primary animate-pulse scale-105"
        )}>
          {isEditable ? (
            activeEquipe === null ? "SELECIONE UMA EQUIPE PARA EDITAR" : "CLIQUE E ARRASTE PARA MARCAR HORÁRIOS"
          ) : (
            "MODO DE VISUALIZAÇÃO"
          )}
        </p>
      </div>
    </div>
  );
}
