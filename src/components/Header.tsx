import { CalendarDays, ShieldCheck } from "lucide-react";

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md">
      <div className="container mx-auto px-4 md:px-8 flex h-16 items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-primary p-2 rounded-xl">
            <CalendarDays className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-primary">Agendamento Tech</h1>
        </div>
        <div className="flex items-center gap-2 text-sm text-accent font-medium bg-accent/10 px-3 py-1.5 rounded-full">
          <ShieldCheck className="h-4 w-4" />
          <span>Sistema Ativo</span>
        </div>
      </div>
    </header>
  );
}