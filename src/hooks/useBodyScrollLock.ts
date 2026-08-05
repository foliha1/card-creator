import { useEffect } from "react";

/** Applies the fixed-viewport body lock while the calling route is mounted. */
export function useBodyScrollLock() {
  useEffect(() => {
    document.body.classList.add("ww-locked");
    return () => {
      document.body.classList.remove("ww-locked");
    };
  }, []);
}

export default useBodyScrollLock;
