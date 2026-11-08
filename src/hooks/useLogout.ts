import { useAuth } from "@/hooks/useAuth";

/**
 * Logs out on this device (never blocked by the server), then loads the log
 * in page fresh so no in-memory session can linger.
 */
export function useLogout() {
  const { signOut } = useAuth();
  return async () => {
    try {
      await signOut();
    } finally {
      window.location.replace("/login");
    }
  };
}
