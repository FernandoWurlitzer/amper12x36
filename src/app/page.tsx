import { ScheduleManager } from "@/components/ScheduleManager";
import { Header } from "@/components/Header";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col font-body bg-background selection:bg-primary/20">
      <Header />
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
        <div className="bg-card rounded-2xl shadow-sm border p-6 md:p-10 space-y-8">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight text-foreground uppercase">Agenda de Atendimento</h2>
            <p className="text-muted-foreground text-sm">
              Visualize e gerencie a disponibilidade dos técnicos 12x36. Horário de atendimento: 08:00 às 20:00.
            </p>
          </div>
          <ScheduleManager />
        </div>
      </main>
      <footer className="p-8 text-center text-sm text-muted-foreground uppercase tracking-widest opacity-50">
        &copy; {new Date().getFullYear()} AMPERNET 12x36. Todos os direitos reservados.
      </footer>
    </div>
  );
}
