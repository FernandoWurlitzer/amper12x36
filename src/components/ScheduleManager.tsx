"use client";

import { useState, useEffect } from "react";
import { TechnicianRow } from "./TechnicianRow";
import { Card, CardContent } from "@/components/ui/card";
import { Info } from "lucide-react";

export type Technician = {
  id: string;
  name: string;
};

const TECHNICIANS: Technician[] = [
  { id: "tech-1", name: "Francisco Beltrão" },
  { id: "tech-2", name: "Maria Santos" },
  { id: "tech-3", name: "Ricardo Lima" },
];

export function ScheduleManager() {
  const [scheduleData, setScheduleData] = useState<Record<string, string[]>>({});
  const [isLoaded, setIsLoaded] = useState(false);

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
    setScheduleData((prev) => {
      const currentTechSlots = prev[techId] || [];
      // Se o primeiro slot da seleção estiver livre, marcamos todos como ocupados.
      // Se estiver ocupado, limpamos todos na seleção.
      const firstSlotId = slotIds[0];
      const shouldOccupy = !currentTechSlots.includes(firstSlotId);
      
      let updatedSlots;
      if (shouldOccupy) {
        // Adiciona os novos slots garantindo que não haja duplicatas
        updatedSlots = Array.from(new Set([...currentTechSlots, ...slotIds]));
      } else {
        // Remove os slots da seleção
        updatedSlots = currentTechSlots.filter((id) => !slotIds.includes(id));
      }
      
      const newData = { ...prev, [techId]: updatedSlots };
      saveToLocalStorage(newData);
      return newData;
    });
  };

  if (!isLoaded) {
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
      <div className="grid grid-cols-1 gap-8">
        {TECHNICIANS.map((tech) => (
          <TechnicianRow
            key={tech.id}
            technician={tech}
            occupiedSlots={scheduleData[tech.id] || []}
            onToggleSlots={(slotIds) => handleToggleSlots(tech.id, slotIds)}
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
              <li>Clique e arraste com o mouse para marcar ou desmarcar vários blocos de uma vez.</li>
              <li>Cada bloco representa 15 minutos de atendimento.</li>
              <li>As alterações são salvas automaticamente no seu navegador.</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
