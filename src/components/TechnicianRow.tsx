
"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import { Clock, Coffee, Sunrise, Sunset, Trash2, AlertCircle } from "lucide-react";
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

      // Exibe manhã se for antes das 13h, senão exibe tarde
      if (hours < 13) {
        setVisibleShift('morning');
      } else if (hours >= 14) {
        setVisibleShift('afternoon');
      } else {
        // Durante o almoço (13h-14h), mantém o último turno ou padrão
        setVisibleShift(prev => prev || 'morning');
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

  const handleMouseDown = (type: 'morning' | 'afternoon', index: number) => {
    if (!isEditable) {
      toast({
        variant: "destructive",
        title: "Acesso Restrito",
        description: "Você não tem permissão para editar a agenda do TAC.",
      });
      return;
    }
    
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

  const renderSlotsBar = (type: 'morning' | 'afternoon', timeSlots: string[]) => (
    <div className="space-y-1 select-none">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1.5 text-[8px] font-bold text-muted-foreground uppercase tracking-wider">
          {type === 'morning' ? <Sunrise className="h-2.5 w-2.5 text-orange-400" /> : <Sunset className="h-2.5 w-2.5 text-blue-400" />}
          {type === 'morning' ? 'Turno 1 (08:00 - 13:00)' : 'Turno 2 (14:00 - 20:00)'}
        </div>
        {type === 'morning' && (
          <div className="flex items-center gap-1 text-[7px] font-black text-primary/60 uppercase">
            <Coffee className="h-2.5 w-2.5" />
            Intervalo 13h - 14h
          </div>
        )}
      </div>
      <div className={cn(
        "flex h-11 items-stretch border border-border rounded-lg overflow-hidden bg-muted/5 shadow-inner",
        (!isEditable || isLoading) && "opacity-75"
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

          return (
            <div
              key={time}
              onMouseDown={(e) => {
                e.preventDefault();
                handleMouseDown(type, index);
              }}
              onMouseEnter={() => handleMouseEnter(type, index)}
              className={cn(
                "group flex-1 relative flex items-center justify-center transition-all duration-150 border-r border-border/40 last:border-r-0",
                isEditable && !isPast ? "cursor-pointer" : "cursor-default",
                isHourStart && !visualOccupied && "border-l border-l-white/10",
                visualOccupied 
                  ? (visualEquipe === 2 ? "bg-green-500" : "bg-primary") 
                  : "bg-transparent hover:bg-white/5",
                isInDragRange && dragAction === 'free' && "bg-destructive/20 ring-2 ring-inset ring-destructive/40",
                isPast && "opacity-25 grayscale-[0.6] pointer-events-none"
              )}
            >
              {visualOccupied ? (
                <span className="text-[10px] font-black text-white pointer-events-none select-none">
                  E{visualEquipe}
                </span>
              ) : (
                isHourStart && (
                  <div className="text-[8px] font-black leading-none select-none pointer-events-none text-white/30">
                    {time}
                  </div>
                )
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className={cn(
      "bg-card border rounded-xl p-3 space-y-3 shadow-sm hover:shadow-md transition-all duration-300", 
      isLoading && "opacity-50",
      compact && "p-2"
    )}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center bg-primary/10 border border-primary rounded-lg text-primary font-bold text-xs select-none">
            {initials}
          </div>
          <h3 className="font-bold text-sm text-foreground tracking-tight uppercase">{technician.name}</h3>
        </div>
        
        <div className="flex items-center gap-4">
          {isEditable && (
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setActiveEquipe(activeEquipe === 1 ? null : 1)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all hover:scale-105 active:scale-95",
                  activeEquipe === 1 ? "bg-primary/20 border-primary shadow-lg shadow-primary/10" : "bg-muted/30 border-transparent",
                  isSelectionError && activeEquipe === null && "animate-blink ring-2 ring-primary"
                )}
              >
                <div className={cn("w-2.5 h-2.5 rounded-full", activeEquipe === 1 ? "bg-primary" : "bg-muted")} />
                <span className={cn("text-[10px] font-black uppercase tracking-widest", activeEquipe === 1 ? "text-foreground" : "text-muted-foreground")}>E1</span>
              </button>

              <button 
                onClick={() => setActiveEquipe(activeEquipe === 2 ? null : 2)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all hover:scale-105 active:scale-95",
                  activeEquipe === 2 ? "bg-green-500/20 border-green-500 shadow-lg shadow-green-500/10" : "bg-muted/30 border-transparent",
                  isSelectionError && activeEquipe === null && "animate-blink ring-2 ring-primary"
                )}
              >
                <div className={cn("w-2.5 h-2.5 rounded-full", activeEquipe === 2 ? "bg-green-500" : "bg-muted")} />
                <span className={cn("text-[10px] font-black uppercase tracking-widest", activeEquipe === 2 ? "text-foreground" : "text-muted-foreground")}>E2</span>
              </button>

              <div className="w-px h-6 bg-border mx-2" />

              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleClearAll}
                className="h-8 text-[10px] gap-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 uppercase font-black tracking-widest"
              >
                <Trash2 className="h-4 w-4" />
                Limpar
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {(!visibleShift || visibleShift === 'morning') && renderSlotsBar('morning', slots.morning)}
        {(!visibleShift || visibleShift === 'afternoon') && renderSlotsBar('afternoon', slots.afternoon)}
      </div>

      <div className="flex justify-between items-center pt-2 text-[9px] text-muted-foreground border-t border-border/10">
        <div className="flex gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-primary" />
            <span>Equipe 1</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-green-500" />
            <span>Equipe 2</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm border border-white/20" />
            <span>Livre</span>
          </div>
        </div>
        <p className="font-black text-[8px] uppercase tracking-widest text-primary/60">
          {isEditable ? (activeEquipe === null ? "SELECIONE EQUIPE PARA MARCAR" : "CLIQUE E ARRASTE PARA OCUPAR") : "MODO VISUALIZAÇÃO"}
        </p>
      </div>
    </div>
  );
}
