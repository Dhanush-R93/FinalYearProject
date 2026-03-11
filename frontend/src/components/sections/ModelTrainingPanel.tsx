import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { agriApi, type MetricsResponse } from "@/services/api";
import { Brain, Play, CheckCircle, AlertCircle, Activity } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Status = "idle" | "training" | "success" | "error";

export const ModelTrainingPanel = () => {
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState(0);
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);
  const [epochsRun, setEpochsRun] = useState(0);
  const [error, setError] = useState("");
  const { toast } = useToast();

  const handleTrain = async () => {
    setStatus("training");
    setProgress(10);
    setError("");
    setMetrics(null);

    // Simulate progress while waiting for training
    const interval = setInterval(() => {
      setProgress((p) => Math.min(p + Math.random() * 8, 90));
    }, 800);

    try {
      const res = await agriApi.trainModel({ epochs: 50 });
      clearInterval(interval);
      setProgress(100);
      setEpochsRun(res.epochs_run);
      setMetrics(res.metrics as unknown as MetricsResponse);
      setStatus("success");
      toast({ title: "Training Complete", description: `Model trained for ${res.epochs_run} epochs.` });
    } catch (e: any) {
      clearInterval(interval);
      setProgress(0);
      setStatus("error");
      setError(e.message || "Training failed");
      toast({ title: "Training Failed", description: e.message, variant: "destructive" });
    }
  };

  const fetchMetrics = async () => {
    try {
      const m = await agriApi.getMetrics();
      setMetrics(m);
    } catch {
      toast({ title: "No metrics available", description: "Train the model first.", variant: "destructive" });
    }
  };

  const statusConfig = {
    idle: { icon: Brain, label: "Ready", color: "text-muted-foreground" },
    training: { icon: Activity, label: "Training…", color: "text-primary animate-pulse" },
    success: { icon: CheckCircle, label: "Complete", color: "text-green-500" },
    error: { icon: AlertCircle, label: "Failed", color: "text-destructive" },
  };

  const S = statusConfig[status];

  return (
    <section id="model-training" className="py-16 px-4 md:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-bold text-foreground">LSTM Model Training</h2>
          <p className="text-muted-foreground">Train and evaluate the price prediction model</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Training Control */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Brain className="h-5 w-5 text-primary" />
                Training Control
              </CardTitle>
              <CardDescription>Start model training on historical data</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <S.icon className={`h-5 w-5 ${S.color}`} />
                <span className="text-sm font-medium text-foreground">{S.label}</span>
                {epochsRun > 0 && status === "success" && (
                  <Badge variant="secondary" className="ml-auto">{epochsRun} epochs</Badge>
                )}
              </div>

              {status === "training" && (
                <Progress value={progress} className="h-2" />
              )}

              {error && <p className="text-sm text-destructive">{error}</p>}

              <div className="flex gap-2">
                <Button
                  onClick={handleTrain}
                  disabled={status === "training"}
                  className="flex-1"
                >
                  <Play className="h-4 w-4 mr-1" />
                  {status === "training" ? "Training…" : "Train Model"}
                </Button>
                <Button variant="outline" onClick={fetchMetrics} disabled={status === "training"}>
                  Load Metrics
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Metrics Display */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Activity className="h-5 w-5 text-primary" />
                Evaluation Metrics
              </CardTitle>
              <CardDescription>Model performance on test data</CardDescription>
            </CardHeader>
            <CardContent>
              {metrics ? (
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: "MAE", value: metrics.mae, unit: "₹" },
                    { label: "RMSE", value: metrics.rmse, unit: "₹" },
                    { label: "MAPE", value: metrics.mape, unit: "%" },
                    { label: "R² Score", value: metrics.r2_score, unit: "" },
                  ].map((m) => (
                    <div key={m.label} className="rounded-lg border bg-muted/50 p-3 text-center">
                      <p className="text-xs text-muted-foreground">{m.label}</p>
                      <p className="text-xl font-bold text-foreground">
                        {typeof m.value === "number" ? m.value.toFixed(4) : "—"}
                        <span className="text-xs font-normal text-muted-foreground ml-0.5">{m.unit}</span>
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex h-32 items-center justify-center text-muted-foreground text-sm">
                  No metrics yet — train the model or load existing metrics.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
};
