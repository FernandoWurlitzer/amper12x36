
"use client";

import { useState } from "react";
import { Header } from "@/components/Header";
import { 
  useUser, 
  useFirestore, 
  useDoc, 
  useCollection, 
  useMemoFirebase,
  addDocumentNonBlocking
} from "@/firebase";
import { doc, collection } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Plus, 
  Users, 
  ShieldAlert, 
  Loader2,
  UserPlus
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Definindo o tipo para o Técnico
interface Technician {
  id: string;
  name: string;
  createdAt?: string;
}

export default function TecnicosPage() {
  const { user, isUserLoading: isAuthLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [newTechName, setNewTechName] = useState("");

  // Verificar permissão TAC
  const tacMemberRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'roles_tac_members', user.uid);
  }, [firestore, user]);

  const { data: tacMemberDoc, isLoading: isTacLoading } = useDoc(tacMemberRef);
  const isTacMember = !!tacMemberDoc;

  // Buscar técnicos do Firestore apenas para contagem ou lógica interna se necessário futuramente
  const techniciansRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'technicians');
  }, [firestore]);

  const handleAddTechnician = () => {
    if (!newTechName.trim()) {
      toast({
        variant: "destructive",
        title: "Nome inválido",
        description: "O nome do técnico não pode estar vazio.",
      });
      return;
    }

    if (!techniciansRef) return;

    addDocumentNonBlocking(techniciansRef, {
      name: newTechName.trim(),
      createdAt: new Date().toISOString()
    });

    setNewTechName("");
    toast({
      title: "Técnico Adicionado",
      description: `${newTechName} foi incluído na equipe.`,
    });
  };

  if (isAuthLoading || isTacLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background selection:bg-primary/20">
      <Header />
      
      <main className="flex-1 p-4 md:p-8 max-w-4xl mx-auto w-full">
        <div className="space-y-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-3xl font-bold tracking-tight text-foreground uppercase flex items-center gap-3">
                <Users className="h-8 w-8 text-primary" />
                Gestão de Equipe
              </h2>
              <p className="text-muted-foreground text-sm uppercase tracking-widest opacity-70">
                Cadastro de técnicos
              </p>
            </div>
          </div>

          {!isTacMember ? (
            <Card className="border-destructive/20 bg-destructive/5">
              <CardContent className="p-8 flex flex-col items-center text-center space-y-4">
                <ShieldAlert className="h-12 w-12 text-destructive opacity-50" />
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-destructive">Acesso Administrativo Necessário</h3>
                  <p className="text-muted-foreground max-w-sm">
                    Apenas membros autorizados do TAC podem gerenciar a lista de técnicos.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-8">
              {/* Formulário de Adição */}
              <Card className="bg-card/50 border-primary/10 shadow-xl overflow-hidden">
                <CardHeader className="bg-primary/5 border-b border-primary/10">
                  <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                    <UserPlus className="h-4 w-4" />
                    Adicionar Novo Técnico
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Input 
                      placeholder="Nome completo do técnico" 
                      value={newTechName}
                      onChange={(e) => setNewTechName(e.target.value)}
                      className="bg-background/50 border-border/50 focus:border-primary/50 text-lg h-12"
                      onKeyDown={(e) => e.key === 'Enter' && handleAddTechnician()}
                    />
                    <Button onClick={handleAddTechnician} className="h-12 px-8 gap-2 font-bold uppercase tracking-wider shadow-lg shadow-primary/20">
                      <Plus className="h-5 w-5" />
                      Cadastrar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </main>

      <footer className="p-8 text-center text-sm text-muted-foreground uppercase tracking-widest opacity-50">
        &copy; {new Date().getFullYear()} AMPERNET 12x36.
      </footer>
    </div>
  );
}
