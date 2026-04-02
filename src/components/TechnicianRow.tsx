
"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import { Trash2, Sunrise, Sunset } from "lucide-react";
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
  minute: number;
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

  const techProfileRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'technicians', technician.id);
  }, [firestore, technician.id]);

  const { data: profileData } = useDoc<TechnicianProfile>(techProfileRef);
  const currentStatus = profileData?.status || "OPERACIONAL";

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      setCurrentTime({ h: hours, m: minutes });
      if (hours < 13) setVisibleShift(null);
      else setVisibleShift('afternoon');
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

  const slots = useMemo(() => {
    const morning: SlotDefinition[] = [];
    const afternoon: SlotDefinition[] = [];

    const generateShift = (start: number, end: number, arr: SlotDefinition[]) => {
      for (let h = start; h < end; h++) {
        const hStr = h.toString().padStart(2, "0");
        arr.push({ type: 'slot', time: `${hStr}:00`, key: `${hStr}:00`, label: `${hStr}:00`, isHourStart: true, minute: 0 });
        arr.push({ type: 'slot', time: `${hStr}:15`, key: `${hStr}:15`, label: `:15`, isHourStart: false, minute: 15 });
        arr.push({ type: 'slot', time: `${hStr}:30`, key: `${hStr}:30`, label: `:30`, isHourStart: false, minute: 30 });
        arr.push({ type: 'slot', time: `${hStr}:45`, key: `${hStr}:45`, label: `:45`, isHourStart: false, minute: 45 });
      }
      const lastH = end.toString().padStart(2, "0");
      arr.push({ type: 'slot', time: `${lastH}:00`, key: `${lastH}:00`, label: `${lastH}:00`, isHourStart: true, minute: 0 });
    };

    generateShift(8, 13, morning);
    generateShift(14, 20, afternoon);
    return { morning, afternoon };
  }, []);

  const handleToggleSlots = useCallback((slotKeys: string[], action: 'occupy' | 'free') => {
    if (!isEditable || !user || !firestore) return;

    slotKeys.forEach(time => {
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
  }, [isEditable, user, firestore, technician.id, activeEquipe]);

  const handleMouseUp = useCallback(() => {
    if (dragStart !== null && dragEnd !== null && dragAction !== null) {
      const type = dragStart.type;
      const minIdx = Math.min(dragStart.index, dragEnd.index);
      const maxIdx = Math.max(dragStart.index, dragEnd.index);
      const targetSlots = type === 'morning' ? slots.morning : slots.afternoon;
      
      const keysToUpdate = targetSlots.slice(minIdx, maxIdx + 1).map(s => s.key);
      handleToggleSlots(keysToUpdate, dragAction);
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
      toast({ variant: "destructive", title: "Acesso Restrito", description: "Apenas TAC pode editar." });
      return;
    }
    
    const targetSlots = type === 'morning' ? slots.morning : slots.afternoon;
    const slot = targetSlots[index];
    const existing = occupiedSlotsMap[slot.key] || { e1: false, e2: false };

    if (activeEquipe === null) {
      if (existing.e1 || existing.e2) {
        setDragStart({ type, index });
        setDragEnd({ type, index });
        setDragAction('free');
      } else {
        setIsSelectionError(true);
        setTimeout(() => setIsSelectionError(false), 1600);
        toast({ variant: "destructive", title: "Selecione Equipe", description: "Selecione E1 ou E2." });
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
      try {
        const snapshot = await getDocs(scheduledBlocksRef);
        snapshot.docs.forEach(d => deleteDocumentNonBlocking(d.ref));
        toast({ title: "Agenda Limpa" });
      } catch (e) {
        toast({ variant: "destructive", title: "Erro ao limpar" });
      }
    }
  };

  const handleStatusToggle = () => {
    if (!isEditable || !techProfileRef) return;
    const statuses: Array<TechnicianProfile["status"]> = ["OPERACIONAL", "INDISPONÍVEL", "SOBREAVISO"];
    const currentIndex = statuses.indexOf(currentStatus as any);
    const nextStatus = statuses[(currentIndex + 1) % statuses.length];
    setDocumentNonBlocking(techProfileRef, { status: nextStatus, name: technician.name }, { merge: true });
  };

  const statusColor = useMemo(() => {
    switch (currentStatus) {
      case "OPERACIONAL": return "text-emerald-500";
      case "INDISPONÍVEL": return "text-red-600";
      case "SOBREAVISO": return "text-yellow-500";
      default: return "text-emerald-500";
    }
  }, [currentStatus]);

  const renderSlotsBar = (type: 'morning' | 'afternoon', timeSlots: SlotDefinition[]) => (
    <div className="space-y-2 select-none">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1.5 text-[9px] font-black text-muted-foreground uppercase tracking-[0.15em]">
          {type === 'morning' ? <Sunrise className="h-3 w-3 text-red-600" /> : <Sunset className="h-3 w-3 text-blue-400" />}
          {type === 'morning' ? 'Turno 1 (08h - 13h)' : 'Turno 2 (14h - 20h)'}
        </div>
      </div>
      <div className={cn("flex h-12 items-stretch border border-white/5 rounded-xl overflow-hidden bg-zinc-950 shadow-2xl", (!isEditable || isLoading) && "opacity-75")}>
        {timeSlots.map((slot, index) => {
          const existing = occupiedSlotsMap[slot.key] || { e1: false, e2: false };
          const [slotH, slotM] = slot.time.split(":").map(Number);
          const isPast = currentTime && (currentTime.h > slotH || (currentTime.h === slotH && currentTime.m > slotM));

          const isInDragRange = dragStart !== null && dragEnd !== null && dragStart.type === type && dragEnd.type === type && index >= Math.min(dragStart.index, dragEnd.index) && index <= Math.max(dragStart.index, dragEnd.index);

          let visualE1 = existing.e1;
          let visualE2 = existing.e2;

          if (isInDragRange && dragAction) {
            if (activeEquipe === 1) visualE1 = dragAction === 'occupy';
            else if (activeEquipe === 2) visualE2 = dragAction === 'occupy';
            else if (activeEquipe === null) { visualE1 = false; visualE2 = false; }
          }

          const isShiftEnd = index === timeSlots.length - 1;

          return (
            <div
              key={slot.key}
              onMouseDown={(e) => { e.preventDefault(); handleMouseDown(type, index); }}
              onMouseEnter={() => handleMouseEnter(type, index)}
              className={cn(
                "group relative flex-1 flex flex-col items-stretch transition-all duration-75 border-r border-white/5",
                isShiftEnd && "border-r-2 border-white/20",
                isEditable && !isPast ? "cursor-pointer" : "cursor-default",
                !visualE1 && !visualE2 && "bg-zinc-900/40 hover:bg-white/5",
                isPast && "opacity-30 grayscale-[0.6] pointer-events-none"
              )}
            >
              <div className="flex flex-col h-full w-full overflow-hidden">
                {visualE1 && (
                  <div className={cn(
                    "bg-red-600 transition-all duration-300",
                    !visualE2 ? "h-full" : "h-1/2"
                  )} />
                )}
                {visualE2 && (
                  <div className={cn(
                    "bg-emerald-500 transition-all duration-300",
                    !visualE1 ? "h-full" : "h-1/2"
                  )} />
                )}
              </div>
              
              <span className={cn(
                "absolute inset-0 flex items-center justify-center text-[10px] font-black tracking-tighter uppercase pointer-events-none",
                (visualE1 || visualE2) ? "text-white drop-shadow-md" : "text-muted-foreground/60"
              )}>
                {slot.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className={cn("bg-zinc-900/60 border border-white/5 rounded-2xl p-4 space-y-4 shadow-xl hover:border-primary/10 transition-all duration-500", isLoading && "opacity-50", compact && "p-3")}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center bg-red-600 border border-black rounded-xl text-white font-black text-sm select-none shadow-lg shadow-black/50">
            {initials}
          </div>
          <div className="space-y-0.5">
            <h3 className="font-black text-base text-foreground tracking-tight uppercase">{technician.name}</h3>
            <div className={cn("flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest", isEditable && "cursor-pointer hover:opacity-80")} onClick={handleStatusToggle}>
              <span className="text-white">STATUS:</span>
              <span className={cn("font-black", statusColor)}>{currentStatus}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {isEditable && (
            <div className="flex items-center gap-3">
              <button onClick={() => setActiveEquipe(activeEquipe === 1 ? null : 1)} className={cn("flex items-center gap-2.5 px-4 py-2 rounded-xl border transition-all", activeEquipe === 1 ? "bg-red-600 border-red-500 text-white shadow-lg" : "bg-zinc-800/40 border-white/5", isSelectionError && activeEquipe === null && "animate-blink ring-4 ring-primary/50")}>
                <div className={cn("w-3 h-3 rounded-full", activeEquipe === 1 ? "bg-white" : "bg-red-600")} />
                <span className="text-xs font-black uppercase tracking-widest">E1</span>
              </button>
              <button onClick={() => setActiveEquipe(activeEquipe === 2 ? null : 2)} className={cn("flex items-center gap-2.5 px-4 py-2 rounded-xl border transition-all", activeEquipe === 2 ? "bg-emerald-500 border-emerald-400 text-white shadow-lg" : "bg-zinc-800/40 border-white/5", isSelectionError && activeEquipe === null && "animate-blink ring-4 ring-primary/50")}>
                <div className={cn("w-3 h-3 rounded-full", activeEquipe === 2 ? "bg-white" : "bg-emerald-500")} />
                <span className="text-xs font-black uppercase tracking-widest">E2</span>
              </button>
              <div className="w-px h-8 bg-white/5 mx-2" />
              <Button variant="ghost" size="sm" onClick={handleClearAll} className="h-10 text-[10px] gap-2 text-muted-foreground hover:text-white hover:bg-red-600 uppercase font-black rounded-xl px-4">
                <Trash2 className="h-4 w-4" /> LIMPAR
              </Button>
            </div>
          )}
        </div>
      </div>
      <div className="space-y-6">
        {(!visibleShift || visibleShift === 'morning') && renderSlotsBar('morning', slots.morning)}
        {(!visibleShift || visibleShift === 'afternoon') && renderSlotsBar('afternoon', slots.afternoon)}
      </div>
      <div className="flex justify-between items-center pt-4 text-[10px] font-black text-white border-t border-white/5">
        <div className="flex gap-6 uppercase tracking-widest">
          <div className="flex items-center gap-2"><div className="w-3.5 h-3.5 rounded-md bg-red-600" /><span>Equipe 1</span></div>
          <div className="flex items-center gap-2"><div className="w-3.5 h-3.5 rounded-md bg-emerald-500" /><span>Equipe 2</span></div>
          <div className="flex items-center gap-2"><div className="w-3.5 h-3.5 rounded-md bg-zinc-800/40 border border-white/10" /><span>Livre</span></div>
        </div>
        <p className="font-black text-[9px] uppercase tracking-[0.3em] text-white animate-pulse">
          {isEditable ? (activeEquipe === null ? "SELECIONE EQUIPE E ARRASTE" : "Pressione e arraste na barra") : "Modo Visualização"}
        </p>
      </div>
    </div>
  );
}
