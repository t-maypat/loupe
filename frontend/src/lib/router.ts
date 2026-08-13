// Two-view hash router. `#/app` is the workspace; everything else (including
// in-page anchors like `#how`) stays on the landing page. Hash routing keeps the
// bundle a plain static asset - no server rewrite rules, no router dependency.

import { useEffect, useState } from "react";

export type Route = "landing" | "app";

function readRoute(): Route {
  return window.location.hash.replace(/^#\/?/, "").startsWith("app") ? "app" : "landing";
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(readRoute);

  useEffect(() => {
    const onHashChange = () => setRoute(readRoute());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  return route;
}
