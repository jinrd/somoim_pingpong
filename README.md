# 탁꾸러기 메이트

탁구 모임의 회원, 회차, 참가 신청, 팀 편성, 대진, 경기 진행과 결과를 관리하는 모바일 중심 웹 서비스입니다.

운영진은 회차 준비부터 경기 종료까지 전체 과정을 관리할 수 있고, 참가자는 공개 링크에서 참가 여부를 선택하고 자신의 경기와 실시간 결과를 확인할 수 있습니다.

자세한 운영 정책 및 사용 방법은 [OPERATING_GUIDE.md](file:///Users/jinwon/Workspace/JavaScript_TypeScript/somoim_pingpong/OPERATING_GUIDE.md)를 참고하세요.

## 주요 기능

- 회원 등록, 수정, 활동 상태 및 부수 관리
- 회차 생성, 참가 신청 마감 및 공개 참석 링크 발급
- 참가자의 게임 참가·미참가 상태 관리
- 팀 리그와 개인 단식 풀리그 설정
- 팀 자동 편성 및 운영진 편성 수정
- 대진표 생성과 개인전 테이블 자동 배정
- 참가자 라인업 작성과 경기 결과 입력
- 운영진 경기 모니터링, 결과 대리 입력 및 취소
- 실시간 경기 현황과 순위 조회
- 공식 단식 결과 기반 승급·강등 후보 관리
- 모바일 운영진·참가자 화면 지원

## 기술 구성

### 프런트엔드

- React
- TypeScript
- Vite
- React Router
- Zustand
- PocketBase JavaScript SDK

### 백엔드

- PocketBase
- PocketBase JavaScript hooks
- PocketBase migrations
- SQLite

### 운영 환경

- Docker Compose
- Nginx
- 공용 Caddy 리버스 프록시
- Cloudflare DNS

## 프로젝트 구조

```text
.
├── backend/
│   ├── pb_hooks/          # API, 검증 및 경기 처리 로직
│   ├── pb_migrations/     # PocketBase 컬렉션 스키마
│   ├── Dockerfile         # 개발용 PocketBase 이미지
│   └── Dockerfile.prod    # 운영용 PocketBase 이미지
├── frontend/
│   ├── src/
│   │   ├── components/    # 공통 UI
│   │   ├── features/      # 기능 단위 화면과 로직
│   │   ├── pages/         # 관리자·공개 페이지
│   │   ├── lib/           # PocketBase 연결
│   │   └── store/         # 인증 상태
│   └── Dockerfile
├── deploy/
│   └── .env.example       # 운영 환경변수 예시
└── compose.prod.yml       # 운영용 서비스 구성
```

## 로컬 개발

### 준비 사항

- Docker 및 Docker Compose
- Node.js 22 이상
- pnpm

### 1. 백엔드 환경변수

```bash
cd backend
cp .env.example .env
```

`backend/.env`의 `PB_ENCRYPTION_KEY`를 예측하기 어려운 값으로 변경합니다.

```bash
openssl rand -hex 16
```

암호화 키를 변경하거나 분실하면 기존에 암호화해 저장한 정보를 정상적으로 복호화할 수 없습니다.

### 2. PocketBase 실행

```bash
cd backend
docker compose up -d --build
```

- API: `http://localhost:8090`
- 관리자 화면: `http://localhost:8090/_/`

### 3. 프런트엔드 실행

```bash
cd frontend
pnpm install
pnpm run dev
```

기본 개발 주소는 `http://localhost:5173`입니다.

## 코드 검사

프런트엔드 폴더에서 실행합니다.

```bash
pnpm run lint
pnpm run test
pnpm run build
```

## 운영 배포

운영 서버의 권장 경로는 다음과 같습니다.

```text
/srv/apps/somoim_pingpong
/srv/data/somoim-pingpong/pocketbase
```

### 1. 환경변수 생성

```bash
cp deploy/.env.example deploy/.env
vi deploy/.env
```

필수 값:

- `PB_ENCRYPTION_KEY`: PocketBase 암호화 키
- `PB_DATA_PATH`: PocketBase 데이터 저장 경로

`deploy/.env`는 Git에 커밋하지 않습니다.

### 2. 공용 Docker 네트워크

이 프로젝트는 여러 프로젝트가 하나의 Caddy를 공유하도록 `caddy_proxy` 외부 네트워크를 사용합니다.

최초 한 번만 생성합니다.

```bash
docker network create caddy_proxy
```

### 3. 서비스 실행

```bash
docker compose --env-file deploy/.env -f compose.prod.yml up -d --build
```

PocketBase의 호스트 포트는 보안을 위해 `127.0.0.1:8090`에만 연결됩니다. 프런트엔드는 호스트 포트를 직접 공개하지 않고 공용 Caddy 네트워크를 통해 접근합니다.

### 4. 공용 Caddy 연결

공용 Caddy는 이 프로젝트와 별도의 디렉터리 및 Compose 구성으로 계속 실행합니다. Caddy 설정에서는 다음 서비스 별칭으로 연결합니다.

```caddy
pingpong.example.com {
    route {
        @pocketbaseAdmin path /_ /_/*
        respond @pocketbaseAdmin "Not Found" 404

        handle /api/* {
            reverse_proxy somoim-pingpong-pocketbase:8090
        }

        handle {
            reverse_proxy somoim-pingpong-frontend:80
        }
    }
}
```

도메인별 프로젝트 구성 예:

```text
a.example.com → 프로젝트 A
b.example.com → 프로젝트 B
```

프로젝트 코드만 수정한 경우 공용 Caddy를 재시작할 필요가 없습니다. 도메인이나 프록시 연결을 변경할 때만 Caddy 설정을 다시 적용합니다.

## 운영 서버 업데이트

### 프런트엔드만 변경된 경우

```bash
cd /srv/apps/somoim_pingpong
git pull --ff-only origin main
docker compose --env-file deploy/.env -f compose.prod.yml up -d --build frontend
```

### 백엔드 hooks 또는 migration이 변경된 경우

```bash
cd /srv/apps/somoim_pingpong
git pull --ff-only origin main
docker compose --env-file deploy/.env -f compose.prod.yml up -d --build pocketbase
```

### 전체 구성이 변경된 경우

```bash
cd /srv/apps/somoim_pingpong
git pull --ff-only origin main
docker compose --env-file deploy/.env -f compose.prod.yml up -d --build
```

## 상태와 로그 확인

```bash
docker compose --env-file deploy/.env -f compose.prod.yml ps
docker compose --env-file deploy/.env -f compose.prod.yml logs --tail=200
```

특정 서비스만 확인할 수도 있습니다.

```bash
docker compose --env-file deploy/.env -f compose.prod.yml logs --tail=200 frontend
docker compose --env-file deploy/.env -f compose.prod.yml logs --tail=200 pocketbase
```

## 데이터 백업

운영 데이터는 `PB_DATA_PATH`에 저장됩니다. 이 디렉터리와 `PB_ENCRYPTION_KEY`를 함께 안전하게 보관해야 합니다.

백업 전에 데이터 일관성을 위해 PocketBase 컨테이너를 잠시 중지하거나, 검증된 SQLite 백업 방식을 사용해야 합니다. 복구 절차는 실제 백업본으로 별도 검증한 뒤 운영에 사용합니다.

## 보안 주의사항

- `backend/.env`와 `deploy/.env`를 Git에 커밋하지 않습니다.
- PocketBase 관리자 화면 `/_/`는 공용 Caddy에서 차단합니다.
- PocketBase의 `8090` 포트를 인터넷에 직접 공개하지 않습니다.
- 운영 서버 SSH는 Tailscale과 키 인증을 사용합니다.
- Cloudflare SSL/TLS 모드는 `전체(엄격)`을 사용합니다.
- 회원 전화번호 암호화 키는 데이터 백업과 별도로 안전하게 보관합니다.

## 라이선스

현재 별도의 오픈소스 라이선스를 지정하지 않았습니다.
