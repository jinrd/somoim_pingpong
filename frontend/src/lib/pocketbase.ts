import PocketBase from "pocketbase";

const pbUrl =
  import.meta.env.VITE_POCKETBASE_URL ||
  (import.meta.env.PROD ? window.location.origin : "http://localhost:8090");

export const pb = new PocketBase(pbUrl);
