
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
  
  const [dragStart, setDragStart] = useState<{ type: 'morning' | 'afternoon', index: number } | null>(null);
  const [dragEnd, setDragEnd] = useState<{ type: 'morning' | 'afternoon', index: number } | null>(null);
  const [dragAction, setDragAction] = useState<'occupy' | 'free' | null>(null);
  
  const [activeEquipe, setActiveEquipe] = useState<number | null>(null);
  const [isSelectionError, setIsSelectionError] = useState(false);
  const [visibleShift, setVisibleShift] = useState<'morning' | 'afternoon' | null>(null);
  const [currentTime, setCurrentTime] = useState<{ h: number, m: number } | null>(null);

  const scheduledBlocksRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'technicians', technician.id, 'scheduledBlocks');
  }, [firestore, technician.id]);

  const { data: blocksData, isLoading } = useCollection<ScheduledBlockData>(scheduledBlocksRef);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      
      setCurrentTime({ h: hours, m: minutes });

      // Até as 12:59 mostra ambas, a partir das 13:00 somente tarde
      if (hours < 13) {
        setVisibleShift(null);
      } else {
        setVisibleShift('afternoon');
      }

      // Limpeza automática pontual às 20:59
      if (hours === 20 && minutes === 59 && isEditable && scheduledBlocksRef) {
        getDocs(scheduledBlocksRef).then(snapshot => {
          snapshot.docs.forEach(d => deleteDocumentNonBlocking(d.ref));
        }).catch(() => {});
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, [firestore, scheduledBlocksRef, isEditable]);

  const initials = useMemo(() => {
    return technician.name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }, [technician.name]);

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
        deleteDocumentNonBlocking(docRef);
      }
    });
  }, [isEditable, user, firestore, technician.id, activeEquipe]);

  const handleMouseUp = useCallback(() => {
    if (dragStart !== null && dragEnd !== null && dragAction !== null) {
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
        description: "Apenas membros do TAC podem editar a agenda.",
      });
      return;
    }
    
    const time = type === 'morning' ? slots.morning[index] : slots.afternoon[index];
    const existingEquipe = occupiedSlotsMap[time];
    const isOccupied = !!existingEquipe;

    if (activeEquipe === null) {
      if (isOccupied) {
        setDragStart({ type, index });
        setDragEnd({ type, index });
        setDragAction('free');
      } else {
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

    setDragStart({ type, index });
    setDragEnd({ type, index });
    setDragAction(isOccupied && existingEquipe === activeEquipe ? 'free' : 'occupy');
  };

  const handleMouseEnter = (type: 'morning' | 'afternoon', index: number) => {
    if (dragStart !== null && dragStart.type === type) {
      setDragEnd({ type, index });
    }
  };

  const handleClearAll = async () => {
    if (!isEditable || !firestore || !scheduledBlocksRef) return;
    
    if (confirm(`Deseja LIMPAR todos os horários da cidade ${technician.name}?`)) {
      try {
        const snapshot = await getDocs(scheduledBlocksRef);
        if (snapshot.empty) {
          toast({ title: "Agenda Vazia", description: "Não há horários para limpar." });
          return;
        }

        snapshot.docs.forEach(d => {
          deleteDocumentNonBlocking(d.ref);
        });

        toast({ 
          title: "Agenda Limpa", 
          description: `Todos os horários de ${technician.name} foram liberados.` 
        });
      } catch (e) {
        toast({
          variant: "destructive",
          title: "Erro ao limpar",
          description: "Verifique sua conexão ou permissões."
        });
      }
    }
  };

  const renderSlotsBar = (type: 'morning' | 'afternoon', timeSlots: string[]) => (
    <div className="space-y-1.5 select-none">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1.5 text-[9px] font-black text-muted-foreground uppercase tracking-[0.15em]">
          {type === 'morning' ? <Sunrise className="h-3 w-3 text-orange-400" /> : <Sunset className="h-3 w-3 text-blue-400" />}
          {type === 'morning' ? 'Turno 1 (08h - 13h)' : 'Turno 2 (14h - 20h)'}
        </div>
        {type === 'morning' && (
          <div className="flex items-center gap-1.5 text-[8px] font-black text-primary/70 uppercase tracking-widest bg-primary/5 px-2 py-0.5 rounded-full border border-primary/10">
            <Coffee className="h-3 w-3" />
            Intervalo Almoço
          </div>
        )}
      </div>
      <div className={cn(
        "flex h-12 items-stretch border-2 border-border/40 rounded-xl overflow-hidden bg-black shadow-2xl backdrop-blur-md",
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

          let visualOccupied = isOccupied;
          let visualEquipe = equipeId;

          if (isInDragRange && dragAction) {
            if (dragAction === 'occupy') {
              visualOccupied = true;
              visualEquipe = activeEquipe!;
            } else if (dragAction === 'free') {
              visualOccupied = false;
            }
          }

          return (
            <div
              key={time}
              onMouseDown={(e) => { e.preventDefault(); handleMouseDown(type, index); }}
              onMouseEnter={() => handleMouseEnter(type, index)}
              className={cn(
                "group flex-1 relative flex items-center justify-center transition-all duration-75 border-r border-white/10 last:border-r-0",
                isEditable && !isPast ? "cursor-pointer" : "cursor-default",
                visualOccupied 
                  ? (visualEquipe === 2 ? "bg-emerald-500" : "bg-orange-500") 
                  : "bg-black/80 hover:bg-white/10",
                isPast && "opacity-30 grayscale-[0.6] pointer-events-none"
              )}
            >
              <div className="flex flex-col items-center justify-center h-full w-full pointer-events-none">
                {isHourStart && (
                  <div className={cn(
                    "text-[10px] font-black absolute inset-0 flex items-center justify-center tracking-tighter drop-shadow-md transition-colors",
                    visualOccupied ? "text-white scale-110" : "text-white/40"
                  )}>
                    {time}
                  </div>
                )}
              </div>
              {/* Indicador sutil de 15 min */}
              {!isHourStart && !visualOccupied && <div className="absolute inset-0 border-r border-white/[0.03] pointer-events-none" />}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className={cn("bg-card border-2 rounded-2xl p-4 space-y-4 shadow-xl hover:border-primary/20 transition-all duration-500", isLoading && "opacity-50", compact && "p-3")}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center bg-primary/10 border-2 border-primary/30 rounded-xl text-primary font-black text-sm select-none shadow-inner">{initials}</div>
          <div className="space-y-0.5">
            <h3 className="font-black text-base text-foreground tracking-tight uppercase">{technician.name}</h3>
            <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest opacity-60">Status: Operacional</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {isEditable && (
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setActiveEquipe(activeEquipe === 1 ? null : 1)} 
                className={cn(
                  "flex items-center gap-2.5 px-4 py-2 rounded-xl border-2 transition-all shadow-sm", 
                  activeEquipe === 1 
                    ? "bg-orange-500 border-orange-400 text-white ring-4 ring-orange-500/20 scale-105" 
                    : "bg-muted/40 border-transparent hover:bg-muted/60", 
                  isSelectionError && activeEquipe === null && "animate-blink ring-4 ring-primary/50"
                )}
              >
                <div className={cn("w-3 h-3 rounded-full shadow-[inset_0_1px_2px_rgba(0,0,0,0.3)]", activeEquipe === 1 ? "bg-white" : "bg-orange-500")} />
                <span className={cn("text-xs font-black uppercase tracking-widest", activeEquipe === 1 ? "text-white" : "text-muted-foreground")}>E1</span>
              </button>
              <button 
                onClick={() => setActiveEquipe(activeEquipe === 2 ? null : 2)} 
                className={cn(
                  "flex items-center gap-2.5 px-4 py-2 rounded-xl border-2 transition-all shadow-sm", 
                  activeEquipe === 2 
                    ? "bg-emerald-500 border-emerald-400 text-white ring-4 ring-emerald-500/20 scale-105" 
                    : "bg-muted/40 border-transparent hover:bg-muted/60", 
                  isSelectionError && activeEquipe === null && "animate-blink ring-4 ring-primary/50"
                )}
              >
                <div className={cn("w-3 h-3 rounded-full shadow-[inset_0_1px_2px_rgba(0,0,0,0.3)]", activeEquipe === 2 ? "bg-white" : "bg-emerald-500")} />
                <span className={cn("text-xs font-black uppercase tracking-widest", activeEquipe === 2 ? "text-white" : "text-muted-foreground")}>E2</span>
              </button>
              <div className="w-px h-8 bg-border/50 mx-2" />
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={(e) => { e.stopPropagation(); handleClearAll(); }} 
                className="h-10 text-[10px] gap-2 text-muted-foreground hover:text-white hover:bg-destructive uppercase font-black tracking-[0.2em] rounded-xl px-4 transition-all"
              >
                <Trash2 className="h-4 w-4" /> LIMPAR
              </Button>
            </div>
          )}
        </div>
      </div>
      <div className="space-y-4">
        {(!visibleShift || visibleShift === 'morning') && renderSlotsBar('morning', slots.morning)}
        {(!visibleShift || visibleShift === 'afternoon') && renderSlotsBar('afternoon', slots.afternoon)}
      </div>
      <div className="flex justify-between items-center pt-4 text-[10px] font-black text-muted-foreground border-t-2 border-border/10">
        <div className="flex gap-6 uppercase tracking-widest">
          <div className="flex items-center gap-2"><div className="w-3.5 h-3.5 rounded-md bg-orange-500 shadow-sm" /><span>Equipe 1</span></div>
          <div className="flex items-center gap-2"><div className="w-3.5 h-3.5 rounded-md bg-emerald-500 shadow-sm" /><span>Equipe 2</span></div>
          <div className="flex items-center gap-2"><div className="w-3.5 h-3.5 rounded-md bg-black border-2 border-white/20 shadow-sm" /><span>Disponível</span></div>
        </div>
        <p className="font-black text-[9px] uppercase tracking-[0.3em] text-primary/80 animate-pulse">
          {isEditable ? (activeEquipe === null ? "Selecione uma equipe para marcar" : "Pressione e arraste na barra") : "Modo de Visualização (TAC)"}
        </p>
      </div>
    </div>
  );
}
