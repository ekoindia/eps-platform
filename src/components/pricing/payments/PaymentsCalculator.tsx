import { MobileEstimateBar } from "@/components/pricing/MobileSummaryBar";
import { EarningsProductRow } from "@/components/pricing/payments/EarningsProductRow";
import { EarningsSummary } from "@/components/pricing/payments/EarningsSummary";
import { PaymentsPicker } from "@/components/pricing/payments/PaymentsPicker";
import { ADD_EARNINGS_EVENT } from "@/components/pricing/payments/PaymentsRateTable";
import {
  EARNINGS_PRODUCTS_MAP,
  MAX_TXNS,
  calcEarningsQuote,
  clampAvgAmount,
  type EarningsSelection,
} from "@/lib/data/payments-pricing";
import { formatINR } from "@/lib/utils";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

/** Clamps a parsed txn count to [0, MAX_TXNS]; falls back to the default */
const sanitizeTxns = (raw: number, fallback: number): number =>
  Number.isFinite(raw) && raw >= 0 ? Math.min(Math.round(raw), MAX_TXNS) : fallback;

/**
 * Parses the payments selection from the `pay` URL param.
 * Format: `pay=dmt:5000:2500,bbps-electricity:1000:1500` — each entry is
 * `productId:monthlyTxns:avgAmount` (avgAmount omitted for products that
 * don't need an amount). Unknown ids dropped, duplicates deduped, clamped.
 */
const parseSelectionFromParams = (
  params: URLSearchParams,
): EarningsSelection[] => {
  const selection: EarningsSelection[] = [];
  const seen = new Set<string>();

  for (const entry of (params.get("pay") ?? "").split(",")) {
    if (!entry) continue;
    const [productId, rawTxns, rawAmount] = entry.split(":");
    const product = EARNINGS_PRODUCTS_MAP[productId];
    if (!product || seen.has(productId)) continue;
    seen.add(productId);
    selection.push({
      productId,
      monthlyTxns: sanitizeTxns(Number(rawTxns), product.defaultMonthlyTxns),
      avgAmount: product.needsAmount
        ? clampAvgAmount(
            product,
            Number(rawAmount) || product.defaultAvgAmount || 0,
          )
        : undefined,
    });
  }

  return selection;
};

/** Serializes the selection back into the canonical `pay` param value */
const serializeSelection = (selection: EarningsSelection[]): string =>
  selection
    .map(({ productId, monthlyTxns, avgAmount }) =>
      avgAmount !== undefined
        ? `${productId}:${monthlyTxns}:${avgAmount}`
        : `${productId}:${monthlyTxns}`,
    )
    .join(",");

/**
 * Interactive EARNINGS calculator for Payments & BC products (DMT, AePS,
 * BBPS): grouped product picker, per-product txn-count + avg-amount
 * controls, and a live earnings summary (sticky sidebar on desktop, bottom
 * bar + drawer on mobile). Selection state is mirrored into the URL
 * (`?pay=…`) for shareable deep links — only the `pay` key is touched.
 */
export const PaymentsCalculator = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selection, setSelection] = useState<EarningsSelection[]>(() =>
    parseSelectionFromParams(searchParams),
  );
  const writeBackTimer = useRef<ReturnType<typeof setTimeout>>();

  const quote = useMemo(() => calcEarningsQuote(selection), [selection]);

  // Mirror state into the URL (debounced so slider drags don't spam history).
  // Foreign params (UTM / other calculators' keys) are preserved — only the
  // `pay` key is rewritten.
  useEffect(() => {
    writeBackTimer.current = setTimeout(() => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          params.delete("pay");
          if (selection.length > 0)
            params.set("pay", serializeSelection(selection));
          return params;
        },
        { replace: true, preventScrollReset: true },
      );
    }, 300);
    return () => clearTimeout(writeBackTimer.current);
  }, [selection, setSearchParams]);

  const addProduct = (productId: string) => {
    const product = EARNINGS_PRODUCTS_MAP[productId];
    if (!product) return;
    setSelection((prev) =>
      prev.some((entry) => entry.productId === productId)
        ? prev
        : [
            ...prev,
            {
              productId,
              monthlyTxns: product.defaultMonthlyTxns,
              avgAmount: product.needsAmount
                ? product.defaultAvgAmount
                : undefined,
            },
          ],
    );
  };

  const toggleProduct = (productId: string) => {
    const product = EARNINGS_PRODUCTS_MAP[productId];
    if (!product) return;
    setSelection((prev) =>
      prev.some((entry) => entry.productId === productId)
        ? prev.filter((entry) => entry.productId !== productId)
        : [
            ...prev,
            {
              productId,
              monthlyTxns: product.defaultMonthlyTxns,
              avgAmount: product.needsAmount
                ? product.defaultAvgAmount
                : undefined,
            },
          ],
    );
  };

  const updateLine = (
    productId: string,
    patch: Partial<Pick<EarningsSelection, "monthlyTxns" | "avgAmount">>,
  ) => {
    setSelection((prev) =>
      prev.map((entry) =>
        entry.productId === productId ? { ...entry, ...patch } : entry,
      ),
    );
  };

  // Rate-table "+" buttons hand off products via a custom window event
  useEffect(() => {
    const onAddProduct = (event: Event) => {
      const { productId } =
        (event as CustomEvent<{ productId: string }>).detail ?? {};
      if (productId) addProduct(productId);
    };
    window.addEventListener(ADD_EARNINGS_EVENT, onAddProduct);
    return () => window.removeEventListener(ADD_EARNINGS_EVENT, onAddProduct);
  }, []);

  const selectedIds = selection.map((entry) => entry.productId);

  return (
    <div className="grid lg:grid-cols-[1fr_380px] gap-8 items-start max-w-6xl mx-auto">
      {/* Left: picker + selected product rows */}
      <div className="min-w-0">
        <PaymentsPicker selectedIds={selectedIds} onToggle={toggleProduct} />

        {quote.lines.length > 0 && (
          <div className="flex flex-col gap-4 mt-6">
            {quote.lines.map((line) => (
              <EarningsProductRow
                key={line.product.id}
                line={line}
                onTxnsChange={(monthlyTxns) =>
                  updateLine(line.product.id, { monthlyTxns })
                }
                onAvgAmountChange={(avgAmount) =>
                  updateLine(line.product.id, { avgAmount })
                }
                onRemove={() => toggleProduct(line.product.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Right: sticky summary (desktop only) */}
      <aside className="hidden lg:block sticky top-24">
        <EarningsSummary quote={quote} onQuickAdd={addProduct} />
      </aside>

      {/* Mobile: sticky bottom bar + drawer */}
      <MobileEstimateBar
        label={
          quote.lines.length === 0
            ? "No products selected"
            : `${quote.lines.length} product${quote.lines.length > 1 ? "s" : ""} selected`
        }
        headline={`+${formatINR(quote.total, 0)}`}
        drawerTitle="Your estimated monthly earnings"
      >
        <EarningsSummary quote={quote} onQuickAdd={addProduct} />
      </MobileEstimateBar>
    </div>
  );
};
