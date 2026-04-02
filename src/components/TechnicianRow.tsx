
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
  
  // Estados para o recurso de clicar e arrastar
  const [dragStart, setDragStart] = useState<{ type: 'morning' | 'afternoon', index: number } | null>(null);
  const [dragEnd, setDragEnd] = useState<{ type: 'morning' | 'afternoon', index: number } | null>(null);
  const [dragAction, setDragAction] = useState<'occupy' | 'free' | null>(null);
  
  const [activeEquipe, setActiveEquipe] = useState<number | null>(null);
  const [isSelectionError, setIsSelectionError] = useState(false);
  const [visibleShift, setVisibleShift] = useState<'morning' | 'afternoon' | null>(null);
  const [currentTime, setCurrentTime] = useState<{ h: number, m: number } | null>(null);

  // Efeito para sincronizar com o horário real
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      
      setCurrentTime({ h: hours, m: minutes });

      // Sincronização de Turnos:
      // Exibe manhã se for antes das 14h, senão exibe tarde
      if (hours < 14) {
        setVisibleShift('morning');
      } else {
        setVisibleShift('afternoon');
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

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
    
    // Turno 1: 08:00 às 13:00
    for (let h = 8; h < 13; h++) {
      for (let m = 0; m < 60; m += 15) {
        morning.push(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`);
      }
    }
    // Turno 2: 14:00 às 20:00
    for (let h = 14; h < 20; h++) {
      for (let m = 0; m < 60; m += 15) {
        afternoon.push(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`);
      }
    }
    return { morning, afternoon };
  }, []);

  const handleToggleSlots = useCallback((slotIds: string[], action: 'occupy' | 'free') => {
    if (!isEditable || !user || !firestore) return;

    slotIds.forEach(time => {
      const docRef = doc(firestore, 'technicians', technician.id, 'scheduledBlocks', time);
      
      if (action === 'occupy' && activeEquipe !== null) {
        setDocumentNonBlocking(docRef, {
          technicianId: technician.id,
          startTime: time,
          endTime: time,
          markedByUserId: user.uid,
          updatedAt: serverTimestamp(),
          equipe: activeEquipe
        }, { merge: true });
      } else if (action === 'free') {
        // Desmarca se não houver equipe selecionada OU se a equipe do slot for a mesma ativa
        if (activeEquipe === null || occupiedSlotsMap[time] === activeEquipe) {
          deleteDocumentNonBlocking(docRef);
        }
      }
    });
  }, [isEditable, user, firestore, technician.id, activeEquipe, occupiedSlotsMap]);

  const handleClearAll = async () => {
    if (!isEditable || !firestore || !scheduledBlocksRef) return;
    
    if (confirm(`Deseja limpar toda a agenda de ${technician.name}?`)) {
      try {
        const snapshot = await getDocs(scheduledBlocksRef);
        snapshot.docs.forEach(d => {
          deleteDocumentNonBlocking(d.ref);
        });
        toast({
          title: "Agenda Limpa",
          description: `Todos os horários de ${technician.name} foram liberados.`,
        });
      } catch (e) {}
    }
  };

  const handleMouseDown = (type: 'morning' | 'afternoon', index: number) => {
    if (!isEditable) return;
    
    const time = type === 'morning' ? slots.morning[index] : slots.afternoon[index];
    const existingEquipe = occupiedSlotsMap[time];
    const isOccupied = !!existingEquipe;

    // Se nenhuma equipe estiver selecionada
    if (activeEquipe === null) {
      if (isOccupied) {
        // Se clicar em algo ocupado sem equipe ativa, entra no modo desmarcar
        setDragStart({ type, index });
        setDragEnd({ type, index });
        setDragAction('free');
      } else {
        // Se clicar em algo livre sem equipe ativa, avisa
        setIsSelectionError(true);
        setTimeout(() => setIsSelectionError(false), 1600);
        toast({
          variant: "destructive",
          title: "Selecione uma Equipe",
          description: "Selecione EQUIPE 1 ou EQUIPE 2 antes de marcar.",
        });
      }
      return;
    }

    // Se houver equipe selecionada
    setDragStart({ type, index });
    setDragEnd({ type, index });
    // Se clicar na mesma equipe que já está lá, desmarca. Senão, marca.
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
  }, [dragStart, dragEnd, dragAction, slots, handleToggleSlots]);

  useEffect(() => {
    if (dragStart !== null) {
      window.addEventListener("mouseup", handleMouseUp);
      return () => window.removeEventListener("mouseup", handleMouseUp);
    }
  }, [dragStart, handleMouseUp]);

  const renderSlotsBar = (type: 'morning' | 'afternoon', timeSlots: string[]) => (
    <div className="space-y-0.5 select-none animate-in fade-in slide-in-from-top-1 duration-500">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1.5 text-[7px] font-bold text-muted-foreground uppercase tracking-wider">
          {type === 'morning' ? <Sunrise className="h-2 w-2 text-orange-400" /> : <Sunset className="h-2 w-2 text-blue-400" />}
          {type === 'morning' ? 'Turno 1 (08:00 - 13:00)' : 'Turno 2 (14:00 - 20:00)'}
        </div>
        {type === 'morning' && (
          <div className="flex items-center gap-1 text-[6px] font-black text-primary/60 uppercase">
            <Coffee className="h-2 w-2" />
            Intervalo 13h - 14h
          </div>
        )}
      </div>
      <div className={cn(
        "flex h-12 items-stretch border border-border rounded-lg overflow-hidden bg-muted/5 shadow-inner",
        (!isEditable || isLoading) && "cursor-not-allowed"
      )}>
        {timeSlots.map((time, index) => {
          const equipeId = occupiedSlotsMap[time];
          const isOccupied = !!equipeId;
          const isHourStart = time.endsWith(":00");
          
          const [slotH, slotM] = time.split(":").map(Number);
          const isPast = currentTime && (currentTime.h > slotH || (currentTime.h === slotH && currentTime.m > slotM));

          const isInDragRange = dragStart !== null && dragEnd !== null && 
            dragStart.type === type && dragEnd.type === type &&
            index >= Math.min(dragStart.index, dragEnd.index) && 
            index <= Math.max(dragStart.index, dragEnd.index);

          let visualEquipe = equipeId;
          let visualOccupied = isOccupied;

          if (isInDragRange && dragAction) {
            if (dragAction === 'occupy') {
              visualOccupied = true;
              visualEquipe = activeEquipe!;
            } else if (dragAction === 'free') {
              if (activeEquipe === null || equipeId === activeEquipe) {
                visualOccupied = false;
                visualEquipe = undefined;
              }
            }
          }

          const dragDistance = (dragStart !== null && isInDragRange) ? Math.abs(index - dragStart.index) : 0;

          return (
            <div
              key={time}
              onMouseDown={(e) => {
                e.preventDefault();
                handleMouseDown(type, index);
              }}
              onMouseEnter={() => handleMouseEnter(type, index)}
              style={{ transitionDelay: isInDragRange ? `${dragDistance * 10}ms` : '0ms' }}
              className={cn(
                "group flex-1 relative flex items-center justify-center transition-all duration-200 border-r border-border/40 last:border-r-0 hover:z-10",
                isEditable && !isPast ? "cursor-pointer" : "cursor-default",
                isHourStart && !visualOccupied && "border-l border-l-white/10",
                visualOccupied 
                  ? (visualEquipe === 2 ? "bg-green-500 shadow-inner" : "bg-accent shadow-inner") 
                  : "bg-available/20 hover:bg-available/40",
                isInDragRange && dragAction === 'free' && (activeEquipe === null || equipeId === activeEquipe) && "bg-muted/40 ring-2 ring-inset ring-accent/20",
                isPast && "opacity-25 grayscale-[0.6] pointer-events-none"
              )}
            >
              {visualOccupied ? (
                <span className="text-[9px] font-black text-white drop-shadow-sm pointer-events-none select-none">
                  E{visualEquipe}
                </span>
              ) : (
                isHourStart && (
                  <div className="text-[7px] font-black leading-none select-none pointer-events-none text-white/50">
                    {time}
                  </div>
                )
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
      "bg-card border rounded-xl p-3 space-y-2 shadow-sm hover:shadow-md transition-all duration-300 select-none", 
      isLoading && "opacity-50 animate-pulse",
      compact && "p-2"
    )}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center bg-primary/10 border border-primary rounded-lg text-primary font-bold text-xs select-none shadow-sm shadow-primary/20">
            {initials}
          </div>
          <h3 className="font-bold text-sm text-foreground tracking-tight uppercase">{technician.name}</h3>
        </div>
        
        <div className="flex items-center gap-4">
          {isEditable && (
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setActiveEquipe(activeEquipe === 1 ? null : 1)}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-md border transition-all hover:opacity-80 active:scale-95 group",
                  activeEquipe === 1 ? "bg-accent/20 border-accent/40 ring-1 ring-accent/20" : "bg-muted/20 border-transparent",
                  isSelectionError && activeEquipe === null && "animate-blink ring-2 ring-primary"
                )}
              >
                <div className={cn("w-2 h-2 rounded-full border border-white/10", activeEquipe === 1 ? "bg-accent shadow-[0_0_8px_hsl(var(--accent))]" : "bg-muted")} />
                <span className={cn("text-[10px] font-black uppercase tracking-wider", activeEquipe === 1 ? "text-foreground" : "text-muted-foreground")}>E1</span>
              </button>

              <button 
                onClick={() => setActiveEquipe(activeEquipe === 2 ? null : 2)}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-md border transition-all hover:opacity-80 active:scale-95 group",
                  activeEquipe === 2 ? "bg-green-500/20 border-green-500/40 ring-1 ring-green-500/20" : "bg-muted/20 border-transparent",
                  isSelectionError && activeEquipe === null && "animate-blink ring-2 ring-primary"
                )}
              >
                <div className={cn("w-2 h-2 rounded-full border border-white/10", activeEquipe === 2 ? "bg-green-500 shadow-[0_0_8px_#22c55e]" : "bg-muted")} />
                <span className={cn("text-[10px] font-black uppercase tracking-wider", activeEquipe === 2 ? "text-foreground" : "text-muted-foreground")}>E2</span>
              </button>

              <div className="w-px h-6 bg-border/40 mx-1" />

              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleClearAll}
                className="h-7 text-[9px] gap-1 px-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 uppercase font-black tracking-wider transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Limpar
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-1">
        {(!visibleShift || visibleShift === 'morning') && renderSlotsBar('morning', slots.morning)}
        {(!visibleShift || visibleShift === 'afternoon') && renderSlotsBar('afternoon', slots.afternoon)}
      </div>

      <div className="flex justify-between items-center pt-1 text-[8px] text-muted-foreground border-t border-border/10 mt-1">
        <div className="flex gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-sm bg-accent shadow-[0_0_4px_hsl(var(--accent)/0.5)]" />
            <span>Equipe 1</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-sm bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.5)]" />
            <span>Equipe 2</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-sm bg-available/40 border border-white/5" />
            <span>Livre</span>
          </div>
        </div>
        <p className={cn(
          "font-black text-[7px] uppercase tracking-[0.1em] transition-colors duration-300",
          isEditable ? (activeEquipe === null ? "text-primary/70" : "text-white/60") : "text-white/20"
        )}>
          {isEditable ? (activeEquipe === null ? "SELECIONE EQUIPE PARA MARCAR" : "CLIQUE E ARRASTE PARA OCUPAR") : "MODO VISUALIZAÇÃO"}
        </p>
      </div>
    </div>
  );
}
