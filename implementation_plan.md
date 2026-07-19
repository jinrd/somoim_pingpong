# Somoim PingPong Manager 개발 계획서

탁구 모임 운영진이 회원, 회차, 팀, 대진표, 경기 결과와 부수 승강을 관리하고 참가자는 회차별 공개 링크로 경기 현황을 조회하는 모바일 우선 웹 애플리케이션의 구현 계획입니다.

홈 서버의 제한된 RAM을 고려해 Supabase self-hosting 대신 **PocketBase**를 사용합니다. 원 요구사항에서 Supabase migration, PostgreSQL RLS, SQL 함수로 표현된 부분은 각각 **PocketBase JavaScript migration, API Rules, 서버 전용 Go custom endpoint/hook**으로 대체합니다.

## 1. 확정 기술 구조

- 프론트엔드: React, Vite, TypeScript strict, React Router, Zustand, CSS Modules
- 백엔드/DB: PocketBase, SQLite, PocketBase Auth, Realtime(SSE)
- 서버 확장: PocketBase Go custom endpoint 및 record hook
- 테스트: Vitest, Testing Library, Playwright
- 배포: Docker Compose, DuckDNS, Nginx Proxy Manager, HTTPS
- 백업: `pb_data` 정기 스냅샷과 운영진용 JSON/CSV 내보내기

PocketBase는 단일 프로세스와 SQLite를 사용하므로 소규모 모임 트래픽과 홈 서버에 적합합니다. 다만 API Rules만으로 복잡한 공개 토큰 검증, 다중 레코드 원자 처리, 승강 재계산을 처리하지 않고 서버 전용 endpoint/hook을 사용합니다.

## 2. 핵심 위험과 대응

### 2.1 공개 링크와 데이터 노출

**위험:** 익명 사용자가 컬렉션 목록 API의 필터를 제거하거나 토큰을 조작해 다른 회차, 전체 회원 목록, 실명 또는 관리자 메모를 조회할 수 있습니다.

**대응:**

- 공개 사용자의 주요 컬렉션 직접 list/view 접근을 차단합니다.
- `GET /api/somoim/public/events/{token}` 공개 전용 endpoint만 허용합니다.
- `PATCH /api/somoim/public/participants/{participationToken}`은 해당 참가자의 게임 참가 상태 변경에만 사용하고 다른 필드는 받지 않습니다.
- 서버에서 토큰, `public_access_enabled`, `public_expires_at`, 회차 상태를 검증합니다.
- 응답은 공개 DTO로 구성하고 닉네임 등 허용된 필드만 반환합니다.
- 공개 토큰은 32바이트 이상의 암호학적 난수로 생성하고 DB에는 해시를 저장합니다.
- 토큰 비교는 서버에서 수행하며 재발급 시 기존 토큰을 즉시 폐기합니다.
- 잘못된 토큰과 만료된 토큰 응답에는 개인정보를 포함하지 않습니다.
- Realtime 구독도 공개 endpoint가 발급한 회차 범위의 단기 구독 권한 또는 제한된 공개 projection만 사용합니다. 구현 난도가 높으면 MVP에서는 SSE 실패 시 주기적 재조회로 대체합니다.
- 토큰 검증 실패에 rate limit과 보안 로그를 적용합니다.

### 2.2 네트워크 불안정과 Realtime

**위험:** 체육관 모바일 네트워크 또는 reverse proxy timeout으로 SSE 연결과 결과 저장이 실패할 수 있습니다.

**대응:**

- 연결 상태, 마지막 동기화 시간, 수동 새로고침을 표시합니다.
- 재연결 시 전체 최신 상태를 다시 조회하고 이벤트 ID로 중복 적용을 막습니다.
- 쓰기 요청에는 idempotency key와 예상 `version`을 포함합니다.
- MVP에서는 영구 오프라인 큐 대신 저장 실패 표시, 명시적 재시도, 서버 상태 재조회를 제공합니다.
- 낙관적 업데이트는 즉시 되돌릴 수 있는 단순 결과 입력에만 적용합니다.

