
"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import { Trash2, Sunrise, Sunset, Lock, CheckCircle2, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { Technician } from "./ScheduleManager";
import { useFirestore, useCollection, useDoc, useMemoFirebase, useUser, setDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase";
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
  
  const [activeEquipe, setActiveEquipe] = useState<number | null>(null);
  const [isSelectionError, setIsSelectionError] = useState(false);
  const [currentTime, setCurrentTime] = useState<{ h: number, m: number } | null>(null);

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

    generateShift(8, 13, morning);
    generateShift(14, 20, afternoon);
    return { morning, afternoon };
  }, []);

  const filteredSlots = useMemo(() => {
    if (!currentTime) return baseSlots;

    const filterShift = (shift: SlotDefinition[], isMorning: boolean) => {
      if (isMorning && currentTime.h >= 13) return [];
      const thresholdH = Math.max(isMorning ? 8 : 14, currentTime.h - 1);
      return shift.filter(slot => slot.h >= thresholdH);
    };

    return {
      morning: filterShift(baseSlots.morning, true),
      afternoon: filterShift(baseSlots.afternoon, false)
    };
  }, [baseSlots, currentTime]);

  const handleToggleSlots = useCallback((slotKeys: string[], action: 'occupy' | 'free') => {
    if (!isEditable || !user || !firestore) return;

    const keysToProcess = new Set<string>();
    const isBatch = slotKeys.length > 1;

    slotKeys.forEach(k => {
      const [hStr, mStr] = k.split(':');
      const h = parseInt(hStr);
      const m = parseInt(mStr);

      if (isPast(h, m)) return;

      keysToProcess.add(k);

      if (action === 'occupy') {
        // Only apply automatic hour linking for single slot selection
        if (!isBatch) {
          if (m === 15) keysToProcess.add(`${hStr}:00`);
          if (m === 45) {
            const nextHStr = (h + 1).toString().padStart(2, '0');
            keysToProcess.add(`${nextHStr}:00`);
          }
        }
      } else {
        // Only apply automatic hour unlinking for single slot selection
        if (!isBatch) {
          if (m === 15) {
            const prevHour45 = (h - 1).toString().padStart(2, '0') + ':45';
            const isPrev45Occupied = occupiedSlotsMap[prevHour45]?.e1 || occupiedSlotsMap[prevHour45]?.e2;
            if (!isPrev45Occupied) keysToProcess.add(`${hStr}:00`);
          }
          if (m === 45) {
            const nextHour15 = (h + 1).toString().padStart(2, '0') + ':15';
            const isNext15Occupied = occupiedSlotsMap[nextHour15]?.e1 || occupiedSlotsMap[nextHour15]?.e2;
            const nextHStr = (h + 1).toString().padStart(2, '0');
            if (!isNext15Occupied) keysToProcess.add(`${nextHStr}:00`);
          }
        }
      }
    });

    keysToProcess.forEach(time => {
      const docRef = doc(firestore, 'technicians', technician.id, 'scheduledBlocks', time);
      if (action === 'occupy' && activeEquipe !== null) {
        const update: any = {
          technicianId: technician.id,
          startTime: time,
          endTime: time,
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
  }, [isEditable, user, firestore, technician.id, activeEquipe, occupiedSlotsMap, isPast]);

  const handleMouseUp = useCallback(() => {
    if (dragStart !== null && dragEnd !== null && dragAction !== null) {
      const type = dragStart.type;
      const minIdx = Math.min(dragStart.index, dragEnd.index);
      const maxIdx = Math.max(dragStart.index, dragEnd.index);
      const targetSlots = type === 'morning' ? filteredSlots.morning : filteredSlots.afternoon;
      
      const keysToUpdate = targetSlots.slice(minIdx, maxIdx + 1).map(s => s.key);
      handleToggleSlots(keysToUpdate, dragAction);
    }
    setDragStart(null);
    setDragEnd(null);
    setDragAction(null);
  }, [dragStart, dragEnd, dragAction, filteredSlots, handleToggleSlots]);

  useEffect(() => {
    if (dragStart !== null) {
      window.addEventListener("mouseup", handleMouseUp);
      return () => window.removeEventListener("mouseup", handleMouseUp);
    }
  }, [dragStart, handleMouseUp]);

  const handleMouseDown = (type: 'morning' | 'afternoon', index: number) => {
    const targetSlots = type === 'morning' ? filteredSlots.morning : filteredSlots.afternoon;
    const slot = targetSlots[index];

    if (isPast(slot.h, slot.m)) return;

    if (!isEditable) {
      toast({ variant: "destructive", title: "Acesso Restrito", description: "Apenas TAC pode editar." });
      return;
    }
    
    const existing = occupiedSlotsMap[slot.key] || { e1: false, e2: false };

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
    }
  };

  const handleClearAll = async () => {
    if (!isEditable || !firestore || !scheduledBlocksRef) return;
    if (window.confirm(`LIMPAR TODOS os horários de ${technician.name}?`)) {
      const snapshot = await getDocs(scheduledBlocksRef);
      snapshot.docs.forEach(d => {
        const timeKey = d.id;
        const [h, m] = timeKey.split(':').map(Number);
        // Lixeira Seletiva: remove apenas horários futuros ou o atual exato
        if (!isPast(h, m)) deleteDocumentNonBlocking(d.ref);
      });
      toast({ title: "Agenda Limpa" });
    }
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
    if (timeSlots.length === 0) return null;
    return (
      <div className="space-y-1 select-none flex-1">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5 text-[7px] font-black text-muted-foreground uppercase tracking-[0.2em]">
            {type === 'morning' ? <Sunrise className="h-2 w-2 text-red-600" /> : <Sunset className="h-2 w-2 text-blue-400" />}
            {type === 'morning' ? 'Manhã' : 'Tarde (14:00 - 20:00)'}
          </div>
        </div>
        <div className={cn("flex h-20 items-stretch border border-white/5 rounded-xl overflow-hidden bg-zinc-950 shadow-2xl", (!isEditable || isLoading) && "opacity-75")}>
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
                  "group relative flex-1 flex flex-col items-stretch transition-all duration-75 border-r border-white/5 last:border-r-0",
                  isSlotPast ? "opacity-30 cursor-not-allowed bg-zinc-900" : (isEditable ? "cursor-pointer" : "cursor-default"),
                  !visualE1 && !visualE2 && "bg-zinc-900/40 hover:bg-white/5"
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
                  "absolute inset-0 flex items-center justify-center text-[9px] font-black tracking-tighter uppercase pointer-events-none",
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
    <div className={cn("bg-zinc-900/60 border border-white/5 rounded-2xl p-4 space-y-4 shadow-xl hover:border-primary/10 transition-all duration-500", isLoading && "opacity-50", compact && "p-3")}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center bg-red-600 border border-black rounded-lg text-white font-black text-[10px] select-none shadow-lg">
            {initials}
          </div>
          <div className="space-y-0">
            <h3 className="font-black text-xs text-foreground tracking-tight uppercase">{technician.name}</h3>
            <div className={cn("flex items-center gap-1 text-[7px] font-bold uppercase tracking-widest", isEditable && "cursor-pointer hover:opacity-80")} onClick={handleStatusToggle}>
              <span className="text-white/40">STATUS:</span>
              <span className={cn("font-black", statusColor)}>{currentStatus}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isEditable && (
            <div className="flex items-center gap-1.5">
              <button onClick={() => setActiveEquipe(activeEquipe === 1 ? null : 1)} className={cn("flex items-center gap-1 px-2 py-1 rounded-md border transition-all", activeEquipe === 1 ? "bg-red-600 border-red-500 text-white shadow-lg" : "bg-zinc-800/40 border-white/5", isSelectionError && activeEquipe === null && "animate-blink ring-1 ring-primary/50")}>
                <div className={cn("w-1.5 h-1.5 rounded-full", activeEquipe === 1 ? "bg-white" : "bg-red-600")} />
                <span className="text-[8px] font-black uppercase tracking-widest">E1</span>
              </button>
              <button onClick={() => setActiveEquipe(activeEquipe === 2 ? null : 2)} className={cn("flex items-center gap-1 px-2 py-1 rounded-md border transition-all", activeEquipe === 2 ? "bg-emerald-500 border-emerald-400 text-white shadow-lg" : "bg-zinc-800/40 border-white/5", isSelectionError && activeEquipe === null && "animate-blink ring-1 ring-primary/50")}>
                <div className={cn("w-1.5 h-1.5 rounded-full", activeEquipe === 2 ? "bg-white" : "bg-emerald-500")} />
                <span className="text-[8px] font-black uppercase tracking-widest">E2</span>
              </button>
              <Button variant="ghost" size="sm" onClick={handleClearAll} className="h-6 text-[7px] gap-1 text-muted-foreground hover:text-white hover:bg-red-600 uppercase font-black rounded-md px-1.5">
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-col md:flex-row gap-3">
        {renderSlotsBar('morning', filteredSlots.morning)}
        {renderSlotsBar('afternoon', filteredSlots.afternoon)}
      </div>
      <div className="flex justify-between items-center pt-2 text-[7px] font-black text-white/30 border-t border-white/5">
        <div className="flex gap-3 uppercase tracking-widest">
          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded bg-red-600" /><span>E1</span></div>
          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded bg-emerald-500" /><span>E2</span></div>
        </div>
        <p className="font-black text-[6px] uppercase tracking-[0.3em] text-white/20 animate-pulse">
          {isEditable ? "PRESSIONE E ARRASTE" : "MODO VISUALIZAÇÃO"}
        </p>
      </div>
    </div>
  );
}
