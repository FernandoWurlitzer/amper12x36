"use client";

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

  // Check if current user is a TAC Member
  const tacMemberRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'roles_tac_members', user.uid);
  }, [firestore, user]);

  const { data: tacMemberDoc, isLoading: isTacLoading } = useDoc(tacMemberRef);
  const isTacMember = !!tacMemberDoc;

  if (isAuthLoading || isTacLoading) {
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
              <li>Visitantes: Visualização da disponibilidade em tempo real via nuvem.</li>
              <li>As alterações são sincronizadas instantaneamente com o banco de dados.</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
