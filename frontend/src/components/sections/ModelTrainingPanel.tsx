import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { agriApi } from "@/services/api";
import { Brain, Play, CheckCircle, AlertCircle, Activity, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useCommodities } from "@/hooks/useCommodities";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Status = "idle" | "training" | "success" | "error";

export const ModelTrainingPanel = () => {
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState(0);
  const [metrics, setMetrics] = useState<any>(null);
  const [error, setError] = useState("");
  const [selectedCommodity, setSelectedCommodity] = useState("Tomato");
  const { data: commodities } = useCommodities();

  const handleTrain = async () => {
    setStatus("training");
    setProgress(10);
    setError("");
    setMetrics(null);

    const interval = setInterval(() => {
      setProgress((p) => Math.min(p + Math.random() * 6, 88));
    }, 1000);

    try {
      const res = await agriApi.trainModel({
        commodity: selectedCommodity,
        state: "Tamil Nadu",
        days: 365,
        epochs: 50,
      });
      clearInterval(interval);
      setProgress(100);
      setMetrics(res.metrics);
      setStatus("success");
      toast.success(`Model trained for ${selectedCommodity}! ${res.epochs_run} epochs, ${res.data_rows} rows.`);
    } catch (e: any) {
      clearInterval(interval);
      setProgress(0);
      setStatus("error");
      setError(e.message || "Training failed");
      toast.error(`Training failed: ${e.message}`);
    }
  };

  const fetchMetrics = async () => {
    try {
      const m = await agriApi.getMetrics(selectedCommodity);
      setMetrics(m);
      toast.success("Metrics loaded!");
    } catch {
      toast.error("Train the model first to see metrics.");
    }
  };

  return (
    <section id="model" className="py-16">
      <div className="container px-4">
        <div className="section-header">
          <div className="badge-primary mb-4"><Brain className="h-4 w-4" /> AI Model</div>
          <h2 className="section-title">LSTM Model Training</h2>
          <p className="section-description">Train and evaluate the price prediction model</p>
        </div>

        <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-6">
          {/* Training Control */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" /> Training Control
              </CardTitle>
              <CardDescription>Train the LSTM model on historical price data</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Commodity selector */}
              <div>
                <label className="text-sm font-medium mb-2 block">Select Commodity</label>
                <Select value={selectedCommodity} onValueChange={setSelectedCommodity}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {commodities?.map((c) => (
                      <SelectItem key={c.id} value={c.name}>
                        {c.icon} {c.name}
                      </SelectItem>
                    )) ?? (
                      ["Tomato","Onion","Potato","Brinjal","Cabbage"].map(n => (
                        <SelectItem key={n} value={n}>{n}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Status */}
              <div className="flex items-center gap-2 text-sm">
                {status === "idle" && <Brain className="h-4 w-4 text-muted-foreground" />}
                {status === "training" && <Activity className="h-4 w-4 text-primary animate-pulse" />}
                {status === "success" && <CheckCircle className="h-4 w-4 text-green-500" />}
                {status === "error" && <AlertCircle className="h-4 w-4 text-destructive" />}
                <span className={
                  status === "success" ? "text-green-600" :
                  status === "error" ? "text-destructive" :
                  status === "training" ? "text-primary" : "text-muted-foreground"
                }>
                  {status === "idle" ? "Ready to train" :
                   status === "training" ? "Training in progress..." :
                   status === "success" ? "Training complete!" :
                   error || "Training failed"}
                </span>
              </div>

              {status === "training" && (
                <Progress value={progress} className="h-2" />
              )}

              <div className="flex gap-3">
                <Button onClick={handleTrain} disabled={status === "training"} className="flex-1">
                  {status === "training"
                    ? <><Activity className="h-4 w-4 mr-2 animate-spin" />Training...</>
                    : <><Play className="h-4 w-4 mr-2" />Train Model</>
                  }
                </Button>
                <Button variant="outline" onClick={fetchMetrics}>
                  <RefreshCw className="h-4 w-4 mr-2" />Load Metrics
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Metrics */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" /> Evaluation Metrics
              </CardTitle>
              <CardDescription>Model performance on test data</CardDescription>
            </CardHeader>
            <CardContent>
              {metrics ? (
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: "MAE (₹/kg)", value: metrics.mae?.toFixed(2), desc: "Mean Absolute Error" },
                    { label: "RMSE (₹/kg)", value: metrics.rmse?.toFixed(2), desc: "Root Mean Square Error" },
                    { label: "MAPE (%)", value: metrics.mape?.toFixed(2), desc: "Mean Absolute % Error" },
                    { label: "R² Score", value: metrics.r2_score?.toFixed(3), desc: "Coefficient of determination" },
                  ].map((m) => (
                    <div key={m.label} className="bg-muted/50 rounded-xl p-4">
                      <p className="text-xs text-muted-foreground mb-1">{m.desc}</p>
                      <p className="text-2xl font-bold text-foreground">{m.value ?? "—"}</p>
                      <p className="text-xs text-muted-foreground mt-1">{m.label}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Brain className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p>No metrics yet — train the model or click Load Metrics</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
};