### 2.3 동시 수정과 데이터 일관성

**위험:** 여러 운영진이 같은 경기 결과를 동시에 수정하거나 경기·순위·승강 후보 중 일부만 저장될 수 있습니다.

**대응:**

- 변경 가능한 경기 레코드에 `version`을 두고 서버에서 expected version을 검사합니다.
- 버전 불일치는 `409 Conflict`로 응답하고 최신값 비교 UI를 제공합니다.
- 결과 저장/수정/취소, 감사 로그 기록, 관련 후보 갱신은 하나의 서버 트랜잭션으로 처리합니다.
- 순위와 승강 카운터는 수정 가능한 누적 숫자를 진실의 원천으로 삼지 않고 유효 경기 원장에서 재계산합니다.

### 2.4 팀 편성의 수학적 한계

**위험:** 인원수와 부수 분포에 따라 모든 조건을 동시에 만족하는 편성이 불가능할 수 있습니다.

**대응:** 팀 인원 차이, 평균 전력 편차, 동일 부수 집중, 직전 회차 조합 반복에 가중치를 둔 점수 함수를 사용합니다. 결과 품질 지표를 표시하고 운영진이 이동/교체한 뒤 즉시 재계산할 수 있게 합니다. 다시 편성 및 이전 편성 되돌리기를 지원합니다.

### 2.5 홈 서버 운영

**위험:** 디스크 장애, 잘못된 업데이트, DuckDNS/Nginx 설정 오류로 데이터 또는 서비스가 유실될 수 있습니다.

**대응:** PocketBase 버전을 고정하고, 업데이트 전 백업하며, `pb_data`를 앱 컨테이너와 분리합니다. 매일 백업, 보관 주기, 복구 연습, HTTPS 및 proxy SSE 설정을 운영 문서에 포함합니다.

## 3. 권한 모델

### 운영진

- PocketBase Auth collection `users`로 로그인합니다.
- `role = admin`인 활성 계정만 관리자 endpoint에 접근합니다.
- 회원, 회차, 편성, 경기, 승강, 가져오기/내보내기 작업을 수행합니다.
- 모든 중요 변경은 `audit_logs`에 actor, action, target, before/after, request ID와 함께 기록합니다.

### 참가자

- 회원가입과 로그인 없이 공개 endpoint만 사용합니다.
- 유효한 토큰의 해당 회차에서 날짜/상태/공지, 닉네임, 팀, 조, 대진표, 결과, 순위만 조회합니다.
- 회차 참석자로 등록된 사람은 참가자별 선택 링크를 통해 자신의 게임 참가 여부를 `미정/참가/미참가`로 선택할 수 있습니다.
- 전체 회원, 실명, 메모, 관리자 화면, 다른 회차 및 일반 쓰기 API에는 접근할 수 없습니다. 예외적으로 개인 선택 토큰을 검증하는 제한된 endpoint에서 자신의 게임 참가 상태만 변경할 수 있습니다.

공용 회차 링크 하나만으로 본인을 식별할 수는 없으므로 아무 닉네임이나 선택해 상태를 변경하는 방식은 사용하지 않습니다. 참석자 등록 시 별도의 `participation_token`을 발급하고, 참가자는 해당 capability token이 포함된 개인 선택 링크에서 자신의 상태만 변경합니다. 토큰 원문은 저장하지 않고 해시만 저장하며 운영진은 모든 참가자의 상태를 대신 변경할 수 있습니다. MVP 운영상 개인 링크 배포가 번거로우면 운영진 입력만 활성화하고 참가자 직접 선택 기능은 설정으로 끌 수 있게 합니다.

## 4. 데이터 모델

모든 주요 컬렉션은 `created`, `updated`를 사용하고 필요한 경우 `version`, `deleted_at`을 추가합니다. 실제 migration에는 필드 타입, required, relation, index와 validation을 명시합니다.

