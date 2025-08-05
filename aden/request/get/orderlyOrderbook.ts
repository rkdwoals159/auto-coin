import { getPublicKeyAsync, signAsync } from '@noble/ed25519';
import { encodeBase58 } from 'ethers';
/**
 * Orderly Network API 인증 헤더 생성
 */
interface OrderlyAuthHeaders {
    'orderly-account-id': string;
    'orderly-key': string;
    'orderly-signature': string;
    'orderly-timestamp': string;
}

/**
 * Orderbook 응답 데이터 타입
 */
export interface OrderbookData {
    asks: Array<{
        price: number;
        quantity: number;
    }>;
    bids: Array<{
        price: number;
        quantity: number;
    }>;
    timestamp: number;
}

/**
 * Orderly API 응답 타입
 */
export interface OrderlyApiResponse {
    success: boolean;
    timestamp: number;
    data: OrderbookData;
}





/**
 * Orderly Network API 인증 헤더 생성
 */
export async function createOrderlyAuthHeaders(
    accountId: string,
    secretKey: Uint8Array,
    url: URL
): Promise<OrderlyAuthHeaders> {
    const timestamp = Date.now();
    const message = `${timestamp}GET${url.pathname}${url.search}`;

    const encoder = new TextEncoder();
    const orderlySignature = await signAsync(encoder.encode(message), secretKey);
    const publicKey = await getPublicKeyAsync(secretKey);

    return {
        'orderly-account-id': accountId,
        'orderly-key': `ed25519:${encodeBase58(publicKey)}`,
        'orderly-signature': Buffer.from(orderlySignature).toString('base64url'),
        'orderly-timestamp': String(timestamp)
    };
}

/**
 * 특정 코인의 실시간 orderbook 조회
 * @param symbol - 코인 심볼 (예: 'BTC-PERP')
 * @param accountId - Orderly 계정 ID
 * @param apiKey - Orderly API 키
 * @param secretKey - Orderly 시크릿 키
 * @param maxLevel - 조회할 레벨 수 (선택사항)
 * @param isTestnet - 테스트넷 사용 여부 (기본값: false)
 * @returns orderbook 데이터
 */
export async function getOrderlyOrderbook(
    symbol: string,
    accountId: string,
    secretKey: Uint8Array,
    maxLevel?: number,
    isTestnet: boolean = false
): Promise<OrderbookData> {
    const baseUrl = isTestnet
        ? 'https://testnet-api.orderly.org'
        : 'https://api.orderly.org';

    const url = new URL(`/v1/orderbook/${symbol}`, baseUrl);

    // maxLevel 파라미터가 있으면 추가
    if (maxLevel) {
        url.searchParams.append('max_level', maxLevel.toString());
    }

    const headers = await createOrderlyAuthHeaders(accountId, secretKey, url);

    try {


        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...headers
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Orderly API 오류 (${response.status}): ${errorText}`);
        }

        const result = await response.json() as OrderlyApiResponse;

        if (!result.success) {
            throw new Error('Orderly API 응답이 성공하지 않았습니다.');
        }

        console.log(`Orderly orderbook 조회 성공: ${symbol}`);

        return result.data;
    } catch (error) {
        console.error(`Orderly orderbook 조회 실패 (${symbol}):`, error);
        throw error;
    }
}

/**
 * orderbook 데이터를 보기 좋게 출력
 */
export function printOrderbook(orderbook: OrderbookData, symbol: string): void {
    console.log(`\n=== ${symbol} Orderbook ===`);

    console.log('\n--- Asks (매도) ---');
    orderbook.asks.slice(0, 10).forEach((ask, index) => {
        console.log(`${index + 1}. 가격: ${ask.price.toFixed(4)}, 수량: ${ask.quantity.toFixed(6)}`);
    });

    console.log('\n--- Bids (매수) ---');
    orderbook.bids.slice(0, 10).forEach((bid, index) => {
        console.log(`${index + 1}. 가격: ${bid.price.toFixed(4)}, 수량: ${bid.quantity.toFixed(6)}`);
    });

    // 스프레드 계산
    if (orderbook.asks.length > 0 && orderbook.bids.length > 0) {
        const bestAsk = orderbook.asks[0].price;
        const bestBid = orderbook.bids[0].price;
        const spread = bestAsk - bestBid;
        const spreadPercent = (spread / bestAsk) * 100;

        console.log(`\n스프레드: ${spread.toFixed(4)} (${spreadPercent.toFixed(4)}%)`);
    }
}

/**
 * 실시간 orderbook 모니터링 (지정된 간격으로 반복 조회)
 */
export async function monitorOrderbook(
    symbol: string,
    accountId: string,
    secretKey: Uint8Array,
    intervalMs: number = 5000, // 5초마다
    maxLevel?: number,
    isTestnet: boolean = false
): Promise<void> {
    console.log(`\n${symbol} orderbook 모니터링 시작...`);
    console.log(`조회 간격: ${intervalMs}ms`);
    console.log(`테스트넷 사용: ${isTestnet}`);
    console.log('---');

    let count = 0;

    const monitor = async () => {
        try {
            count++;
            console.log(`\n[${count}] ${new Date().toLocaleString()}`);

            const orderbook = await getOrderlyOrderbook(
                symbol,
                accountId,
                secretKey,
                maxLevel,
                isTestnet
            );

            printOrderbook(orderbook, symbol);

        } catch (error) {
            console.error(`모니터링 오류 (${count}번째):`, error);
        }
    };

    // 첫 번째 조회
    await monitor();

    // 지정된 간격으로 반복
    const intervalId = setInterval(monitor, intervalMs);

    // 종료 신호 처리
    process.on('SIGINT', () => {
        console.log('\n모니터링을 종료합니다...');
        clearInterval(intervalId);
        process.exit(0);
    });
}

