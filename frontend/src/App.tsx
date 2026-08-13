import { useEffect } from "react";
import { Landing } from "./pages/Landing";
import { Workspace } from "./pages/Workspace";
import { useRoute } from "./lib/router";

export default function App() {
  const route = useRoute();

  // Entering or leaving the app is a page change, not an in-page anchor jump.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route]);

  return route === "app" ? <Workspace /> : <Landing />;
}