| Collection | 핵심 필드 및 제약 |
| --- | --- |
| `users` | email(unique), name, role(admin), active; 운영진 인증 |
| `members` | name, nickname, rank, status, memo, joined_at; 삭제 대신 inactive |
| `rank_settings` | min_rank, max_rank, promotion_threshold, demotion_threshold, counting_mode(per_match/per_event_capped), max_count_per_event, minimum_distinct_events; 단일 활성 설정 |
| `events` | title, event_date, status, notice, public_token_hash(unique), public_access_enabled, public_expires_at, created_by, version |
| `event_participants` | event, member(nullable), participant_type, guest_name, display_name, rank_snapshot, game_participation_status(undecided/playing/not_playing), participation_token_hash(unique), participation_responded_at, version; `(event, member)` 중복 방지 |
| `competitions` | event, name, competition_type(team_round_robin/individual_round_robin), status, ranking_policy, stop_when_decided, version; 한 회차에 여러 경기 운영 단위 허용 |
| `match_format_templates` | owner(nullable), name, team_size_min, win_condition(best_of/all_games), allow_draw, stop_when_decided, max_singles_per_player, allow_singles_doubles_overlap, enabled; 재사용 가능한 팀 대항전 형식 |
| `match_format_games` | format_template, sequence, game_type(singles/doubles), set_best_of; `(format_template, sequence)` unique |
| `teams` | event, name, sort_order, version; `(event, name)` unique |
| `team_members` | team, participant; `(team, participant)` unique, 한 회차에서 한 팀만 허용 |
| `groups` | competition, name, mode; `(competition, name)` unique |
| `group_teams` | group, team, seed; `(group, team)` unique |
| `team_matches` | competition, group, home_team, away_team, round, order, format_snapshot_json, status, home_game_wins, away_game_wins, winner, version; 동일 팀 쌍 중복 방지 |
| `match_games` | team_match, sequence, game_type(singles/doubles), status, winner_side, scoring_mode, home_sets, away_sets, detail_json, version; `(team_match, sequence)` unique |
| `match_game_players` | match_game, side(home/away), participant, position; 단식은 측별 1명, 복식은 측별 2명, 동일 세부 경기 중복 출전 방지 |
| `individual_matches` | event, competition(nullable), source_type(individual_round_robin/team_match_game/standalone), match_game(nullable), player_a, player_b, a_rank_snapshot, b_rank_snapshot, set_best_of, winner, status, counts_for_rank, round, order, played_at, version; 취소 레코드 보존 |
| `rank_change_candidates` | member, direction, status, trigger_count, source_match_ids, evaluated_at; pending 중복 방지 |
| `rank_change_history` | member, from_rank, to_rank, decision, reason, source_match_ids, decided_by, decided_at |
| `match_result_history` | match_type, match_id, action, before_json, after_json, changed_by, changed_at |
| `audit_logs` | actor, action, target_type, target_id, before_json, after_json, request_id, created |
| `idempotency_keys` | key(unique), actor, operation, response_json, expires_at |

SQLite/PocketBase schema만으로 표현하기 어려운 교차 컬렉션 제약은 서버 hook에서 검증하고 트랜잭션 안에서 저장합니다. 예를 들어 `team_matches`의 두 팀 ID를 정렬한 `pair_key`를 생성하여 `(group, pair_key)` unique index로 중복 대진을 차단합니다.

## 5. 상태와 핵심 규칙

### 회차

`draft → active → completed → archived` 순서를 기본으로 합니다. 완료 후 기본 24시간에 공개 링크가 만료되며 운영진이 시간 변경, 즉시 비활성화, 재발급할 수 있습니다. 링크 만료는 데이터 삭제와 무관합니다.

### 팀 및 대진표

