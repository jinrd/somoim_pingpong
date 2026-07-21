import PocketBase from "pocketbase";

// 모든 API 요청에서 공유하는 PocketBase 클라이언트입니다.
const pbUrl = import.meta.env.VITE_POCKETBASE_URL || "http://localhost:8090";
export const pb = new PocketBase(pbUrl);
