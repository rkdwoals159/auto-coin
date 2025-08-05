import { createOrderlyAuthHeaders } from '../get/orderlyOrderbook';
import { getPublicKeyAsync, signAsync } from '@noble/ed25519';
import { encodeBase58 } from 'ethers';

/**
 * Orderly Network API 인증 헤더 생성 (POST 요청용)
 */
interface OrderlyAuthHeaders {
    'orderly-account-id': string;
    'orderly-key': string;
    'orderly-signature': string;
    'orderly-timestamp': string;
}

/**
 * POST 요청용 Orderly 인증 헤더 생성
 */
export async function createOrderlyPostAuthHeaders(
    accountId: string,
    secretKey: Uint8Array,
    url: URL,
    body: string
): Promise<OrderlyAuthHeaders> {
    const timestamp = Date.now();
    const message = `${timestamp}POST${url.pathname}${url.search}${body}`;

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
 * 주문 타입
 */
export type OrderType = 'MARKET' | 'LIMIT' | 'IOC' | 'FOK' | 'POST_ONLY' | 'ASK' | 'BID';

/**
 * 주문 방향
 */
export type OrderSide = 'BUY' | 'SELL';

/**
 * 주문 생성 요청 데이터 타입
 */
export interface CreateOrderRequest {
    symbol: string;
    client_order_id?: string;
    order_type: OrderType;
    order_price?: number;
    order_quantity?: number;
    order_amount?: number;
    visible_quantity?: number;
    side: OrderSide;
    reduce_only?: boolean;
    slippage?: number;
    order_tag?: string;
    level?: number;
    post_only_adjust?: boolean;
}

/**
 * 주문 생성 응답 데이터 타입
 */
export interface CreateOrderResponse {
    order_id: number;
    client_order_id: string;
    order_type: OrderType;
    order_price: number;
    order_quantity: number;
    order_amount: number;
    error_message: string;
}

/**
 * Orderly API 응답 타입
 */
export interface OrderlyCreateOrderResponse {
    success: boolean;
    timestamp: number;
    data: CreateOrderResponse;
}

/**
 * 주문 생성
 * @param request - 주문 생성 요청 데이터
 * @param accountId - Orderly 계정 ID
 * @param secretKey - Orderly 시크릿 키
 * @param isTestnet - 테스트넷 사용 여부 (기본값: false)
 * @returns 주문 생성 응답
 */
export async function createOrder(
    request: CreateOrderRequest,
    accountId: string,
    secretKey: Uint8Array,
    isTestnet: boolean = false
): Promise<CreateOrderResponse> {
    const baseUrl = isTestnet
        ? 'https://testnet-api.orderly.org'
        : 'https://api.orderly.org';

    const url = new URL('/v1/order', baseUrl);
    const requestBody = JSON.stringify(request);
    const headers = await createOrderlyPostAuthHeaders(accountId, secretKey, url, requestBody);

    try {
        console.log('Orderly 주문 생성 중...');
        console.log(`심볼: ${request.symbol}`);

        const response = await fetch(url.toString(), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...headers
            },
            body: requestBody
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const result = await response.json() as OrderlyCreateOrderResponse;

        if (!result.success) {
            throw new Error('API 응답이 성공하지 않았습니다.');
        }



        return result.data;
    } catch (error) {
        console.error('주문 생성 실패:', error);
        throw error;
    }
}

/**
 * 시장가 매수 주문 생성 (선물 거래용)
 * @param symbol - 심볼 (예: 'PERP_BTC_USDC')
 * @param quantity - 매수 수량 (코인 수량)
 * @param accountId - Orderly 계정 ID
 * @param secretKey - Orderly 시크릿 키
 * @param clientOrderId - 클라이언트 주문 ID (선택사항)
 * @param isTestnet - 테스트넷 사용 여부 (기본값: false)
 * @returns 주문 생성 응답
 */
export async function createMarketBuyOrder(
    symbol: string,
    quantity: number,
    accountId: string,
    secretKey: Uint8Array,
    clientOrderId?: string,
    isTestnet: boolean = false,
    reduceOnly: boolean = false
): Promise<CreateOrderResponse> {
    const request: CreateOrderRequest = {
        symbol,
        order_type: 'MARKET',
        side: 'BUY',
        order_quantity: quantity,
        reduce_only: reduceOnly,
        client_order_id: clientOrderId || `market_buy_${Date.now()}`
    };

    return await createOrder(request, accountId, secretKey, isTestnet);
}

/**
 * 시장가 매도 주문 생성
 * @param symbol - 심볼 (예: 'PERP_BTC_USDC')
 * @param quantity - 매도 수량
 * @param accountId - Orderly 계정 ID
 * @param secretKey - Orderly 시크릿 키
 * @param clientOrderId - 클라이언트 주문 ID (선택사항)
 * @param isTestnet - 테스트넷 사용 여부 (기본값: false)
 * @returns 주문 생성 응답
 */
export async function createMarketSellOrder(
    symbol: string,
    quantity: number,
    accountId: string,
    secretKey: Uint8Array,
    clientOrderId?: string,
    isTestnet: boolean = false,
    reduceOnly: boolean = true
): Promise<CreateOrderResponse> {
    const request: CreateOrderRequest = {
        symbol,
        order_type: 'MARKET',
        side: 'SELL',
        order_quantity: quantity,
        reduce_only: reduceOnly,
        client_order_id: clientOrderId || `market_sell_${Date.now()}`
    };

    return await createOrder(request, accountId, secretKey, isTestnet);
}

/**
 * 지정가 매수 주문 생성
 * @param symbol - 심볼 (예: 'PERP_BTC_USDC')
 * @param price - 지정가
 * @param quantity - 매수 수량
 * @param accountId - Orderly 계정 ID
 * @param secretKey - Orderly 시크릿 키
 * @param clientOrderId - 클라이언트 주문 ID (선택사항)
 * @param isTestnet - 테스트넷 사용 여부 (기본값: false)
 * @returns 주문 생성 응답
 */
export async function createLimitBuyOrder(
    symbol: string,
    price: number,
    quantity: number,
    accountId: string,
    secretKey: Uint8Array,
    clientOrderId?: string,
    isTestnet: boolean = false
): Promise<CreateOrderResponse> {
    const request: CreateOrderRequest = {
        symbol,
        order_type: 'LIMIT',
        side: 'BUY',
        order_price: price,
        order_quantity: quantity,
        client_order_id: clientOrderId || `limit_buy_${Date.now()}`
    };

    return await createOrder(request, accountId, secretKey, isTestnet);
}

/**
 * 지정가 매도 주문 생성
 * @param symbol - 심볼 (예: 'PERP_BTC_USDC')
 * @param price - 지정가
 * @param quantity - 매도 수량
 * @param accountId - Orderly 계정 ID
 * @param secretKey - Orderly 시크릿 키
 * @param clientOrderId - 클라이언트 주문 ID (선택사항)
 * @param isTestnet - 테스트넷 사용 여부 (기본값: false)
 * @returns 주문 생성 응답
 */
export async function createLimitSellOrder(
    symbol: string,
    price: number,
    quantity: number,
    accountId: string,
    secretKey: Uint8Array,
    clientOrderId?: string,
    isTestnet: boolean = false
): Promise<CreateOrderResponse> {
    const request: CreateOrderRequest = {
        symbol,
        order_type: 'LIMIT',
        side: 'SELL',
        order_price: price,
        order_quantity: quantity,
        client_order_id: clientOrderId || `limit_sell_${Date.now()}`
    };

    return await createOrder(request, accountId, secretKey, isTestnet);
}

/**
 * 주문 생성 응답 출력
 * @param response - 주문 생성 응답
 */
export function printOrderResponse(response: CreateOrderResponse): void {
    console.log(`주문 타입: ${response.order_type}`);
    // 에러 메시지가 있는 경우만 출력
    if (response.error_message && response.error_message !== 'undefined' && response.error_message !== 'none') {
        console.log(`에러 메시지: ${response.error_message}`);
    } else {
        console.log(`상태: 성공`);
    }
}

/**
 * 주문 생성 요청 데이터 검증
 * @param request - 주문 생성 요청 데이터
 * @returns 검증 결과
 */
export function validateOrderRequest(request: CreateOrderRequest): { isValid: boolean; error?: string } {
    // 필수 필드 검증
    if (!request.symbol) {
        return { isValid: false, error: '심볼은 필수입니다.' };
    }

    if (!request.order_type) {
        return { isValid: false, error: '주문 타입은 필수입니다.' };
    }

    if (!request.side) {
        return { isValid: false, error: '주문 방향은 필수입니다.' };
    }

    // 주문 타입별 검증
    switch (request.order_type) {
        case 'MARKET':
        case 'BID':
        case 'ASK':
            if (request.side === 'BUY' && !request.order_amount) {
                return { isValid: false, error: '매수 주문의 경우 order_amount가 필요합니다.' };
            }
            if (request.side === 'SELL' && !request.order_quantity) {
                return { isValid: false, error: '매도 주문의 경우 order_quantity가 필요합니다.' };
            }
            break;

        case 'LIMIT':
        case 'IOC':
        case 'FOK':
        case 'POST_ONLY':
            if (!request.order_price) {
                return { isValid: false, error: '지정가 주문의 경우 order_price가 필요합니다.' };
            }
            if (!request.order_quantity) {
                return { isValid: false, error: '주문 수량이 필요합니다.' };
            }
            break;
    }

    return { isValid: true };
} 