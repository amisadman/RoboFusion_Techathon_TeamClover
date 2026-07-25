"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";

// Client-side route guard. Redirects to /login once the session check
// settles with no session. `ready` is true only when there is a session to
// render against -- callers should render a loading skeleton until then.
export function useRequireSession() {
  const { data: session, isPending } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!isPending && !session) {
      router.replace("/login");
    }
  }, [isPending, session, router]);

  return { session, isPending, ready: !isPending && !!session };
}
