# Orderly Network Orderbook 조회

Orderly Network API를 사용하여 특정 코인의 실시간 orderbook을 조회하는 기능입니다.

## 기능

- 특정 코인의 실시간 orderbook 조회
- HMAC-SHA256 인증 지원
- 메인넷/테스트넷 지원
- 실시간 모니터링 기능
- 스프레드 계산 및 표시

## 설치 및 설정

### 1. 환경 변수 설정

`.env` 파일에 Orderly API 인증 정보를 설정하세요:

```env
ORDERLY_ACCOUNT_ID=your-orderly-account-id
ORDERLY_API_KEY=your-orderly-api-key
ORDERLY_SECRET_KEY=your-orderly-secret-key
```

### 2. Orderly API 키 발급

1. [Orderly Network](https://orderly.network)에 가입
2. API 키 생성 (Account ID, API Key, Secret Key)
3. 필요한 권한 설정 (orderbook 조회 권한)

## 사용법

### 기본 사용법

```typescript
import { getOrderlyOrderbook, printOrderbook } from "./action/orderlyOrderbook";

// 단일 orderbook 조회
const orderbook = await getOrderlyOrderbook(
  "BTC-PERP", // 코인 심볼
  "your-account-id", // 계정 ID
  "your-api-key", // API 키
  "your-secret-key", // 시크릿 키
  10, // 최대 레벨 수 (선택사항)
  false // 테스트넷 사용 여부
);

// orderbook 출력
printOrderbook(orderbook, "BTC-PERP");
```

### 실시간 모니터링

```typescript
import { monitorOrderbook } from "./action/orderlyOrderbook";

// 5초마다 orderbook 조회
await monitorOrderbook(
  "BTC-PERP",
  "your-account-id",
  "your-api-key",
  "your-secret-key",
  5000, // 5초마다
  10, // 최대 10레벨
  false // 메인넷 사용
);
```

### 예시 실행

```bash
# 단일 orderbook 조회
npm run orderly:single

# 실시간 모니터링
npm run orderly:monitor
```

## API 응답 형식

```json
{
  "success": true,
  "timestamp": 1702989203989,
  "data": {
    "asks": [
      {
        "price": 10669.4,
        "quantity": 1.56263218
      }
    ],
    "bids": [
      {
        "price": 10669.4,
        "quantity": 1.56263218
      }
    ],
    "timestamp": 123
  }
}
```

## 지원하는 코인 심볼

- `BTC-PERP`: Bitcoin Perpetual
- `ETH-PERP`: Ethereum Perpetual
- `SOL-PERP`: Solana Perpetual
- 기타 Orderly Network에서 지원하는 모든 심볼

## 제한사항

- **Rate Limit**: 1초당 10회 요청 제한
- **인증 필요**: 모든 API 호출에 인증 헤더 필요
- **심볼 형식**: `{COIN}-PERP` 형식 사용

## 에러 처리

```typescript
try {
  const orderbook = await getOrderlyOrderbook(
    symbol,
    accountId,
    apiKey,
    secretKey
  );
  // 성공 처리
} catch (error) {
  if (error.message.includes("401")) {
    console.error("인증 실패: API 키를 확인하세요");
  } else if (error.message.includes("404")) {
    console.error("심볼을 찾을 수 없습니다");
  } else {
    console.error("API 오류:", error.message);
  }
}
```

## 보안 주의사항

1. **API 키 보안**: API 키와 시크릿 키를 안전하게 보관
2. **환경 변수 사용**: 코드에 직접 하드코딩하지 말고 환경 변수 사용
3. **HTTPS 사용**: 모든 API 호출은 HTTPS를 통해 수행
4. **권한 최소화**: 필요한 최소 권한만 부여

## 참고 문서

- [Orderly Network API 문서](https://orderly.network/docs/build-on-omnichain/evm-api/restful-api/private/orderbook-snapshot)
- [API 인증 가이드](https://orderly.network/docs/build-on-omnichain/evm-api/restful-api/about-apis/api-authentication)
- [에러 코드](https://orderly.network/docs/build-on-omnichain/evm-api/restful-api/about-apis/error-codes)
