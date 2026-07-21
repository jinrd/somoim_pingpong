import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    // 상위 폴더에 React 기반 패키지가 설치되어 있어도 이 앱의 React 한 벌만 사용합니다.
    dedupe: ["react", "react-dom"],
  },
});
