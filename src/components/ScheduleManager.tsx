"use client";

import { useState, useEffect } from "react";
import { TechnicianRow } from "./TechnicianRow";
import { Card, CardContent } from "@/components/ui/card";
import { Info, Lock } from "lucide-react";
import { useUser, useFirestore, useDoc, useMemoFirebase } from "@/firebase";
import { doc } from "firebase/firestore";

export type Technician = {
  id: string;
  name: string;
};

const TECHNICIANS: Technician[] = [
  { id: "tech-1", name: "Francisco Beltrão" },
  { id: "tech-2", name: "Ponta Grossa" },
  { id: "tech-3", name: "Pato Branco" },
];

export function ScheduleManager() {
  const { user, isUserLoading: isAuthLoading } = useUser();
  const firestore = useFirestore();
  const [scheduleData, setScheduleData] = useState<Record<string, string[]>>({});
  const [isLoaded, setIsLoaded] = useState(false);

  // Check if current user is a TAC Member
  const tacMemberRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'roles_tac_members', user.uid);
  }, [firestore, user]);

  const { data: tacMemberDoc, isLoading: isTacLoading } = useDoc(tacMemberRef);
  const isTacMember = !!tacMemberDoc;

  useEffect(() => {
    const saved = localStorage.getItem("agendamento-tech-v1");
    if (saved) {
      setScheduleData(JSON.parse(saved));
    }
    setIsLoaded(true);
  }, []);

  const saveToLocalStorage = (data: Record<string, string[]>) => {
    localStorage.setItem("agendamento-tech-v1", JSON.stringify(data));
  };

  const handleToggleSlots = (techId: string, slotIds: string[]) => {
    if (!isTacMember) return;

    setScheduleData((prev) => {
      const currentTechSlots = prev[techId] || [];
      const firstSlotId = slotIds[0];
      const shouldOccupy = !currentTechSlots.includes(firstSlotId);
      
      let updatedSlots;
      if (shouldOccupy) {
        updatedSlots = Array.from(new Set([...currentTechSlots, ...slotIds]));
      } else {
        updatedSlots = currentTechSlots.filter((id) => !slotIds.includes(id));
      }
      
      const newData = { ...prev, [techId]: updatedSlots };
      saveToLocalStorage(newData);
      return newData;
    });
  };

  if (!isLoaded || isAuthLoading || isTacLoading) {
    return (
      <div className="grid grid-cols-1 gap-6 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-48 bg-muted rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {!isTacMember && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 flex items-center gap-3 text-destructive">
          <Lock className="h-5 w-5" />
          <p className="text-sm font-medium">
            Modo de visualização. Apenas membros do TAC podem alterar a agenda.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-8">
        {TECHNICIANS.map((tech) => (
          <TechnicianRow
            key={tech.id}
            technician={tech}
            occupiedSlots={scheduleData[tech.id] || []}
            onToggleSlots={(slotIds) => handleToggleSlots(tech.id, slotIds)}
            isEditable={isTacMember}
          />
        ))}
      </div>

      <Card className="bg-muted/50 border-none shadow-none">
        <CardContent className="p-4 flex items-start gap-3 text-sm text-muted-foreground">
          <div className="bg-primary/10 p-2 rounded-full">
            <Info className="h-5 w-5 text-primary" />
          </div>
          <div className="space-y-1">
            <p className="font-medium text-foreground">Informações de Uso</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>Membros do TAC: Clique e arraste para marcar ou desmarcar vários blocos.</li>
              <li>Visitantes: Apenas visualização da disponibilidade em tempo real.</li>
              <li>As alterações são salvas localmente (versão MVP).</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
