import { Map, Footprints, MessageCircle, User } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";

interface NavItem {
  path: string;
  label: string;
  icon: typeof Map;
}

const NAV_ITEMS: NavItem[] = [
  { path: "/", label: "지도", icon: Map },
  { path: "/walk", label: "걷기", icon: Footprints },
  { path: "/chat", label: "챗봇", icon: MessageCircle },
  { path: "/profile", label: "내 정보", icon: User },
];

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav
      className="fixed bottom-0 left-1/2 z-[1300] w-full max-w-lg -translate-x-1/2 border-t border-border bg-card/95 shadow-sheet backdrop-blur-md supports-[backdrop-filter]:bg-card/80"
      data-testid="bottom-nav"
      aria-label="메인 내비게이션"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="mx-auto flex max-w-lg items-center justify-around px-4 py-2">
        {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
          const isActive = location.pathname === path;
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-1 rounded-xl px-3 py-1 transition-colors ${
                isActive
                  ? "text-primary"
                  : "text-muted-foreground"
              }`}
              aria-label={label}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className="h-5 w-5" strokeWidth={isActive ? 2.5 : 2} />
              <span className={`text-[10px] ${isActive ? "font-bold" : "font-medium"}`}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
