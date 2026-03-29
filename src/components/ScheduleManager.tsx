
"use client";

import { TechnicianRow } from "./TechnicianRow";
import { Card, CardContent } from "@/components/ui/card";
import { Info, Lock, Copy } from "lucide-react";
import { useUser, useFirestore, useDoc, useMemoFirebase } from "@/firebase";
import { doc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";

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
  const { toast } = useToast();

  // Check if current user is a TAC Member
  const tacMemberRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'roles_tac_members', user.uid);
  }, [firestore, user]);

  const { data: tacMemberDoc, isLoading: isTacLoading } = useDoc(tacMemberRef);
  const isTacMember = !!tacMemberDoc;

  const copyUid = () => {
    if (user?.uid) {
      navigator.clipboard.writeText(user.uid);
      toast({
        title: "UID Copiado!",
        description: "Agora cole este ID na coleção 'roles_tac_members' no Console do Firebase.",
      });
    }
  };

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
      {user && !isTacMember && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-6 space-y-4 text-destructive">
          <div className="flex items-center gap-3">
            <Lock className="h-5 w-5" />
            <p className="font-semibold">Acesso de Edição Negado</p>
          </div>
          <div className="text-sm space-y-2 text-foreground/80">
            <p>Seu usuário está logado, mas ainda não tem permissão para editar. Para liberar o acesso, adicione o seguinte ID na coleção <code className="bg-destructive/20 px-1 rounded">roles_tac_members</code> do Firestore:</p>
            <div 
              onClick={copyUid}
              className="flex items-center justify-between bg-background border border-destructive/30 p-3 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors group"
            >
              <code className="text-xs font-mono break-all">{user.uid}</code>
              <Copy className="h-4 w-4 shrink-0 opacity-50 group-hover:opacity-100" />
            </div>
            <p className="text-[10px] uppercase tracking-wider font-bold text-destructive/70">Clique no código acima para copiar</p>
          </div>
        </div>
      )}

      {!user && (
        <div className="bg-muted border rounded-xl p-4 flex items-center gap-3 text-muted-foreground">
          <Lock className="h-5 w-5" />
          <p className="text-sm font-medium">
            Modo de visualização. Faça login como TAC para gerenciar a agenda.
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
