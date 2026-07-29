import PocketBase from "pocketbase";

const pbUrl = import.meta.env.PROD
  ? window.location.origin
  : import.meta.env.VITE_POCKETBASE_URL || "http://localhost:8090";

export const pb = new PocketBase(pbUrl);
