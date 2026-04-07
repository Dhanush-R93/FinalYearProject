import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Leaf, Menu, X, BarChart3, MessageSquare, ShoppingBag, Bell, LogOut, TrendingUp, Cloud, Newspaper, Brain, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";

const navLinks = [
  { label: "Prices", href: "#dashboard", icon: BarChart3 },
  { label: "Predictions", href: "#predictions", icon: TrendingUp },
  { label: "Model", href: "#model-training", icon: Brain },
  { label: "Weather", href: "#weather", icon: Cloud },
  { label: "News", href: "#news", icon: Newspaper },
  { label: "Marketplace", href: "#marketplace", icon: ShoppingBag },
  { label: "AI Chat", href: "#chatbot", icon: MessageSquare },
];

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const { user, signOut } = useAuth();
  const { isAdmin } = useUserRole();

  const handleSignOut = async () => {
    await signOut();
    setIsOpen(false);
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <a href="#" className="flex items-center gap-2.5 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-transform group-hover:scale-105">
              <Leaf className="h-5 w-5" />
            </div>
            <div className="hidden sm:block">
              <span className="font-bold text-lg text-foreground">AgriPrice</span>
              <p className="text-xs text-muted-foreground -mt-0.5">Smart Farming</p>
            </div>
          </a>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
              >
                <link.icon className="h-4 w-4" />
                {link.label}
              </a>
            ))}
          </nav>

          {/* Right side */}
          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <>
                {isAdmin && (
                  <a href="/admin" className="p-2 rounded-lg hover:bg-muted transition-colors" title="Admin Dashboard">
                    <LayoutDashboard className="h-5 w-5 text-muted-foreground" />
                  </a>
                )}
                <a href="#alerts" className="p-2 rounded-lg hover:bg-muted transition-colors">
                  <Bell className="h-5 w-5 text-muted-foreground" />
                </a>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted">
                  <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center">
                    <span className="text-xs font-medium text-primary">
                      {user.email?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span className="text-sm font-medium text-foreground">
                    {user.email?.split("@")[0]}
                  </span>
                </div>
                <Button variant="ghost" size="sm" onClick={handleSignOut}>
                  <LogOut className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" asChild>
                  <a href="/auth">Sign In</a>
                </Button>
                <Button size="sm" className="btn-primary" asChild>
                  <a href="/auth">Get Started</a>
                </Button>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="lg:hidden p-2 rounded-lg hover:bg-muted transition-colors"
          >
            {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile Menu */}
        <div
          className={cn(
            "lg:hidden overflow-hidden transition-all duration-300",
            isOpen ? "max-h-[400px] pb-4" : "max-h-0"
          )}
        >
          <nav className="flex flex-col gap-1 pt-2">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                onClick={() => setIsOpen(false)}
              >
                <link.icon className="h-4 w-4" />
                {link.label}
              </a>
            ))}
            <div className="flex gap-2 mt-3 pt-3 border-t border-border">
              {user ? (
                <Button variant="ghost" size="sm" className="flex-1" onClick={handleSignOut}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </Button>
              ) : (
                <>
                  <Button variant="ghost" size="sm" className="flex-1" asChild>
                    <a href="/auth">Sign In</a>
                  </Button>
                  <Button size="sm" className="flex-1 btn-primary" asChild>
                    <a href="/auth">Get Started</a>
                  </Button>
                </>
              )}
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
}
