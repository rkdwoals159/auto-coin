# Aden - Orderly API 인증 예제

이 프로젝트는 Orderly API를 사용하여 인증된 요청을 보내는 TypeScript 예제입니다.

## 설치

```bash
npm install
```

## 설정

1. 프로젝트 루트에 `.env` 파일을 생성하고 다음 내용을 추가하세요:

```
ORDERLY_SECRET=your_orderly_secret_key_here
```

2. `authenticationExample.ts` 파일에서 `orderlyAccountId`를 실제 계정 ID로 변경하세요:

```typescript
const orderlyAccountId = "your-actual-orderly-account-id";
```

## 실행

```bash
# 개발 모드 (파일 변경 시 자동 재시작)
npm run dev

# 일반 실행
npm start

# 빌드
npm run build
```

## 의존성

- `@noble/ed25519`: Ed25519 서명 생성
- `bs58`: Base58 인코딩/디코딩
- `dotenv`: 환경 변수 관리
- `ethers`: 이더리움 관련 유틸리티
- `typescript`: TypeScript 컴파일러
- `ts-node`: TypeScript 실행 환경

## 주의사항

- 실제 API 키와 시크릿을 사용하기 전에 테스트넷에서 먼저 테스트하세요
- `.env` 파일은 `.gitignore`에 추가하여 민감한 정보가 커밋되지 않도록 하세요