- 회차 참석 인원은 보통 18~22명이지만 최소·최대 인원을 고정하지 않습니다. 18명 미만과 22명 초과도 처리하며, 편성 불가능한 극소 인원에는 이유와 운영진 대안을 표시합니다.
- 회차 참석 여부와 실제 게임 참가 여부를 분리합니다. 자동 편성에는 `playing` 상태인 참가자만 포함하고 `undecided`와 `not_playing`은 제외합니다.
- 2인, 3인 및 혼합 팀을 지원하고 가능한 경우 팀원 수 차이는 최대 1명으로 합니다. 참가 인원에 따라 이 조건을 만족할 수 없으면 경고와 품질 지표를 표시합니다.
- 숫자가 작은 부수가 더 강하다는 규칙을 점수 함수와 테스트에 명시합니다.
- 랭킹에 따라 팀 전력을 균등하게 자동 편성하되 운영진은 편성 후 팀원을 이동하거나 서로 교체할 수 있습니다. 수동 변경 후 팀 평균, 전력 편차와 품질 점수를 즉시 다시 계산합니다.
- 단일 조 또는 A/B조를 지원하며 균형/무작위 방식을 선택할 수 있습니다.
- 풀리그는 circle method로 생성하고 홀수 팀은 bye를 포함합니다.
- 동일 팀 쌍을 한 번만 생성하고 연속 경기를 가능한 범위에서 최소화합니다.
- 기록 모드는 승패, 세트 점수, 세트별 상세 점수로 확장 가능하게 설계하되 MVP UI는 승패를 기본으로 합니다.

### 경기 방식 설정

회차마다 인원과 운영 방식이 달라질 수 있으므로 팀 대항전 3경기 같은 고정 규칙을 두지 않습니다. 운영진은 게임 시작 전에 하나 이상의 `competition`을 만들고 다음 방식을 선택합니다.

1. **팀 풀리그:** 게임 참가자를 팀으로 편성한 뒤 팀끼리 풀리그를 진행합니다.
2. **개인 단식 풀리그:** 팀을 만들지 않고 게임 참가자 전원이 개인 자격으로 풀리그를 진행합니다. 인원이 적을 때 추천하되 운영진이 인원과 관계없이 선택할 수 있습니다.

팀 풀리그에서는 운영진이 세부 경기 수와 순서를 자유롭게 설정합니다. 예를 들면 `단식-단식-복식`, `단식-복식-단식`, `단식 3경기`, `복식-단식-복식-단식-단식` 등을 만들 수 있습니다. 각 세부 경기에는 단식/복식 유형과 세트 형식(예: 3판 2선승)을 지정합니다. 자주 사용하는 구성을 템플릿으로 저장하고 다음 회차에서 재사용할 수 있습니다.

팀 대항전 승리 조건도 다음 중 선택합니다.

- `best_of`: 먼저 과반의 세부 경기를 이기면 팀 승리
- `all_games`: 설정된 세부 경기를 모두 진행한 뒤 승수가 많은 팀 승리

세부 경기 수가 짝수라 팀 승수가 같아질 수 있는 구성은 무승부 허용 또는 타이브레이크 규칙을 반드시 설정해야 저장할 수 있습니다. `best_of`에서는 승자가 확정되면 남은 경기를 생략할지 계속 진행할지 설정합니다. 실제 대진을 생성할 때 형식 snapshot을 저장하여 나중에 템플릿이 바뀌어도 과거 경기 구성이 변하지 않게 합니다.

개인 단식 풀리그에서는 `playing` 상태인 참가자 모두가 한 번씩 대결하도록 circle method로 대진을 생성합니다. 기본 세트 형식은 **3판 2선승**이며 운영진이 변경할 수 있습니다. 인원이 홀수이면 라운드별 bye를 배정하고 연속 경기 편차를 최소화합니다. 참가자가 많아 전체 풀리그 경기 수 `n(n-1)/2`가 지나치게 커지면 예상 경기 수를 사전에 보여주고 조 분할 또는 팀 리그를 추천합니다.

각 세부 경기와 개인 단식은 예정/진행 중/완료/취소 상태, 출전 선수, 세트 및 점수를 독립적으로 저장합니다.

팀 리그 라인업은 경기 시작 전에 운영진이 확정합니다. 기본 공정성 규칙은 다음과 같습니다.

