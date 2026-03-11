import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Bell, Plus, Trash2, Loader2, TrendingUp, TrendingDown } from "lucide-react";
import { useCommodities } from "@/hooks/useCommodities";
import { cn } from "@/lib/utils";

interface PriceAlert {
  id: string;
  alert_type: string;
  threshold_price: number;
  is_active: boolean;
  commodities: { name: string; icon: string | null; unit: string } | null;
}

export function PriceAlertsSection() {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({ commodity_id: "", alert_type: "above", threshold_price: "" });
  const { data: commodities } = useCommodities();

  const { data: alerts, isLoading } = useQuery({
    queryKey: ["price_alerts"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase.from("price_alerts").select(`*, commodities (name, icon, unit)`).eq("user_id", user.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data as PriceAlert[];
    },
  });

  const createAlert = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Please login to create an alert");
      const { error } = await supabase.from("price_alerts").insert({ user_id: user.id, commodity_id: formData.commodity_id, alert_type: formData.alert_type, threshold_price: parseFloat(formData.threshold_price) });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Alert created!"); queryClient.invalidateQueries({ queryKey: ["price_alerts"] }); setIsOpen(false); setFormData({ commodity_id: "", alert_type: "above", threshold_price: "" }); },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggleAlert = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase.from("price_alerts").update({ is_active: isActive }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["price_alerts"] }),
  });

  const deleteAlert = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("price_alerts").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Deleted"); queryClient.invalidateQueries({ queryKey: ["price_alerts"] }); },
  });

  return (
    <section id="alerts" className="py-16 bg-muted/30">
      <div className="container px-4">
        <div className="section-header">
          <div className="badge-secondary mb-4"><Bell className="h-4 w-4" />Price Alerts</div>
          <h2 className="section-title">Never Miss a Price Move</h2>
          <p className="section-description">Get notified when prices hit your targets</p>
        </div>

        <div className="flex justify-center mb-8">
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild><Button className="btn-primary gap-2"><Plus className="h-4 w-4" />Create Alert</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Price Alert</DialogTitle></DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); createAlert.mutate(); }} className="space-y-4">
                <Select value={formData.commodity_id} onValueChange={(v) => setFormData({ ...formData, commodity_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Commodity" /></SelectTrigger>
                  <SelectContent>{commodities?.map((c) => <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={formData.alert_type} onValueChange={(v) => setFormData({ ...formData, alert_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="above"><span className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-price-up" />Above</span></SelectItem>
                    <SelectItem value="below"><span className="flex items-center gap-2"><TrendingDown className="h-4 w-4 text-price-down" />Below</span></SelectItem>
                  </SelectContent>
                </Select>
                <Input type="number" placeholder="Target Price (₹)" value={formData.threshold_price} onChange={(e) => setFormData({ ...formData, threshold_price: e.target.value })} required />
                <Button type="submit" className="w-full btn-primary" disabled={createAlert.isPending}>{createAlert.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> : alerts && alerts.length > 0 ? (
          <div className="max-w-2xl mx-auto space-y-3">
            {alerts.map((alert) => (
              <div key={alert.id} className={cn("card-interactive p-4 flex items-center justify-between", !alert.is_active && "opacity-50")}>
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{alert.commodities?.icon}</span>
                  <div>
                    <p className="font-medium text-foreground flex items-center gap-2">
                      {alert.commodities?.name}
                      <span className={cn("text-xs px-2 py-0.5 rounded", alert.alert_type === "above" ? "bg-price-up/10 text-price-up" : "bg-price-down/10 text-price-down")}>
                        {alert.alert_type === "above" ? "↑" : "↓"} {alert.alert_type}
                      </span>
                    </p>
                    <p className="text-sm text-muted-foreground">Target: ₹{alert.threshold_price}/{alert.commodities?.unit}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Switch checked={alert.is_active} onCheckedChange={(c) => toggleAlert.mutate({ id: alert.id, isActive: c })} />
                  <Button variant="ghost" size="icon" onClick={() => deleteAlert.mutate(alert.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
          </div>
        ) : <div className="text-center py-12"><Bell className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" /><p className="text-muted-foreground">No alerts yet</p></div>}
      </div>
    </section>
  );
}
