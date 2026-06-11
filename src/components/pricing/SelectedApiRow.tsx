import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  MAX_VOLUME,
  calcLineCost,
  displayName,
  getRateForVolume,
  type PricedApi,
} from "@/lib/data/api-pricing";
import { formatINR, formatINRRate, formatIndianCompact } from "@/lib/utils";
import { X } from "lucide-react";
import { useId } from "react";

/** Log-spaced volume steps for the slider (direct input allows any value) */
const VOLUME_STEPS = [
  0, 100, 500, 1_000, 2_500, 5_000, 10_000, 25_000, 50_000, 100_000, 250_000,
  500_000, 1_000_000,
];

/** Slider tick labels rendered under the track */
const TICK_LABELS = [0, 1_000, 10_000, 100_000, 1_000_000];

/** Index of the step nearest to a volume (for positioning the slider thumb) */
const nearestStepIndex = (volume: number): number => {
  let best = 0;
  for (let i = 1; i < VOLUME_STEPS.length; i++) {
    if (
      Math.abs(VOLUME_STEPS[i] - volume) < Math.abs(VOLUME_STEPS[best] - volume)
    ) {
      best = i;
    }
  }
  return best;
};

interface SelectedApiRowProps {
  api: PricedApi;
  volume: number;
  onVolumeChange: (volume: number) => void;
  onRemove: () => void;
}

/**
 * One selected API in the calculator: name + rate, a log-stepped volume
 * slider with a free-form numeric input, and the live monthly line total.
 */
export const SelectedApiRow = ({
  api,
  volume,
  onVolumeChange,
  onRemove,
}: SelectedApiRowProps) => {
  const inputId = useId();
  const rate = getRateForVolume(api, volume);
  const lineCost = calcLineCost(api, volume);

  const handleInputChange = (raw: string) => {
    const parsed = Number(raw.replace(/[^\d]/g, ""));
    onVolumeChange(
      Math.min(Number.isFinite(parsed) ? parsed : 0, MAX_VOLUME),
    );
  };

  return (
    <div className="rounded-2xl border border-border/60 bg-card shadow-card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h4 className="font-semibold text-foreground leading-tight">
            {displayName(api)}
          </h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            {formatINRRate(rate)} {api.unitLabel ?? "per verification"}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="font-bold text-foreground tabular-nums whitespace-nowrap">
            {formatINR(lineCost, 0)}
            <span className="text-xs font-normal text-muted-foreground">
              /mo
            </span>
          </span>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Remove ${api.name}`}
            className="h-7 w-7 -mr-1 text-muted-foreground hover:text-destructive"
            onClick={onRemove}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
        <div className="flex-1 pt-1">
          <Slider
            value={[nearestStepIndex(volume)]}
            min={0}
            max={VOLUME_STEPS.length - 1}
            step={1}
            onValueChange={([stepIndex]) =>
              onVolumeChange(VOLUME_STEPS[stepIndex])
            }
            aria-label={`${api.name} monthly volume`}
            className="[&_[role=slider]]:border-eko-gold [&_.bg-primary]:bg-eko-gold"
          />
          <div className="flex justify-between mt-1.5 text-[10px] text-muted-foreground/70 tabular-nums">
            {TICK_LABELS.map((tick) => (
              <span key={tick}>{formatIndianCompact(tick)}</span>
            ))}
          </div>
        </div>
        <div className="shrink-0 sm:w-36">
          <label htmlFor={inputId} className="sr-only">
            {api.name} monthly volume
          </label>
          <div className="relative">
            <Input
              id={inputId}
              inputMode="numeric"
              value={volume.toLocaleString("en-IN")}
              onChange={(e) => handleInputChange(e.target.value)}
              className="pr-12 text-right tabular-nums font-medium"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
              /mo
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
