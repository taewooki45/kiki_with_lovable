import type { VercelRequest, VercelResponse } from "@vercel/node";

interface YahooQuote {
  symbol: string;
  regularMarketPrice?: number;
  regularMarketPreviousClose?: number;
  regularMarketChangePercent?: number;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const raw = String(req.query.tickers ?? "");
  const tickers = raw
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean)
    .slice(0, 50);
  if (tickers.length === 0) {
    res.status(400).json({ error: "tickers query required" });
    return;
  }

  const uniqTickers = Array.from(new Set(tickers));

  const ksSymbols = uniqTickers
    .map((t) => (/^\d{6}$/.test(t) ? `${t}.KS` : null))
    .filter((v): v is string => v != null);

  if (ksSymbols.length === 0) {
    res.status(200).json({ quotes: [] });
    return;
  }

  const mapSymbolToTicker = (symbols: string[]) => {
    const m = new Map<string, string>();
    for (const sym of symbols) {
      const base = sym.replace(/\.(KS|KQ)$/i, "");
      if (/^\d{6}$/.test(base)) m.set(sym, base);
    }
    return m;
  };

  const rowToQuote = (
    row: YahooQuote,
    symbolToTicker: Map<string, string>,
  ): { ticker: string; price: number; changePercent: number } | null => {
    const ticker = row.symbol ? symbolToTicker.get(row.symbol) : undefined;
    if (!ticker) return null;
    const price = row.regularMarketPrice;
    if (price == null || Number.isNaN(price)) return null;

    let changePercent = row.regularMarketChangePercent;
    if (changePercent == null || Number.isNaN(changePercent)) {
      const prev = row.regularMarketPreviousClose;
      changePercent = prev && prev > 0 ? ((price - prev) / prev) * 100 : 0;
    }

    return { ticker, price, changePercent: Number(changePercent.toFixed(2)) };
  };

  const fetchYahooBatch = async (symbols: string[]) => {
    if (symbols.length === 0) return [] as YahooQuote[];
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols.join(","))}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`Yahoo ${r.status}`);
    const json = (await r.json()) as { quoteResponse?: { result?: YahooQuote[] } };
    return Array.isArray(json.quoteResponse?.result) ? json.quoteResponse!.result! : [];
  };

  try {
    const symKs = mapSymbolToTicker(ksSymbols);
    let rows = await fetchYahooBatch(ksSymbols);
    let quotes = rows
      .map((row) => rowToQuote(row, symKs))
      .filter((v): v is { ticker: string; price: number; changePercent: number } => v != null);

    const seen = new Set(quotes.map((q) => q.ticker));
    const missingKq = uniqTickers.filter((t) => /^\d{6}$/.test(t) && !seen.has(t));
    if (missingKq.length > 0) {
      const kqSyms = missingKq.map((t) => `${t}.KQ`);
      const symKq = mapSymbolToTicker(kqSyms);
      rows = await fetchYahooBatch(kqSyms);
      const extra = rows
        .map((row) => rowToQuote(row, symKq))
        .filter((v): v is { ticker: string; price: number; changePercent: number } => v != null);
      quotes = [...quotes, ...extra];
    }

    /** 동일 종목이 KS/KQ 중복 시 첫 값만 유지 */
    const byTicker = new Map<string, (typeof quotes)[0]>();
    for (const q of quotes) {
      if (!byTicker.has(q.ticker)) byTicker.set(q.ticker, q);
    }

    res.status(200).json({ quotes: Array.from(byTicker.values()) });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    res.status(500).json({ error: message });
  }
}
