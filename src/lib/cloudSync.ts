import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  getStoreSnapshot,
  subscribeStore,
  applyRemoteStore,
  isApplyingRemote,
} from "./store";

/**
 * Cloud sync: keeps the entire gestionale state in a single per-user JSON row
 * in `user_state`. Hydrates on login, pushes local changes debounced, and
 * subscribes to realtime updates so other devices receive changes live.
 */
export function useCloudSync(userId: string | null) {
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );
  const versionRef = useRef<number>(0);
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!userId) {
      setStatus("idle");
      return;
    }
    let cancelled = false;
    setStatus("loading");

    (async () => {
      try {
        const { data, error } = await supabase
          .from("user_state")
          .select("data, version, updated_at")
          .eq("user_id", userId)
          .maybeSingle();
        if (error) throw error;

        if (!data) {
          // First device: upload current local state as the seed.
          const local = getStoreSnapshot();
          const { data: ins, error: insErr } = await supabase
            .from("user_state")
            .insert({ user_id: userId, data: local as any, version: 1 })
            .select("version")
            .single();
          if (insErr) throw insErr;
          versionRef.current = ins?.version ?? 1;
        } else {
          versionRef.current = Number(data.version ?? 1);
          // Hydrate local from cloud.
          if (data.data && typeof data.data === "object") {
            applyRemoteStore(data.data as any);
          }
        }
        if (cancelled) return;
        setStatus("ready");
      } catch (e) {
        console.error("[cloudSync] hydrate failed", e);
        if (!cancelled) setStatus("error");
      }
    })();

    // Push local changes (debounced).
    const unsub = subscribeStore(() => {
      if (isApplyingRemote()) return;
      if (pushTimer.current) clearTimeout(pushTimer.current);
      pushTimer.current = setTimeout(async () => {
        try {
          const snapshot = getStoreSnapshot();
          const nextVersion = versionRef.current + 1;
          const { error } = await supabase
            .from("user_state")
            .update({
              data: snapshot as any,
              version: nextVersion,
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", userId);
          if (error) throw error;
          versionRef.current = nextVersion;
        } catch (e) {
          console.error("[cloudSync] push failed", e);
        }
      }, 800);
    });

    // Realtime: receive updates from other devices.
    const channel = supabase
      .channel(`user_state:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "user_state",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as { data: any; version: number };
          if (!row) return;
          // Skip echoes of our own writes.
          if (Number(row.version) <= versionRef.current) return;
          versionRef.current = Number(row.version);
          if (row.data && typeof row.data === "object") {
            applyRemoteStore(row.data);
          }
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      unsub();
      if (pushTimer.current) clearTimeout(pushTimer.current);
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return status;
}
