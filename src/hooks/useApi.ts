import { useAuth0 } from "@auth0/auth0-react";
import { useMemo } from "react";
import { createApiClient } from "../lib/api";

export function useApi() {
  const { getAccessTokenSilently } = useAuth0();
  return useMemo(() => createApiClient(() => getAccessTokenSilently()), [getAccessTokenSilently]);
}
