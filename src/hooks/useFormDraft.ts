"use client";

import { useEffect, useRef, useCallback } from "react";

const STORAGE_KEY = "brandbrain_form_draft";

export function useFormDraft<T extends Record<string, unknown>>(
  formData: T | undefined,
  isDirty: boolean,
  enabled: boolean
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled || !formData) return;

    timerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(formData));
      } catch {
        // localStorage full or unavailable
      }
    }, 500);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [formData, enabled]);

  const checkDraft = useCallback((): T | null => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }, []);

  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  return { checkDraft, clearDraft };
}