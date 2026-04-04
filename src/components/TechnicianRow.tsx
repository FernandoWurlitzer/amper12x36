
"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import { Trash2, Sunrise, Sunset, Lock, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Technician } from "./ScheduleManager";
import { 
  useFirestore, 
  useCollection, 
  useDoc, 
  useMemoFirebase, 
  useUser, 
  setDocumentNonBlocking, 
  deleteDocumentNonBlocking,
  updateDocumentNonBlocking
} from "@/firebase";
import { collection, doc, serverTimestamp, getDocs } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = {
  technician: Technician;
  isEditable?: boolean;
  compact?: boolean;
};

interface ScheduledBlockData {
  id: string;
  equipe1?: boolean;
  equipe2?: boolean;
  technicianId: string;
  markedByUserId: string;
}

interface TechnicianProfile {
  status?: "OPERACIONAL" | "INDISPONÍVEL" | "SOBREAVISO";
  name?: string;
}

interface SlotDefinition {
  type: 'slot';
  time: string;
  key: string;
  label: string;
  isHourStart: boolean;
  h: number;
  m: number;
}

export function TechnicianRow({ technician, isEditable = false, compact = false }: Props) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [dragStart, setDragStart] = useState<{ type: 'morning' | 'afternoon', index: number } | null>(null);
  const [dragEnd, setDragEnd] = useState<{ type: 'morning' | 'afternoon', index: number } | null>(null);
  const [dragAction, setDragAction] = useState<'occupy' | 'free' | null>(null);
  
  // E1 Ativada por padrão conforme solicitado
  const [activeEquipe, setActiveEquipe] = useState<number | null>(1);
  const [isSelectionError, setIsSelectionError] = useState(false);
  const [currentTime, setCurrentTime] = useState<{ h: number, m: number } | null>(null);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);

  const [floatingTime, setFloatingTime] = useState<string | null>(null);
  const [showFloating, setShowFloating] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);

  const scheduledBlocksRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'technicians', technician.id, 'scheduledBlocks');
  }, [firestore, technician.id]);

  const { data: blocksData, isLoading } = useCollection<ScheduledBlockData>(scheduledBlocksRef);

  const techProfileRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'technicians', technician.id);
  }, [firestore, technician.id]);

  const { data: profileData } = useDoc<TechnicianProfile>(techProfileRef);
  const currentStatus = profileData?.status || "OPERACIONAL";

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime({ h: now.getHours(), m: now.getMinutes() });
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  const initials = useMemo(() => {
    return technician.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  }, [technician.name]);

  const occupiedSlotsMap = useMemo(() => {
    const map: Record<string, { e1: boolean; e2: boolean }> = {};
    if (blocksData) {
      blocksData.forEach(block => {
        map[block.id] = { e1: !!block.equipe1, e2: !!block.equipe2 };
      });
    }
    return map;
  }, [blocksData]);

  const isPast = useCallback((h: number, m: number) => {
    if (!currentTime) return false;
    if (h < currentTime.h) return true;
    if (h === currentTime.h && m < currentTime.m) return true;
    return false;
  }, [currentTime]);

  const baseSlots = useMemo(() => {
    const morning: SlotDefinition[] = [];
    const afternoon: SlotDefinition[] = [];

    const generateShift = (start: number, end: number, arr: SlotDefinition[]) => {
      for (let h = start; h < end; h++) {
        const hStr = h.toString().padStart(2, "0");
        arr.push({ type: 'slot', time: `${hStr}:00`, key: `${hStr}:00`, label: `${hStr}:00`, isHourStart: true, h, m: 0 });
        arr.push({ type: 'slot', time: `${hStr}:15`, key: `${hStr}:15`, label: `15`, isHourStart: false, h, m: 15 });
        arr.push({ type: 'slot', time: `${hStr}:30`, key: `${hStr}:30`, label: `30`, isHourStart: false, h, m: 30 });
        arr.push({ type: 'slot', time: `${hStr}:45`, key: `${hStr}:45`, label: `45`, isHourStart: false, h, m: 45 });
      }
      const lastH = end.toString().padStart(2, "0");
      arr.push({ type: 'slot', time: `${lastH}:00`, key: `${lastH}:00`, label: `${lastH}:00`, isHourStart: true, h: end, m: 0 });
    };

    // Ambos os turnos agora têm 6 horas (25 slots) para alinhamento perfeito
    generateShift(7, 13, morning);
    generateShift(14, 20, afternoon);
    return { morning, afternoon };
  }, []);

  const handleToggleSlots = useCallback((slotKeys: string[], action: 'occupy' | 'free', isSingleClick: boolean = false) => {
    if (!isEditable || !user || !firestore) return;

    slotKeys.forEach(time => {
      const [hStr, mStr] = time.split(':');
      const h = parseInt(hStr);
      const m = parseInt(mStr);

      const keysToProcess = [time];

      if (isSingleClick) {
        if (m === 15) {
          keysToProcess.push(`${hStr}:00`);
        } else if (m === 45) {
          const nextH = h + 1;
          const nextHStr = nextH.toString().padStart(2, "0");
          keysToProcess.push(`${nextHStr}:00`);
        }
      }

      keysToProcess.forEach(k => {
        const [kh, km] = k.split(':').map(Number);
        
        if (isPast(kh, km) && k === time && !isSingleClick) return;

        const docRef = doc(firestore, 'technicians', technician.id, 'scheduledBlocks', k);
        if (action === 'occupy' && activeEquipe !== null) {
          const update: any = {
            technicianId: technician.id,
            startTime: k,
            endTime: k,
            markedByUserId: user.uid,
            updatedAt: serverTimestamp(),
          };
          if (activeEquipe === 1) update.equipe1 = true;
          if (activeEquipe === 2) update.equipe2 = true;
          setDocumentNonBlocking(docRef, update, { merge: true });
        } else if (action === 'free') {
          if (activeEquipe === null) {
            deleteDocumentNonBlocking(docRef);
          } else {
            const update: any = {
              markedByUserId: user.uid,
              updatedAt: serverTimestamp(),
            };
            if (activeEquipe === 1) update.equipe1 = false;
            if (activeEquipe === 2) update.equipe2 = false;
            setDocumentNonBlocking(docRef, update, { merge: true });
          }
        }
      });
    });
  }, [isEditable, user, firestore, technician.id, activeEquipe, isPast]);

  const handleMouseUp = useCallback(() => {
    if (dragStart !== null && dragEnd !== null && dragAction !== null) {
      const type = dragStart.type;
      const minIdx = Math.min(dragStart.index, dragEnd.index);
      const maxIdx = Math.max(dragStart.index, dragEnd.index);
      const targetSlots = type === 'morning' ? baseSlots.morning : baseSlots.afternoon;
      
      const keysToUpdate = targetSlots.slice(minIdx, maxIdx + 1).map(s => s.key);
      const isSingle = minIdx === maxIdx;
      
      handleToggleSlots(keysToUpdate, dragAction, isSingle);
    }
    setDragStart(null);
    setDragEnd(null);
    setDragAction(null);

    setIsFadingOut(true);
    const timer = setTimeout(() => {
      setShowFloating(false);
      setFloatingTime(null);
      setIsFadingOut(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, [dragStart, dragEnd, dragAction, baseSlots, handleToggleSlots]);

  useEffect(() => {
    if (dragStart !== null) {
      window.addEventListener("mouseup", handleMouseUp);
      return () => window.removeEventListener("mouseup", handleMouseUp);
    }
  }, [dragStart, handleMouseUp]);

  const handleMouseDown = (type: 'morning' | 'afternoon', index: number) => {
    const targetSlots = type === 'morning' ? baseSlots.morning : baseSlots.afternoon;
    const slot = targetSlots[index];

    if (isPast(slot.h, slot.m)) return;

    if (!isEditable) {
      toast({ variant: "destructive", title: "Acesso Restrito", description: "Apenas TAC pode editar." });
      return;
    }
    
    const existing = occupiedSlotsMap[slot.key] || { e1: false, e2: false };

    if (existing.e1 || existing.e2) {
      setShowFloating(false);
    } else {
      setFloatingTime(slot.time);
      setShowFloating(true);
      setIsFadingOut(false);
    }

    if (activeEquipe === null) {
      if (existing.e1 || existing.e2) {
        setDragStart({ type, index });
        setDragEnd({ type, index });
        setDragAction('free');
      } else {
        setIsSelectionError(true);
        setTimeout(() => setIsSelectionError(false), 1600);
      }
      return;
    }

    const isCurrentActive = (activeEquipe === 1 && existing.e1) || (activeEquipe === 2 && existing.e2);
    setDragStart({ type, index });
    setDragEnd({ type, index });
    setDragAction(isCurrentActive ? 'free' : 'occupy');
  };

  const handleMouseEnter = (type: 'morning' | 'afternoon', index: number) => {
    if (dragStart !== null && dragStart.type === type) {
      setDragEnd({ type, index });
      const targetSlots = type === 'morning' ? baseSlots.morning : baseSlots.afternoon;
      setFloatingTime(targetSlots[index].time);
    }
  };

  const handleClearSelection = async (mode: 'e1' | 'e2' | 'both') => {
    if (!isEditable || !firestore || !scheduledBlocksRef) return;
    
    const snapshot = await getDocs(scheduledBlocksRef);
    snapshot.docs.forEach(d => {
      const timeKey = d.id;
      const [h, m] = timeKey.split(':').map(Number);
      
      if (!isPast(h, m)) {
        if (mode === 'both') {
          deleteDocumentNonBlocking(d.ref);
        } else if (mode === 'e1') {
          updateDocumentNonBlocking(d.ref, { equipe1: false });
        } else if (mode === 'e2') {
          updateDocumentNonBlocking(d.ref, { equipe2: false });
        }
      }
    });
    
    setClearDialogOpen(false);
    toast({ 
      title: "Agenda Limpa", 
      description: mode === 'both' ? "Todas as equipes removidas." : `Equipe ${mode.toUpperCase()} removida.`
    });
  };

  const handleStatusToggle = () => {
    if (!isEditable || !techProfileRef) return;
    const statuses: Array<TechnicianProfile["status"]> = ["OPERACIONAL", "INDISPONÍVEL", "SOBREAVISO"];
    const currentIndex = statuses.indexOf(currentStatus as any);
    const nextStatus = statuses[(currentIndex + 1) % statuses.length];
    setDocumentNonBlocking(techProfileRef, { status: nextStatus, updatedAt: serverTimestamp(), markedByUserId: user?.uid }, { merge: true });
  };

  const statusColor = useMemo(() => {
    switch (currentStatus) {
      case "OPERACIONAL": return "text-emerald-500";
      case "INDISPONÍVEL": return "text-red-600";
      case "SOBREAVISO": return "text-yellow-500";
      default: return "text-emerald-500";
    }
  }, [currentStatus]);

  const renderSlotsBar = (type: 'morning' | 'afternoon', timeSlots: SlotDefinition[]) => {
    return (
      <div className="space-y-1 select-none flex-1 relative">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5 text-[8px] font-black text-muted-foreground uppercase tracking-[0.2em]">
            {type === 'morning' ? <Sunrise className="h-2.5 w-2.5 text-red-600" /> : <Sunset className="h-2.5 w-2.5 text-blue-400" />}
            {type === 'morning' ? 'Manhã (07:00 - 13:00)' : 'TARDE (14:00 - 20:00)'}
          </div>
        </div>
        
        <div className={cn("flex h-20 items-stretch border border-white/20 rounded-xl overflow-hidden bg-black shadow-2xl relative", (!isEditable || isLoading) && "opacity-75")}>
          {showFloating && floatingTime && (
            <div className={cn(
              "absolute -top-10 left-1/2 -translate-x-1/2 bg-primary px-3 py-1.5 rounded-full shadow-2xl z-50 transition-all duration-[1000ms] ease-in-out",
              isFadingOut ? "opacity-0 scale-95 translate-y-2" : "opacity-100 scale-100"
            )}>
              <div className="flex items-center gap-1.5 text-white font-black text-[10px] tracking-widest">
                <Clock className="h-3 w-3" />
                {floatingTime}
              </div>
            </div>
          )}

          {timeSlots.map((slot, index) => {
            const existing = occupiedSlotsMap[slot.key] || { e1: false, e2: false };
            const isSlotPast = isPast(slot.h, slot.m);
            const isInDragRange = dragStart !== null && dragEnd !== null && dragStart.type === type && dragEnd.type === type && index >= Math.min(dragStart.index, dragEnd.index) && index <= Math.max(dragStart.index, dragEnd.index);

            let visualE1 = existing.e1;
            let visualE2 = existing.e2;

            if (isInDragRange && dragAction) {
              if (activeEquipe === 1) visualE1 = dragAction === 'occupy';
              else if (activeEquipe === 2) visualE2 = dragAction === 'occupy';
              else if (activeEquipe === null) { visualE1 = false; visualE2 = false; }
            }

            const hasBoth = visualE1 && visualE2;

            return (
              <div
                key={slot.key}
                onMouseDown={(e) => { e.preventDefault(); handleMouseDown(type, index); }}
                onMouseEnter={() => handleMouseEnter(type, index)}
                className={cn(
                  "group relative flex-1 flex flex-col items-stretch transition-all duration-75 border-r border-white/10 last:border-r-0",
                  isSlotPast ? "opacity-30 cursor-not-allowed bg-zinc-950" : (isEditable ? "cursor-pointer" : "cursor-default"),
                  !visualE1 && !visualE2 && "bg-zinc-900/60 hover:bg-white/10"
                )}
              >
                <div className="flex flex-col h-full w-full overflow-hidden">
                  {visualE1 && (
                    <div className={cn(
                      "bg-red-600 transition-all duration-300",
                      hasBoth ? "h-1/2" : "h-full"
                    )} />
                  )}
                  {visualE2 && (
                    <div className={cn(
                      "bg-emerald-500 transition-all duration-300",
                      hasBoth ? "h-1/2" : "h-full"
                    )} />
                  )}
                </div>
                
                <span className={cn(
                  "absolute inset-0 flex items-center justify-center text-[9px] font-black tracking-tighter uppercase pointer-events-none transition-colors",
                  isSlotPast ? "text-muted-foreground/30" : "text-white"
                )}>
                  {slot.label}
                </span>
                {isSlotPast && (
                  <div className="absolute top-1 right-1 opacity-20">
                    <Lock className="h-1.5 w-1.5" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className={cn("bg-zinc-900/60 border border-white/5 rounded-2xl p-6 space-y-6 shadow-xl hover:border-primary/10 transition-all duration-500", isLoading && "opacity-50", compact && "p-4")}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center bg-red-600 border border-black rounded-xl text-white font-black text-xs select-none shadow-lg">
            {initials}
          </div>
          <div className="space-y-0.5">
            <h3 className="font-black text-sm text-foreground tracking-tight uppercase">{technician.name}</h3>
            <div className={cn("flex items-center gap-1 text-[8px] font-bold uppercase tracking-widest", isEditable && "cursor-pointer hover:opacity-80")} onClick={handleStatusToggle}>
              <span className="text-white/40">STATUS:</span>
              <span className={cn("font-black", statusColor)}>{currentStatus}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isEditable && (
            <div className="flex items-center gap-2">
              <button onClick={() => setActiveEquipe(activeEquipe === 1 ? null : 1)} className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all", activeEquipe === 1 ? "bg-red-600 border-red-500 text-white shadow-lg" : "bg-zinc-800/40 border-white/5", isSelectionError && activeEquipe === null && "animate-blink ring-1 ring-primary/50")}>
                <div className={cn("w-2 h-2 rounded-full", activeEquipe === 1 ? "bg-white" : "bg-red-600")} />
                <span className="text-[10px] font-black uppercase tracking-widest">E1</span>
              </button>
              <button onClick={() => setActiveEquipe(activeEquipe === 2 ? null : 2)} className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all", activeEquipe === 2 ? "bg-emerald-500 border-emerald-400 text-white shadow-lg" : "bg-zinc-800/40 border-white/5", isSelectionError && activeEquipe === null && "animate-blink ring-1 ring-primary/50")}>
                <div className={cn("w-2 h-2 rounded-full", activeEquipe === 2 ? "bg-white" : "bg-emerald-500")} />
                <span className="text-[10px] font-black uppercase tracking-widest">E2</span>
              </button>
              <Button variant="ghost" size="sm" onClick={() => setClearDialogOpen(true)} className="h-8 text-[9px] gap-1.5 text-muted-foreground hover:text-white hover:bg-red-600 uppercase font-black rounded-lg px-2">
                <Trash2 className="h-4 w-4" />
                Limpar
              </Button>
            </div>
          )}
        </div>
      </div>
      
      <div className="flex flex-col gap-8">
        {renderSlotsBar('morning', baseSlots.morning)}
        {renderSlotsBar('afternoon', baseSlots.afternoon)}
      </div>

      <div className="flex justify-between items-center pt-3 text-[8px] font-black text-white/30 border-t border-white/5">
        <div className="flex gap-4 uppercase tracking-widest">
          <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded bg-red-600" /><span>Equipe 1</span></div>
          <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded bg-emerald-500" /><span>Equipe 2</span></div>
        </div>
        <p className="font-black text-[7px] uppercase tracking-[0.3em] text-white/20 animate-pulse">
          {isEditable ? "CLIQUE OU ARRASTE PARA AGENDAR" : "MODO VISUALIZAÇÃO"}
        </p>
      </div>

      <Dialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <DialogContent className="sm:max-w-[400px] border-primary/20 bg-card/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-center text-xl uppercase font-black tracking-tighter">Limpar Agenda</DialogTitle>
            <DialogDescription className="text-center text-xs uppercase tracking-widest opacity-70">
              Selecione qual equipe deseja remover para {technician.name}:
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-4">
            <Button 
              variant="outline" 
              className="h-12 border-red-500/50 hover:bg-red-500/10 text-red-500 font-black uppercase tracking-widest text-[10px]"
              onClick={() => handleClearSelection('e1')}
            >
              Limpar Equipe 1 (E1)
            </Button>
            <Button 
              variant="outline" 
              className="h-12 border-emerald-500/50 hover:bg-emerald-500/10 text-emerald-500 font-black uppercase tracking-widest text-[10px]"
              onClick={() => handleClearSelection('e2')}
            >
              Limpar Equipe 2 (E2)
            </Button>
            <Button 
              className="h-12 bg-primary hover:bg-primary/90 font-black uppercase tracking-widest text-[10px]"
              onClick={() => handleClearSelection('both')}
            >
              Limpar Ambas
            </Button>
            <Button 
              variant="ghost" 
              className="mt-2 text-[8px] uppercase tracking-[0.3em] opacity-50"
              onClick={() => setClearDialogOpen(false)}
            >
              Cancelar
            </Button>
          </div>
          <p className="text-[9px] text-center text-muted-foreground uppercase tracking-widest italic">
            * Histórico de atendimentos passados será preservado.
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
