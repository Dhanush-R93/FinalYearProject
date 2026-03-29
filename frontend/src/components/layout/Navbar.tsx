import { useState, useEffect } from "react";
import { Menu, X, Leaf } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { label: "Prices", href: "#dashboard" },
  { label: "Predictions", href: "#predictions" },
  { label: "Model", href: "#model" },
  { label: "Weather", href: "#weather" },
  { label: "News", href: "#news" },
  { label: "AI Chat", href: "#ai-chat" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);

  return (
    <nav className={cn(
      "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
      scrolled
        ? "bg-[#0a0f0a]/90 backdrop-blur-xl border-b border-[rgba(255,255,255,0.05)] shadow-[0_4px_30px_rgba(0,0,0,0.5)]"
        : "bg-transparent"
    )}>
      <div className="container px-4 max-w-7xl mx-auto">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <a href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-xl bg-green-500/20 border border-green-500/30 flex items-center justify-center group-hover:bg-green-500/30 transition-all">
              <Leaf className="w-4 h-4 text-green-400"/>
            </div>
            <div>
              <span className="text-white font-black text-lg leading-none">AgriPrice</span>
              <p className="text-green-500/60 text-[10px] leading-none font-medium">Smart Farming</p>
            </div>
          </a>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map(link => (
              <a key={link.label} href={link.href}
                className="text-white/50 hover:text-green-400 text-sm font-medium px-4 py-2 rounded-xl hover:bg-[rgba(255,255,255,0.05)] transition-all"
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Right side */}
          <div className="hidden md:flex items-center gap-3">
            <a href="#auth" className="text-white/50 hover:text-white text-sm font-medium px-4 py-2 transition-all">
              Sign In
            </a>
            <a href="#auth"
              className="bg-green-500 hover:bg-green-400 text-black text-sm font-bold px-5 py-2 rounded-xl transition-all hover:shadow-[0_0_20px_rgba(34,197,94,0.3)]"
            >
              Get Started
            </a>
          </div>

          {/* Mobile menu button */}
          <button onClick={() => setOpen(!open)}
            className="md:hidden text-white/60 hover:text-white p-2"
          >
            {open ? <X className="w-5 h-5"/> : <Menu className="w-5 h-5"/>}
          </button>
        </div>

        {/* Mobile menu */}
        {open && (
          <div className="md:hidden border-t border-[rgba(255,255,255,0.05)] py-4 space-y-1">
            {NAV_LINKS.map(link => (
              <a key={link.label} href={link.href}
                onClick={() => setOpen(false)}
                className="block text-white/60 hover:text-green-400 text-sm font-medium px-4 py-3 rounded-xl hover:bg-[rgba(255,255,255,0.05)] transition-all"
              >
                {link.label}
              </a>
            ))}
            <div className="pt-2 flex gap-2 px-4">
              <a href="#auth" className="flex-1 text-center text-white/60 text-sm font-medium py-2.5 rounded-xl border border-white/10">Sign In</a>
              <a href="#auth" className="flex-1 text-center bg-green-500 text-black text-sm font-bold py-2.5 rounded-xl">Get Started</a>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