- 한 팀 대항전에서 한 선수의 단식 최대 출전 횟수는 형식 설정으로 정합니다. 기본값은 1회입니다.
- 복식은 팀원 중 2명을 선택합니다. 단식 출전자의 복식 중복 출전 허용 여부는 경기 형식 설정으로 정합니다.
- 세부 경기의 전체 출전 슬롯이 팀원 수 이상이면 모든 팀원이 최소 한 경기에 출전하도록 기본 validation을 적용합니다. 슬롯이 부족하면 미출전자를 명확히 표시하고 운영진 확인을 받습니다.
- 여러 팀 대항전에 걸쳐 단식 출전 횟수를 표시하고 차이가 지나치게 커지면 경고합니다.
- 자동 라인업은 팀원별 단식 출전 횟수를 순환 배정하되 운영진이 임의로 변경할 수 있습니다.
- 첫 세부 경기가 시작되면 라인업을 잠그고, 이후 변경은 사유 입력과 감사 로그가 필요한 운영진 정정으로 처리합니다.

세부 경기 수와 순서는 부수 승강 계산 기준에 영향을 주지 않습니다. 복식 결과는 팀 대항전 승패에는 반영하지만 개인 부수 승강에는 반영하지 않습니다.

게임 참가 상태가 팀 확정 전에 바뀌면 자동 편성 대상을 즉시 갱신합니다. 팀 또는 대진표가 확정된 뒤 상태가 바뀌면 기존 결과를 조용히 덮어쓰지 않고 영향받는 팀과 경기를 표시한 뒤 운영진이 `재편성`, `수동 조정`, `변경 취소` 중 하나를 선택하게 합니다. 이미 시작한 경기가 있으면 전체 재편성을 제한하고 운영진 수동 조정과 감사 로그를 사용합니다.

### 순위

승리 수 → 상대 전적 → 세트 득실 → 점수 득실 순으로 계산합니다. 기록되지 않은 항목은 건너뛰고 최종 동률은 동률 표시 또는 운영진 수동 결정으로 처리합니다. 순위는 유효한 완료 경기에서 계산하며 결과 취소 시 자동 복구됩니다.

### 개인전과 부수 승강

- 팀 대항전 전체 승패와 복식 결과는 개인 부수 승강에 반영하지 않습니다.
- 팀 대항전 안에서 실제로 치른 공식 단식은 독립 `individual_matches` 원장으로 연결하고 개인 부수 승강에 반영합니다. 별도로 입력한 공식 개인전도 같은 원장에 포함합니다.
- 개인 단식 풀리그의 완료된 공식 단식도 동일한 `individual_matches` 원장에 기록하고 승강에 반영합니다.
- 몰수, 취소, 연습 경기와 운영진이 `counts_for_rank = false`로 지정한 경기는 승강 계산에서 제외합니다.
- 경기 당시 양 선수의 부수를 snapshot으로 저장합니다.
- 상위 부수 상대 승리는 승급 실적으로, 하위 부수 상대 패배는 강등 실적으로 계산합니다.
- 같은 부수 경기는 제외하고 한 경기로 최대 한 단계만 변경합니다.
- 운영진 승인 후에만 현재 부수를 변경하고 승인/반려 이력을 보존합니다.
- 승인 시 해당 결정의 기준 경기 범위를 고정하고 이후 카운터 기준점을 초기화합니다.
- 결과 수정/취소 시 경기 원장으로 후보를 재계산합니다.
- 승인된 승강에 영향을 주는 과거 경기 변경은 경고 후 별도의 정정 흐름으로 처리하고 기존 이력을 덮어쓰지 않습니다.

단식 출전 기회가 많거나 개인 풀리그를 선택한 회차에서 승강 조건에 지나치게 빨리 도달하지 않도록 승강 집계 방식을 설정값으로 관리합니다.

- `per_match`: 기존 방식처럼 조건을 만족한 공식 단식 한 경기마다 1회 누적합니다.
- `per_event_capped`: 한 회차에서 조건을 만족한 경기가 여러 개여도 방향별 최대 설정 횟수만 누적합니다.

