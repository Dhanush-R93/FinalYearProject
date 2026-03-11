import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, MapPin, Package, Loader2, ShoppingBag, Star } from "lucide-react";
import { useCommodities } from "@/hooks/useCommodities";

interface Listing {
  id: string;
  quantity: number;
  price_per_unit: number;
  location: string;
  description: string | null;
  quality_grade: string | null;
  commodities: { name: string; icon: string | null; unit: string } | null;
}

export function MarketplaceSection() {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    commodity_id: "",
    quantity: "",
    price_per_unit: "",
    location: "",
    description: "",
    quality_grade: "A",
  });

  const { data: commodities } = useCommodities();

  const { data: listings, isLoading } = useQuery({
    queryKey: ["marketplace_listings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketplace_listings")
        .select(`*, commodities (name, icon, unit)`)
        .eq("is_available", true)
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data as Listing[];
    },
  });

  const createListing = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Please login to create a listing");
      const { error } = await supabase.from("marketplace_listings").insert({
        seller_id: user.id,
        commodity_id: formData.commodity_id,
        quantity: parseFloat(formData.quantity),
        price_per_unit: parseFloat(formData.price_per_unit),
        location: formData.location,
        description: formData.description || null,
        quality_grade: formData.quality_grade,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Listing created!");
      queryClient.invalidateQueries({ queryKey: ["marketplace_listings"] });
      setIsOpen(false);
      setFormData({ commodity_id: "", quantity: "", price_per_unit: "", location: "", description: "", quality_grade: "A" });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <section id="marketplace" className="py-16">
      <div className="container px-4">
        <div className="section-header">
          <div className="badge-primary mb-4">
            <ShoppingBag className="h-4 w-4" />
            Marketplace
          </div>
          <h2 className="section-title">Buy & Sell Fresh Produce</h2>
          <p className="section-description">Connect directly with farmers and traders</p>
        </div>

        <div className="flex justify-center mb-8">
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button className="btn-primary gap-2">
                <Plus className="h-4 w-4" /> List Your Produce
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Listing</DialogTitle>
              </DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); createListing.mutate(); }} className="space-y-4">
                <Select value={formData.commodity_id} onValueChange={(v) => setFormData({ ...formData, commodity_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select commodity" /></SelectTrigger>
                  <SelectContent>
                    {commodities?.map((c) => <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <div className="grid grid-cols-2 gap-3">
                  <Input type="number" placeholder="Quantity" value={formData.quantity} onChange={(e) => setFormData({ ...formData, quantity: e.target.value })} required />
                  <Input type="number" placeholder="Price (₹)" value={formData.price_per_unit} onChange={(e) => setFormData({ ...formData, price_per_unit: e.target.value })} required />
                </div>
                <Input placeholder="Location" value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} required />
                <Textarea placeholder="Description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={2} />
                <Button type="submit" className="w-full btn-primary" disabled={createListing.isPending}>
                  {createListing.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : listings && listings.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {listings.map((listing) => (
              <div key={listing.id} className="card-interactive p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-2xl">{listing.commodities?.icon || "🌾"}</span>
                  <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-xs font-medium flex items-center gap-1">
                    <Star className="h-3 w-3" />{listing.quality_grade}
                  </span>
                </div>
                <h3 className="font-semibold text-foreground mb-2">{listing.commodities?.name}</h3>
                <p className="text-xl font-bold text-primary mb-3">₹{listing.price_per_unit}<span className="text-sm text-muted-foreground font-normal">/{listing.commodities?.unit}</span></p>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p className="flex items-center gap-1"><Package className="h-3 w-3" />{listing.quantity} {listing.commodities?.unit}</p>
                  <p className="flex items-center gap-1"><MapPin className="h-3 w-3" />{listing.location}</p>
                </div>
                <Button variant="outline" size="sm" className="w-full mt-4">Contact</Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12"><ShoppingBag className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" /><p className="text-muted-foreground">No listings yet</p></div>
        )}
      </div>
    </section>
  );
}
