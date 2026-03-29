
"use client";

import { useState } from "react";
import { Header } from "@/components/Header";
import { 
  useUser, 
  useFirestore, 
  useDoc, 
  useMemoFirebase,
  addDocumentNonBlocking
} from "@/firebase";
import { doc, collection } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { 
  Plus, 
  Users, 
  ShieldAlert, 
  Loader2,
  UserPlus,
  Phone
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function TecnicosPage() {
  const { user, isUserLoading: isAuthLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  // Estados para o formulário
  const [techName, setTechName] = useState("");
  const [techPhoneTariff, setTechPhoneTariff] = useState("");
  const [techPhonePersonal, setTechPhonePersonal] = useState("");

  // Verificar permissão TAC
  const tacMemberRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'roles_tac_members', user.uid);
  }, [firestore, user]);

  const { data: tacMemberDoc, isLoading: isTacLoading } = useDoc(tacMemberRef);
  const isTacMember = !!tacMemberDoc;

  const techniciansRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'technicians');
  }, [firestore]);

  const handleAddTechnician = () => {
    if (!techName.trim()) {
      toast({
        variant: "destructive",
        title: "Nome inválido",
        description: "O nome do técnico é obrigatório.",
      });
      return;
    }

    if (!techniciansRef) return;

    addDocumentNonBlocking(techniciansRef, {
      name: techName.trim(),
      phoneTariff: techPhoneTariff.trim(),
      phonePersonal: techPhonePersonal.trim(),
      createdAt: new Date().toISOString()
    });

    // Limpar formulário
    setTechName("");
    setTechPhoneTariff("");
    setTechPhonePersonal("");
    
    toast({
      title: "Técnico Cadastrado",
      description: `${techName} foi adicionado com sucesso.`,
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
      
      <main className="flex-1 p-4 md:p-8 max-w-2xl mx-auto w-full">
        <div className="space-y-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 text-center md:text-left">
            <div className="space-y-1 mx-auto md:mx-0">
              <h2 className="text-3xl font-bold tracking-tight text-foreground uppercase flex items-center justify-center md:justify-start gap-3">
                <Users className="h-8 w-8 text-primary" />
                Gestão de Equipe
              </h2>
              <p className="text-muted-foreground text-sm uppercase tracking-widest opacity-70">
                Cadastro de Novos Técnicos
              </p>
            </div>
          </div>

          {!isTacMember ? (
            <Card className="border-destructive/20 bg-destructive/5">
              <CardContent className="p-8 flex flex-col items-center text-center space-y-4">
                <ShieldAlert className="h-12 w-12 text-destructive opacity-50" />
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-destructive">Acesso Administrativo Necessário</h3>
                  <p className="text-muted-foreground max-w-sm text-sm">
                    Apenas membros autorizados do TAC podem cadastrar profissionais.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-card/50 border-primary/10 shadow-2xl overflow-hidden">
              <CardHeader className="bg-primary/5 border-b border-primary/10">
                <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
                  <UserPlus className="h-4 w-4" />
                  Formulário de Cadastro
                </CardTitle>
              </CardHeader>
              <CardContent className="p-8">
                <div className="space-y-6">
                  {/* Campo Nome */}
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Nome Completo</Label>
                    <Input 
                      id="name"
                      placeholder="Ex: João da Silva" 
                      value={techName}
                      onChange={(e) => setTechName(e.target.value)}
                      className="bg-background/50 border-border/50 focus:border-primary/50 text-lg h-12"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {/* Campo Telefone Tarifa */}
                    <div className="space-y-2">
                      <Label htmlFor="tariff" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                        <Phone className="h-3 w-3" />
                        Telefone Tarifa
                      </Label>
                      <Input 
                        id="tariff"
                        placeholder="(00) 00000-0000" 
                        value={techPhoneTariff}
                        onChange={(e) => setTechPhoneTariff(e.target.value)}
                        className="bg-background/50 border-border/50 focus:border-primary/50"
                      />
                    </div>

                    {/* Campo Telefone Pessoal */}
                    <div className="space-y-2">
                      <Label htmlFor="personal" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                        <Phone className="h-3 w-3" />
                        Telefone Pessoal
                      </Label>
                      <Input 
                        id="personal"
                        placeholder="(00) 00000-0000" 
                        value={techPhonePessoal}
                        onChange={(e) => setTechPhonePersonal(e.target.value)}
                        className="bg-background/50 border-border/50 focus:border-primary/50"
                      />
                    </div>
                  </div>

                  <Button 
                    onClick={handleAddTechnician} 
                    className="w-full h-14 text-sm font-black uppercase tracking-[0.3em] shadow-xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95"
                  >
                    <Plus className="h-5 w-5" />
                    Cadastrar Técnico
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      <footer className="p-8 text-center text-[10px] text-muted-foreground uppercase tracking-[0.3em] opacity-50">
        &copy; {new Date().getFullYear()} AMPERNET 12x36.
      </footer>
    </div>
  );
}