기본값은 `per_event_capped`, 회차별 최대 1회, 승급/강등 기준 3회, 최소 서로 다른 3개 회차로 권장합니다. 예를 들어 개인 풀리그 하루에 상위 부수 상대에게 3승해도 승급 실적은 1회만 증가합니다. 서로 다른 세 회차에서 조건을 충족해야 후보가 됩니다. 모임이 기존의 단순 누적 3승/3패 규칙을 유지하려면 `per_match`로 변경할 수 있습니다.

화면에는 원본 공식 단식 결과, 회차별 인정 실적, 제외 사유를 함께 표시합니다. 승인 후에는 기준점을 새로 만들며 과거 경기나 집계 설정을 바꿔도 이미 승인된 이력을 자동으로 뒤집지 않습니다.

## 6. 핵심 화면

### 관리자

1. 로그인 및 대시보드
2. 회원 목록/검색/등록/수정/비활성화
3. 회원 상세, 전적, 참석 횟수, 부수 이력
4. 회차 목록/생성/수정/복제
5. 참석자 선택, 임시 참가자 추가 및 게임 참가 상태 관리
6. 게임 참가자 기준 팀 자동 편성, 품질 지표, 이동/교체, 다시 편성, 되돌리기
7. 경기 방식 설정, 조 편성 및 팀/개인 풀리그 대진표 생성
8. 팀 세부 경기 라인업 및 팀/개인 경기 결과 입력·수정·취소
9. 개인전 입력 및 승강 후보 승인/반려
10. 공개 링크 복사/만료/재발급
11. 설정, CSV 가져오기, JSON/CSV 내보내기

### 공개 참가자

1. 회차 정보, 상태 및 공지
2. 개인 선택 링크에서 자신의 게임 참가/미참가 선택
3. 참가자와 팀/조 구성
4. 진행 예정/진행 중/완료 경기
5. 조별 순위
6. 연결 상태, 마지막 업데이트, 수동 새로고침
7. 만료/비활성/존재하지 않는 링크 화면

모든 화면은 한국어, 모바일 우선, 최소 44px 터치 영역, 높은 명암비를 적용하고 상태를 색상과 텍스트로 함께 표현합니다.

## 7. 구현 단계와 완료 기준

### Phase 1: 기반과 설계

- [ ] Vite React TypeScript strict 프로젝트 및 계층 구조 생성
- [ ] PocketBase Docker Compose, 고정 버전, persistent volume 구성
- [ ] ERD와 PocketBase JavaScript migration 작성
- [ ] 12~28명의 가변 인원 시나리오를 포함한 개발/테스트 seed 작성
- [ ] 환경변수 예제와 secret 제외 설정

**완료 기준:** 빈 환경에서 migration과 seed를 적용해 앱과 PocketBase가 실행됩니다.

### Phase 2: 인증, 회원 및 설정

- [ ] 운영진 로그인과 route/API 권한 보호
- [ ] 회원 조회/검색/등록/수정/비활성화
- [ ] 회원 상세 전적/이력/참석 횟수
- [ ] 부수 범위와 승강 기준 설정
- [ ] 회원 CSV 가져오기 검증/미리보기/중복 처리

**완료 기준:** 비로그인 사용자는 관리자 데이터를 읽거나 쓸 수 없고 회원 삭제 없이 과거 기록이 보존됩니다.

### Phase 3: 회차, 참석자 및 편성

- [ ] 회차 생성/수정/복제 및 상태 전이
- [ ] 회원 참석 선택과 임시 참가자 추가
- [ ] 참가자별 게임 참가/미참가 선택 토큰 및 운영진 대리 변경
- [ ] 게임 참가 상태 변경 시 편성과 대진표 영향 확인 흐름
- [ ] 팀 편성 순수 함수와 품질 점수 구현
- [ ] 이동/교체, 다시 편성, 되돌리기
- [ ] 단일/A·B조 균형 및 무작위 편성
- [ ] 팀 풀리그/개인 단식 풀리그 선택과 경기 수 사전 계산
- [ ] 홀짝 팀 및 개인 풀리그 생성 순수 함수
- [ ] 가변 단식/복식 형식 템플릿, 승리 조건과 snapshot
- [ ] 설정된 형식에 따른 세부 경기 생성과 자동 라인업 순환
- [ ] 운영진 라인업 수정, 출전 검증 및 경기 시작 후 잠금

