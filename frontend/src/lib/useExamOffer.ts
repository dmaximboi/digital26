import { useEffect, useState } from "react";
import { apiFetch } from "./authApi";

export function useExamOffer(enabled: boolean): boolean {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setOpen(false);
      return;
    }
    let cancel = false;
    apiFetch<{ exams: unknown[] }>("/api/student/exams")
      .then((data) => {
        if (!cancel) setOpen(data.exams.length > 0);
      })
      .catch(() => {
        if (!cancel) setOpen(false);
      });
    return () => {
      cancel = true;
    };
  }, [enabled]);

  return open;
}
