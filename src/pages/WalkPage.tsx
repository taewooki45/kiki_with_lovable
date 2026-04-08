import { Footprints, Target, Coins, TrendingUp, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import BottomNav from "@/components/BottomNav";
import { MOCK_USER_WALK, MOCK_HOLDINGS } from "@/data/mockStocks";

const WalkPage = () => {
  const walk = MOCK_USER_WALK;
  const progress = Math.min((walk.todaySteps / walk.goalSteps) * 100, 100);

  return (
    <div
      className="mx-auto min-h-[100dvh] w-full max-w-lg bg-background pb-24"
      data-testid="walk-screen"
    >
      {/* Header */}
      <div className="bg-card px-5 pb-6 pt-[calc(env(safe-area-inset-top,0px)+20px)] sm:rounded-b-2xl sm:shadow-sm">
        <h1 className="mb-6 font-display text-xl font-bold tracking-tight text-foreground">오늘의 걷기</h1>

        {/* Circular progress */}
        <div className="flex flex-col items-center">
          <div className="relative flex h-40 w-40 items-center justify-center">
            <svg className="absolute h-full w-full -rotate-90" viewBox="0 0 160 160">
              <circle cx="80" cy="80" r="70" fill="none" stroke="hsl(var(--secondary))" strokeWidth="10" />
              <circle
                cx="80" cy="80" r="70"
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 70}`}
                strokeDashoffset={`${2 * Math.PI * 70 * (1 - progress / 100)}`}
                className="transition-all duration-700"
              />
            </svg>
            <div className="text-center">
              <Footprints className="mx-auto mb-1 h-6 w-6 text-primary" />
              <p className="text-3xl font-bold text-foreground">{walk.todaySteps.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">/ {walk.goalSteps.toLocaleString()} 걸음</p>
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="mt-6 flex justify-around">
          <div className="text-center">
            <div className="mx-auto mb-1 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Target className="h-5 w-5 text-primary" />
            </div>
            <p className="text-lg font-bold text-foreground">{Math.round(progress)}%</p>
            <p className="text-xs text-muted-foreground">달성률</p>
          </div>
          <div className="text-center">
            <div className="mx-auto mb-1 flex h-10 w-10 items-center justify-center rounded-xl bg-cash/10">
              <Coins className="h-5 w-5 text-cash" />
            </div>
            <p className="text-lg font-bold text-foreground">{walk.cashBalance.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">캐시 (원)</p>
          </div>
          <div className="text-center">
            <div className="mx-auto mb-1 flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10">
              <Award className="h-5 w-5 text-accent" />
            </div>
            <p className="text-lg font-bold text-foreground">{Math.floor(walk.todaySteps * walk.cashPerStep)}</p>
            <p className="text-xs text-muted-foreground">오늘 적립</p>
          </div>
        </div>
      </div>

      {/* Holdings */}
      <div className="px-4 pb-2 pt-2">
        <h2 className="mb-3 flex items-center gap-2 font-display text-base font-bold text-foreground">
          <TrendingUp className="h-4 w-4 text-primary" />
          보유 종목
        </h2>
        <div className="space-y-3">
          {MOCK_HOLDINGS.map((h) => {
            const pnl = (h.currentPrice - h.avgPrice) * h.shares;
            const pnlPercent = ((h.currentPrice - h.avgPrice) / h.avgPrice) * 100;
            const isUp = pnl >= 0;
            return (
              <div
                key={h.ticker}
                className="flex items-center justify-between rounded-xl border border-border/60 bg-card p-4 shadow-sm"
              >
                <div>
                  <p className="text-sm font-semibold text-foreground">{h.name}</p>
                  <p className="text-xs text-muted-foreground">{h.shares}주 · 평균 {h.avgPrice.toLocaleString()}원</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-foreground">{(h.currentPrice * h.shares).toLocaleString()}원</p>
                  <p className={`text-xs font-medium ${isUp ? "text-destructive" : "text-accent"}`}>
                    {isUp ? "+" : ""}{pnl.toLocaleString()}원 ({isUp ? "+" : ""}{pnlPercent.toFixed(1)}%)
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Goal setting */}
        <Button className="mt-6 w-full h-12 rounded-xl font-bold" aria-label="걸음 수 목표 변경">
          <Target className="mr-2 h-5 w-5" />
          걸음 목표 변경하기
        </Button>
      </div>

      <BottomNav />
    </div>
  );
};

export default WalkPage;