**완료 기준:** 전체 참석 인원과 무관하게 게임 참가 상태인 사람만 대상으로 팀 풀리그 또는 개인 단식 풀리그를 만들 수 있습니다. 18명 미만·18~22명·22명 초과 입력을 안전하게 처리하고 중복 없는 대진을 생성합니다. 팀 방식에서는 운영진이 팀원을 이동/교체하면 전력 지표가 다시 계산됩니다.

### Phase 4: 경기 운영과 순위

- [ ] 모바일 결과 입력/수정/취소 UI
- [ ] 가변 단식/복식 세부 경기 결과와 설정별 팀 승자 집계
- [ ] 개인 단식 풀리그 결과와 개인 순위 집계
- [ ] `version` 충돌 검사와 idempotency 처리
- [ ] 결과 변경 이력과 audit log
- [ ] 순위 및 동률 계산 순수 함수
- [ ] 서버 트랜잭션 기반 결과 저장 endpoint

**완료 기준:** 결과 취소 후 순위가 원복되고 동시 수정 한 건은 409로 거절되며 중복 요청은 한 번만 반영됩니다.

### Phase 5: 공개 링크와 실시간 조회

- [ ] 암호학적 공개 토큰 생성/해시 저장
- [ ] 공개 전용 DTO endpoint
- [ ] 링크 활성화/만료/재발급
- [ ] 제한된 Realtime 또는 안전한 polling fallback
- [ ] 연결 상태, 마지막 업데이트, 재조회 처리

**완료 기준:** 익명 사용자는 유효한 해당 회차 공개 DTO만 읽고 다른 회차, 전체 회원, 실명과 메모를 조회할 수 없습니다.

### Phase 6: 개인전과 승강

- [ ] 개인전 입력/수정/취소 및 부수 snapshot
- [ ] 경기 원장 기반 승강 후보 재계산
- [ ] 승인/반려와 부수 변경 이력
- [ ] 승인된 과거 판정에 대한 정정 경고/처리

**완료 기준:** 결과 수정·취소 후 후보가 재계산되고 승인 전에는 회원 부수가 변경되지 않습니다.

### Phase 7: 운영 및 배포

- [ ] JSON/CSV 내보내기
- [ ] `pb_data` 백업/복구 절차와 정기 백업 예제
- [ ] Nginx Proxy Manager HTTPS/SSE 설정
- [ ] 보안 및 모바일 E2E 검증
- [ ] README와 운영 매뉴얼

**완료 기준:** 새 홈 서버에서 문서만으로 배포와 복구가 가능하고 핵심 E2E 테스트가 통과합니다.

## 8. 테스트 계획

### 단위 테스트

- 2인/3인 및 18·20·21·22명 혼합 팀 편성
- 18명 미만, 22명 초과, 극소 인원 및 게임 미참가자 포함 편성
- 참석 인원과 게임 참가 인원이 다른 경우
- 특정 부수 집중, 최소/최대 부수, 이전 조합 회피
- 운영진 수동 이동/교체 후 품질 지표 재계산
- 홀수/짝수 팀 풀리그, 중복 방지, bye 처리
- 임의 단식/복식 순서와 경기 수 생성
- `best_of`/`all_games`, 남은 경기 진행/생략 및 무승부 처리
- 단식 측별 1명, 복식 측별 2명과 라인업 중복/누락 검증
- 여러 대진에 걸친 단식 출전 순환과 편차 경고
- 개인 단식 풀리그의 홀짝 인원, bye, 중복 방지 및 `n(n-1)/2` 경기 수
- 개인 단식 3판 2선승 결과와 순위 계산
- 순위와 모든 동률 기준
- 승급/강등 및 경계값
- 경기별 누적과 회차별 상한 집계 방식
- 한 회차 다경기에서 승강 실적이 설정 상한을 넘지 않는지 검증
- 결과 수정/취소 후 순위와 후보 재계산
- 복식 및 팀 승패가 개인 승강에서 제외되는지 검증
- 팀 대항전 공식 단식만 개인전 원장에 한 번 반영되는지 검증

