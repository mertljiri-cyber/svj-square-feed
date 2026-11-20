import { Link, useLocation } from "react-router-dom";
import { Building2, Newspaper, Lightbulb, FileText, Menu, X, Wrench, CalendarDays, ClipboardList, FolderOpen, Settings } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/AuthProvider";

const navigation = [
  { name: "Úvod", href: "/", icon: Building2 },
  { name: "Novinky", href: "/novinky", icon: Newspaper },
  { name: "Záměry", href: "/zamery", icon: Lightbulb },
  { name: "Technický přehled", href: "/technicky-prehled", icon: Wrench },
  { name: "Plán oprav", href: "/plan-oprav", icon: CalendarDays },
  { name: "Dokumenty", href: "/dokumenty", icon: FolderOpen },
  { name: "Požadavky", href: "/pozadavky", icon: ClipboardList },
  { name: "Formuláře", href: "/formulare", icon: FileText },
];

export function Header() {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { session, isBoard, activeMembership, signOut } = useAuth();
  // Sekce Správa je viditelná jen výboru; přístup stejně vynucuje server.
  const items = [...navigation,
    ...(activeMembership && import.meta.env.VITE_SVJ_ASK_ENABLED === "true" ? [{name:"Zeptat se",href:"/zeptat-se",icon:Lightbulb}] : []),
    ...(isBoard ? [{ name: "Správa", href: "/sprava", icon: Settings }] : []),
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
              <Building2 className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="hidden sm:block">
              <div className="text-lg font-semibold text-foreground">SVJ Portal</div>
              <div className="text-xs text-muted-foreground">Společenství vlastníků</div>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {items.map((item) => {
              const isActive = location.pathname === item.href || 
                (item.href !== "/" && location.pathname.startsWith(item.href));
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {session ? (
            <button type="button" onClick={() => void signOut()} className="hidden md:inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground">
              Odhlásit se
            </button>
          ) : (
            <Link to="/prihlaseni" className="hidden md:inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground">
              Přihlášení členů
            </Link>
          )}

          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <nav className="md:hidden py-4 border-t border-border">
            <div className="flex flex-col gap-1">
              {items.map((item) => {
                const isActive = location.pathname === item.href || 
                  (item.href !== "/" && location.pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    }`}
                  >
                    <item.icon className="h-5 w-5" />
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}
