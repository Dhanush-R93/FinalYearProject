import { Leaf, Github, Twitter, Mail, ArrowUp } from "lucide-react";

export function Footer() {
  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  return (
    <footer className="relative border-t border-border bg-muted/30 overflow-hidden">
      {/* Subtle decorative gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,hsl(var(--primary)/0.04),transparent_50%)]" />
      
      <div className="container relative z-10 px-4 py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          {/* Brand */}
          <div className="sm:col-span-2">
            <a href="#" className="inline-flex items-center gap-2.5 mb-4 group">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-transform group-hover:scale-110">
                <Leaf className="h-5 w-5" />
              </div>
              <div>
                <span className="font-bold text-lg text-foreground">AgriPrice</span>
                <p className="text-xs text-muted-foreground">Smart Farming</p>
              </div>
            </a>
            <p className="text-muted-foreground max-w-md mb-6 text-sm leading-relaxed">
              Empowering farmers with AI-driven price predictions for informed decision-making and sustainable agriculture across India.
            </p>
            <div className="flex gap-2">
              {[Github, Twitter, Mail].map((Icon, i) => (
                <a key={i} href="#" className="p-2.5 rounded-xl bg-card border border-border hover:border-primary/30 hover:bg-primary/5 hover:-translate-y-0.5 transition-all duration-200">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </a>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-semibold text-foreground mb-4 text-sm uppercase tracking-wider">Quick Links</h4>
            <ul className="space-y-3 text-sm">
              {[
                { label: "Dashboard", href: "#dashboard" },
                { label: "Predictions", href: "#predictions" },
                { label: "Marketplace", href: "#marketplace" },
                { label: "AI Chat", href: "#chatbot" },
              ].map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="text-muted-foreground hover:text-primary hover:translate-x-1 inline-flex transition-all duration-200">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="font-semibold text-foreground mb-4 text-sm uppercase tracking-wider">Resources</h4>
            <ul className="space-y-3 text-sm">
              {["Documentation", "API Access", "Research", "Support"].map((link) => (
                <li key={link}>
                  <a href="#" className="text-muted-foreground hover:text-primary hover:translate-x-1 inline-flex transition-all duration-200">
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <p>© 2026 AgriPrice. K.S. Rangasamy College of Technology.</p>
          <div className="flex items-center gap-4">
            <p>Built for sustainable agriculture</p>
            <button
              onClick={scrollToTop}
              className="p-2 rounded-xl bg-card border border-border hover:border-primary/30 hover:bg-primary/5 hover:-translate-y-0.5 transition-all duration-200"
              title="Back to top"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