### 통합 및 보안 테스트

- 운영진 인증과 비활성 계정 차단
- 회차/참석자/팀/대진 생성
- 가변 팀 경기 형식의 라인업 확정, 잠금 및 운영진 정정
- 개인 단식 풀리그 생성과 결과 입력
- 참가자별 토큰으로 본인 게임 참가 상태만 변경
- 다른 참가자의 선택 토큰 조작 및 공용 링크를 통한 상태 변경 차단
- 팀 확정 전후 게임 참가 상태 변경 처리
- 유효/만료/비활성/재발급 토큰
- 토큰 없이 컬렉션 직접 조회 차단
- 다른 회차 ID 또는 필터 조작 접근 차단
- 공개 응답에서 실명, 메모, 감사 로그 제외
- 결과 입력 후 공개 화면 갱신과 재연결
- 중복 요청, 동시 수정, 트랜잭션 rollback
- 결과 취소 후 순위 복구와 승강 후보 승인
- CSV 가져오기 validation 및 중복 처리

## 9. 프로젝트 구조

```text
src/
  app/                 # router, providers
  pages/               # admin/public 화면
  features/            # auth, members, events, matches, ranks
  domain/              # 순수 함수와 타입
  services/            # PocketBase/API 접근
  components/          # 공통 UI
  styles/
pocketbase/
  migrations/          # schema와 index migration
  hooks/               # custom endpoint, validation, transaction
  seed/
tests/
  unit/
  integration/
  e2e/
deploy/
  docker-compose.yml
  nginx/
docs/
```

UI, 도메인 계산, 데이터 접근, 서버 권한 검증을 분리하고 핵심 계산은 PocketBase에 의존하지 않는 순수 함수로 작성합니다.

## 10. 최종 완료 조건

- 운영진 인증, 회원/부수/회차/참석자 관리가 동작합니다.
- 가변 인원의 참석자를 관리하고 게임 참가자를 대상으로 팀 풀리그 또는 개인 단식 풀리그를 구성합니다.
- 참가자는 개인 선택 링크로 자신의 게임 참가/미참가를 선택하고 운영진은 이를 대신 변경할 수 있습니다.
- 운영진은 자동 편성된 팀원을 이동하거나 교체할 수 있고 변경된 전력 지표를 확인할 수 있습니다.
- 팀 대항전의 세부 경기 수, 단식/복식 순서, 세트 형식과 승리 조건을 설정하고 팀 승패를 자동 집계합니다.
- 인원이 적거나 운영진이 원하는 경우 전 참가자 개인 단식 풀리그를 3판 2선승 방식으로 진행할 수 있습니다.
- 공식 단식 결과만 개인 부수 승강 원장에 반영하며 복식과 팀 승패는 제외합니다.
- 운영진이 모바일에서 결과를 입력·수정·취소할 수 있습니다.
- 결과와 순위가 공개 화면에 새로고침 없이 또는 안전한 fallback으로 반영됩니다.
- 공개 링크의 만료, 비활성화, 재발급이 동작하고 데이터는 보존됩니다.
- 공개 사용자는 해당 회차의 허용된 데이터 외에는 접근할 수 없습니다.
- 개인전 원장으로 승강 후보를 재계산하고 승인 후에만 부수를 변경합니다.
- 결과 변경 이력과 운영진 감사 로그가 남습니다.
- 주요 단위/통합/E2E/보안 테스트가 통과합니다.
- 백업·복구, 환경변수, migration, 실행, 테스트, 배포 절차가 README에 문서화됩니다.
