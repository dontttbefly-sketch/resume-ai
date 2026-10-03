/* 让出场动画播完再卸载：open 变 false 后继续挂载 exitMs，期间 state = "closed" */

import { useEffect, useState } from "react";

export function usePresence(open: boolean, exitMs = 180): { mounted: boolean; state: "open" | "closed" } {
  const [lingering, setLingering] = useState(false);

  useEffect(() => {
    if (open) {
      setLingering(true);
      return;
    }
    const t = window.setTimeout(() => setLingering(false), exitMs);
    return () => window.clearTimeout(t);
  }, [open, exitMs]);

  return { mounted: open || lingering, state: open ? "open" : "closed" };
}
