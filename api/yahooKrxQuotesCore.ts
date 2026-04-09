/**
 * KRX 6자리 → Yahoo Finance 시세 (코스피·코스닥 동시 조회).
 * Vercel `api/quotes` 와 Vite 로컬 미들웨어에서 공통 사용.
 */

export interface KrxLiveQuote {
  ticker: string;
  price: number;
  changePercent: number;
}

interface YahooQuoteRow {
  symbol?: string;
  regularMarketPrice?: number;
  postMarketPrice?: number;
  preMarketPrice?: number;
  bid?: number;
  ask?: number;
  regularMarketPreviousClose?: number;
  regularMarketChangePercent?: number;
}

/** Yahoo가 서버 fetch 에서 가격 필드를 비우는 경우 → 호가 중간·전일 종가 등으로 보강 */
function pickPrice(row: YahooQuoteRow): number | null {
  const { regularMarketPrice, postMarketPrice, preMarketPrice, bid, ask, regularMarketPreviousClose } =
    row;

  const tryNum = (n: number | undefined): number | null =>
    n != null && Number.isFinite(n) && n > 0 ? n : null;

  const rmp = tryNum(regularMarketPrice);
  if (rmp != null) return rmp;

  const pmp = tryNum(postMarketPrice);
  if (pmp != null) return pmp;

  const pre = tryNum(preMarketPrice);
  if (pre != null) return pre;

  const b = tryNum(bid);
  const a = tryNum(ask);
  if (b != null && a != null) return (b + a) / 2;
  if (b != null) return b;
  if (a != null) return a;

  return tryNum(regularMarketPreviousClose);
}

/** Node/Vercel 기본 UA 는 Yahoo 가 403·빈 결과를 자주 반환 — 브라우저 UA 필수에 가깝게 */
const YAHOO_FETCH_HEADERS: HeadersInit = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept: "application/json,text/plain,*/*",
  "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
  Referer: "https://finance.yahoo.com/",
};

/** 쿼리 tickers= 문자열 → 6자리 종목코드 배열 */
export function parseTickersQuery(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean)
        .slice(0, 50)
        .map((t) => {
          const d = t.replace(/\D/g, "");
          if (d.length < 4) return "";
          const six = d.length <= 6 ? d.padStart(6, "0") : d.slice(-6);
          return /^\d{6}$/.test(six) ? six : "";
        })
        .filter((t) => t.length === 6),
    ),
  );
}

export async function getKrxQuotesFromYahoo(tickersInput: string[]): Promise<KrxLiveQuote[]> {
  const uniqTickers = Array.from(new Set(tickersInput)).filter((t) => /^\d{6}$/.test(t));
  if (uniqTickers.length === 0) return [];

  const allSymbols = uniqTickers.flatMap((t) => [`${t}.KS`, `${t}.KQ`]);

  const mapSymbolToTicker = (symbols: string[]) => {
    const m = new Map<string, string>();
    for (const sym of symbols) {
      const u = sym.toUpperCase();
      const base = u.replace(/\.(KS|KQ)$/, "");
      if (/^\d{6}$/.test(base)) m.set(u, base);
    }
    return m;
  };

  const rowToQuote = (row: YahooQuoteRow, symbolToTicker: Map<string, string>): KrxLiveQuote | null => {
    const symU = (row.symbol ?? "").toUpperCase();
    const ticker = symbolToTicker.get(symU);
    if (!ticker) return null;
    const price = pickPrice(row);
    if (price == null) return null;

    let changePercent = row.regularMarketChangePercent;
    if (changePercent == null || Number.isNaN(changePercent)) {
      const prev = row.regularMarketPreviousClose;
      changePercent = prev && prev > 0 ? ((price - prev) / prev) * 100 : 0;
    }

    return { ticker, price, changePercent: Number(changePercent.toFixed(2)) };
  };

  const fetchYahooBatch = async (symbols: string[]): Promise<YahooQuoteRow[]> => {
    if (symbols.length === 0) return [];
    const q = encodeURIComponent(symbols.join(","));
    const hosts = ["https://query1.finance.yahoo.com", "https://query2.finance.yahoo.com"] as const;

    for (const host of hosts) {
      const url = `${host}/v7/finance/quote?symbols=${q}`;
      const r = await fetch(url, { cache: "no-store", headers: YAHOO_FETCH_HEADERS });
      if (!r.ok) {
        console.warn("[yahooKrxQuotesCore] Yahoo HTTP", r.status, host);
        continue;
      }
      const json = (await r.json()) as {
        quoteResponse?: { result?: YahooQuoteRow[]; error?: unknown };
      };
      if (json.quoteResponse?.error) {
        console.warn("[yahooKrxQuotesCore] quoteResponse.error:", json.quoteResponse.error);
      }
      const result = Array.isArray(json.quoteResponse?.result) ? json.quoteResponse!.result! : [];
      if (result.length > 0) return result;
    }

    return [];
  };

  const MAX_SYMBOLS = 80;
  const symMap = mapSymbolToTicker(allSymbols);
  const chunks: string[][] = [];
  for (let i = 0; i < allSymbols.length; i += MAX_SYMBOLS) {
    chunks.push(allSymbols.slice(i, i + MAX_SYMBOLS));
  }

  const rows: YahooQuoteRow[] = [];
  for (const part of chunks) {
    const batch = await fetchYahooBatch(part);
    rows.push(...batch);
  }

  const byKs = new Map<string, KrxLiveQuote>();
  const byKq = new Map<string, KrxLiveQuote>();

  for (const row of rows) {
    const symU = (row.symbol ?? "").toUpperCase();
    const q = rowToQuote(row, symMap);
    if (!q) continue;
    if (symU.endsWith(".KS")) byKs.set(q.ticker, q);
    else if (symU.endsWith(".KQ")) byKq.set(q.ticker, q);
  }

  return uniqTickers
    .map((t) => byKs.get(t) ?? byKq.get(t))
    .filter((v): v is KrxLiveQuote => v != null);
}
