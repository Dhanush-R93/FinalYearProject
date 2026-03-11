import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, Sprout, Shield, Wheat } from "lucide-react";
import { cn } from "@/lib/utils";

type UserType = "farmer" | "admin";

export default function Auth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [userType, setUserType] = useState<UserType>(
    searchParams.get("type") === "admin" ? "admin" : "farmer"
  );

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        if (userType === "admin") {
          navigate("/admin");
        } else {
          navigate("/");
        }
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        if (userType === "admin") {
          navigate("/admin");
        } else {
          navigate("/");
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, userType]);

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setFullName("");
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (userType === "admin") {
      toast.error("Admin accounts can only be created by existing admins.");
      return;
    }
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: { full_name: fullName },
        },
      });
      if (error) throw error;
      toast.success("Account created! Please check your email to verify.");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      if (userType === "admin") {
        // Verify admin role server-side
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", authData.user.id)
          .eq("role", "admin")
          .maybeSingle();

        if (!roleData) {
          await supabase.auth.signOut();
          toast.error("Access denied. You do not have admin privileges.");
          setIsLoading(false);
          return;
        }
        toast.success("Welcome, Admin!");
        navigate("/admin");
      } else {
        toast.success("Welcome back!");
        navigate("/");
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const roles: { type: UserType; label: string; icon: typeof Wheat; desc: string }[] = [
    { type: "farmer", label: "Farmer", icon: Wheat, desc: "Access prices, predictions & marketplace" },
    { type: "admin", label: "Admin", icon: Shield, desc: "Manage data, news & system settings" },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="absolute inset-0 bg-gradient-hero opacity-[0.03]" />
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse-soft" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-secondary/20 rounded-full blur-3xl animate-pulse-soft" style={{ animationDelay: "1.5s" }} />

      <Card className="w-full max-w-md relative z-10 shadow-lg">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-primary shadow-glow">
              <Sprout className="h-6 w-6 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="font-display text-2xl">Welcome to AgriPrice</CardTitle>
          <CardDescription>Select your role to continue</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Role Selector */}
          <div className="grid grid-cols-2 gap-3">
            {roles.map((r) => (
              <button
                key={r.type}
                onClick={() => { setUserType(r.type); resetForm(); }}
                className={cn(
                  "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200",
                  userType === r.type
                    ? "border-primary bg-primary/5 shadow-md"
                    : "border-border hover:border-muted-foreground/30 hover:bg-muted/50"
                )}
              >
                <div className={cn(
                  "h-10 w-10 rounded-lg flex items-center justify-center transition-colors",
                  userType === r.type ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}>
                  <r.icon className="h-5 w-5" />
                </div>
                <span className={cn("font-semibold text-sm", userType === r.type ? "text-primary" : "text-foreground")}>{r.label}</span>
                <span className="text-[11px] text-muted-foreground text-center leading-tight">{r.desc}</span>
              </button>
            ))}
          </div>

          {/* Auth Forms */}
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              {userType === "farmer" && <TabsTrigger value="signup">Sign Up</TabsTrigger>}
              {userType === "admin" && (
                <TabsTrigger value="signup" disabled className="opacity-50">
                  Sign Up
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email</Label>
                  <Input id="signin-email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signin-password">Password</Label>
                  <Input id="signin-password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
                <Button type="submit" variant="hero" className="w-full" disabled={isLoading}>
                  {isLoading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Signing in...</> : (
                    <>
                      {userType === "admin" ? <Shield className="h-4 w-4 mr-2" /> : <Wheat className="h-4 w-4 mr-2" />}
                      Sign In as {userType === "admin" ? "Admin" : "Farmer"}
                    </>
                  )}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              {userType === "farmer" ? (
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Full Name</Label>
                    <Input id="signup-name" type="text" placeholder="Your name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input id="signup-email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <Input id="signup-password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
                  </div>
                  <Button type="submit" variant="hero" className="w-full" disabled={isLoading}>
                    {isLoading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Creating account...</> : "Create Farmer Account"}
                  </Button>
                </form>
              ) : (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  <Shield className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  Admin accounts can only be created by existing administrators.
                </div>
              )}
            </TabsContent>
          </Tabs>

          <div className="mt-4 text-center">
            <Button variant="link" onClick={() => navigate("/")} className="text-muted-foreground">
              ← Back to Home
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
