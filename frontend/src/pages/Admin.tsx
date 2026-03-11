import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  LayoutDashboard, Package, Newspaper, BarChart3, RefreshCw,
  Plus, ArrowLeft, Loader2, CloudDownload, TrendingUp,
  Database, Activity, ShieldAlert
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ─── Overview Stats ───
function OverviewTab() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [commodities, prices, predictions, news, listings] = await Promise.all([
        supabase.from("commodities").select("id", { count: "exact", head: true }),
        supabase.from("price_data").select("id", { count: "exact", head: true }),
        supabase.from("predictions").select("id", { count: "exact", head: true }),
        supabase.from("market_news").select("id", { count: "exact", head: true }),
        supabase.from("marketplace_listings").select("id", { count: "exact", head: true }),
      ]);
      setStats({
        commodities: commodities.count || 0,
        prices: prices.count || 0,
        predictions: predictions.count || 0,
        news: news.count || 0,
        listings: listings.count || 0,
      });
      setLoading(false);
    }
    load();
  }, []);

  const cards = [
    { label: "Commodities", value: stats?.commodities, icon: Package, color: "text-primary" },
    { label: "Price Records", value: stats?.prices, icon: BarChart3, color: "text-secondary" },
    { label: "Predictions", value: stats?.predictions, icon: TrendingUp, color: "text-accent-foreground" },
    { label: "News Articles", value: stats?.news, icon: Newspaper, color: "text-primary" },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c) => (
        <Card key={c.label} className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
              <c.icon className={cn("h-6 w-6", c.color)} />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {loading ? "…" : c.value?.toLocaleString()}
              </p>
              <p className="text-sm text-muted-foreground">{c.label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Commodities Manager ───
function CommoditiesTab() {
  const [commodities, setCommodities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("commodities").select("*").order("name");
    setCommodities(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{commodities.length} commodities registered</p>
        <Button size="sm" onClick={load} variant="outline" disabled={loading}>
          <RefreshCw className={cn("h-4 w-4 mr-1", loading && "animate-spin")} /> Refresh
        </Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {commodities.map((c) => (
          <Card key={c.id} className="group hover:shadow-md transition-all duration-200 hover:border-primary/30">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{c.icon || "🌾"}</span>
                <div>
                  <p className="font-semibold text-foreground">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.category} • {c.unit}</p>
                </div>
              </div>
              <Badge variant="outline" className="text-xs">{c.id.slice(0, 8)}</Badge>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── News Manager ───
function NewsTab() {
  const [articles, setArticles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ title: "", content: "", source: "", category: "general", image_url: "" });
  const [adding, setAdding] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("market_news").select("*").order("published_at", { ascending: false }).limit(50);
    setArticles(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    if (!form.title || !form.content) return toast.error("Title and content required");
    setSubmitting(true);
    const { error } = await supabase.from("market_news").insert({
      title: form.title, content: form.content, source: form.source || null,
      category: form.category, image_url: form.image_url || null,
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Article added!");
    setForm({ title: "", content: "", source: "", category: "general", image_url: "" });
    setAdding(false);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{articles.length} articles</p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4 mr-1", loading && "animate-spin")} /> Refresh
          </Button>
          <Button size="sm" onClick={() => setAdding(!adding)}>
            <Plus className="h-4 w-4 mr-1" /> Add Article
          </Button>
        </div>
      </div>

      {adding && (
        <Card className="border-primary/30">
          <CardHeader><CardTitle className="text-lg">New Article</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <Textarea placeholder="Content" rows={4} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
            <div className="grid grid-cols-2 gap-4">
              <Input placeholder="Source" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} />
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="policy">Policy</SelectItem>
                  <SelectItem value="weather">Weather</SelectItem>
                  <SelectItem value="market">Market</SelectItem>
                  <SelectItem value="technology">Technology</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Input placeholder="Image URL (optional)" value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} />
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
              <Button onClick={handleAdd} disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                Publish
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {articles.map((a) => (
          <Card key={a.id} className="group hover:shadow-md transition-all duration-200">
            <CardContent className="p-4">
              <p className="font-semibold text-foreground truncate">{a.title}</p>
              <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{a.content}</p>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="outline" className="text-xs">{a.category}</Badge>
                {a.source && <span className="text-xs text-muted-foreground">{a.source}</span>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── Data Sync Control ───
function DataSyncTab() {
  const [syncing, setSyncing] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("ingest-prices");
      if (error) throw error;
      setLastResult(data);
      toast.success(`Synced ${data.records_inserted} prices, ${data.predictions_generated} predictions`);
    } catch (e: any) {
      toast.error(e.message || "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CloudDownload className="h-5 w-5 text-primary" />
          Price Data Sync
        </CardTitle>
        <CardDescription>Trigger a manual sync. Prices and predictions will be refreshed.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={handleSync} disabled={syncing} size="lg" className="w-full sm:w-auto">
          {syncing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CloudDownload className="h-4 w-4 mr-2" />}
          {syncing ? "Syncing Data…" : "Sync Now"}
        </Button>
        {lastResult && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t">
            {[
              { label: "Records Inserted", value: lastResult.records_inserted },
              { label: "Predictions Generated", value: lastResult.predictions_generated },
              { label: "Commodities Updated", value: lastResult.commodities_updated },
              { label: "Data Source", value: lastResult.source === "data_gov_in" ? "Live API" : "Simulated" },
            ].map((s) => (
              <div key={s.label} className="text-center p-3 rounded-lg bg-muted/50">
                <p className="text-lg font-bold text-foreground">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Admin Page ───
export default function Admin() {
  const { user, isLoading } = useAuth();
  const { isAdmin, isLoading: roleLoading } = useUserRole();
  const navigate = useNavigate();

  if (isLoading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="p-8 text-center space-y-4">
            <LayoutDashboard className="h-12 w-12 text-muted-foreground mx-auto" />
            <h2 className="text-xl font-bold text-foreground">Admin Access Required</h2>
            <p className="text-muted-foreground">Please sign in as an admin to access this dashboard.</p>
            <Button onClick={() => navigate("/auth?type=admin")} className="w-full">Sign In as Admin</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="p-8 text-center space-y-4">
            <ShieldAlert className="h-12 w-12 text-destructive mx-auto" />
            <h2 className="text-xl font-bold text-foreground">Access Denied</h2>
            <p className="text-muted-foreground">Your account does not have admin privileges. Contact an administrator for access.</p>
            <Button onClick={() => navigate("/")} variant="outline" className="w-full">Back to Home</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="container px-4 flex h-14 items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <LayoutDashboard className="h-4 w-4 text-primary-foreground" />
              </div>
              <div>
                <h1 className="font-bold text-foreground leading-none">Admin Dashboard</h1>
                <p className="text-[11px] text-muted-foreground">AgriPrice Management</p>
              </div>
            </div>
          </div>
          <Badge variant="outline" className="text-xs hidden sm:flex">
            <Activity className="h-3 w-3 mr-1" />
            {user.email}
          </Badge>
        </div>
      </header>

      <main className="container px-4 py-8">
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid grid-cols-4 w-full max-w-xl mx-auto">
            <TabsTrigger value="overview" className="text-xs sm:text-sm">
              <Database className="h-4 w-4 mr-1 hidden sm:inline" /> Overview
            </TabsTrigger>
            <TabsTrigger value="commodities" className="text-xs sm:text-sm">
              <Package className="h-4 w-4 mr-1 hidden sm:inline" /> Commodities
            </TabsTrigger>
            <TabsTrigger value="news" className="text-xs sm:text-sm">
              <Newspaper className="h-4 w-4 mr-1 hidden sm:inline" /> News
            </TabsTrigger>
            <TabsTrigger value="sync" className="text-xs sm:text-sm">
              <CloudDownload className="h-4 w-4 mr-1 hidden sm:inline" /> Data Sync
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview"><OverviewTab /></TabsContent>
          <TabsContent value="commodities"><CommoditiesTab /></TabsContent>
          <TabsContent value="news"><NewsTab /></TabsContent>
          <TabsContent value="sync"><DataSyncTab /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
