import { EnvironmentManager } from '../../../config/environment';
import { getPublicKeyAsync, signAsync } from '@noble/ed25519';
import { encodeBase58 } from 'ethers';

/**
 * Gate.io 선물 주문 타입
 */
export type GateIOOrderType = 'gtc' | 'ioc' | 'poc' | 'fok';

/**
 * Gate.io 선물 주문 방향
 */
export type GateIOOrderSide = 'BUY' | 'SELL';

/**
 * Gate.io 선물 주문 요청 데이터
 */
export interface GateIOFuturesOrderRequest {
    contract: string;           // 선물 계약명 (예: 'BTC_USDT')
    size: number;              // 거래 수량 (숫자로 전송)
    price?: string;            // 주문 가격 (시장가 주문의 경우 생략)
    tif?: GateIOOrderType;     // Time in force (기본값: 'gtc')
    text?: string;             // 커스텀 주문 정보
    reduce_only?: boolean;     // 포지션 감소 전용 주문
    close?: boolean;           // 포지션 종료 주문
    iceberg?: number;          // 빙산 주문 표시 수량
    auto_size?: string;        // 듀얼 모드 포지션 종료 방향
    stp_act?: string;         // Self-Trading Prevention Action
}

/**
 * Gate.io 선물 주문 응답 데이터
 */
export interface GateIOFuturesOrderResponse {
    id: number;
    user: number;
    contract: string;
    create_time: number;
    size: number;
    iceberg: number;
    left: number;
    price: string;
    fill_price: string;
    mkfr: string;
    tkfr: string;
    tif: string;
    refu: number;
    is_reduce_only: boolean;
    is_close: boolean;
    is_liq: boolean;
    text: string;
    status: string;
    finish_time: number;
    finish_as: string;
    stp_id: number;
    stp_act: string;
    amend_text: string;
}

/**
 * Gate.io API 인증 헤더 생성
 */
async function createGateIOAuthHeaders(
    method: string,
    path: string,
    queryParam: string,
    body: string
): Promise<Record<string, string>> {
    const envManager = EnvironmentManager.getInstance();

    if (!envManager.hasGateIOAuth()) {
        throw new Error('Gate.io API 인증 정보가 없습니다.');
    }

    const auth = envManager.getGateIOAuth();
    const apiKey = auth.apiKey!;
    const secretKey = auth.secretKey as string;

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const hashedPayload = require('crypto').createHash('sha512').update(body).digest('hex');

    // Gate.io API 서명 생성: [method, URL, queryString, hashedPayload, ts].join("\n")
    const signatureString = [method, path, queryParam, hashedPayload, timestamp].join('\n');
    const sign = require('crypto').createHmac('sha512', secretKey).update(signatureString).digest('hex');

    return {
        'KEY': apiKey,
        'SIGN': sign,
        'Timestamp': timestamp
    };
}

/**
 * Gate.io 선물 주문 생성
 * @param request - 주문 요청 데이터
 * @param settle - 정산 통화 ('usdt' 또는 'btc')
 * @returns 주문 응답 데이터
 */
export async function createGateIOFuturesOrder(
    request: GateIOFuturesOrderRequest,
    settle: 'usdt' | 'btc' = 'usdt'
): Promise<GateIOFuturesOrderResponse> {
    const host = 'https://api.gateio.ws';
    const prefix = '/api/v4';
    const url = `/futures/${settle}/orders`;

    const body = JSON.stringify(request);
    const headers = await createGateIOAuthHeaders('POST', prefix + url, '', body);

    headers['Accept'] = 'application/json';
    headers['Content-Type'] = 'application/json';

    try {
        console.log('Gate.io 선물 주문 생성 중...');
        console.log(`계약: ${request.contract}`);
        console.log(`수량: ${request.size}`);
        console.log(`가격: ${request.price || '시장가'}`);

        const response = await fetch(host + prefix + url, {
            method: 'POST',
            headers,
            body
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const result = await response.json() as GateIOFuturesOrderResponse;

        console.log('✅ Gate.io 선물 주문 생성 성공!');
        console.log(`주문 ID: ${result.id}`);
        console.log(`상태: ${result.status}`);

        return result;
    } catch (error) {
        console.error('Gate.io 선물 주문 생성 실패:', error);
        throw error;
    }
}

/**
 * Gate.io 현재 가격 조회
 * @param contract - 계약명 (예: 'BTC_USDT')
 * @returns 현재 가격 또는 null
 */
async function getCurrentGateIOPrice(contract: string): Promise<number | null> {
    try {
        const response = await fetch(`https://api.gateio.ws/api/v4/futures/usdt/contracts/${contract}`);
        if (!response.ok) {
            return null;
        }
        const data = await response.json() as any;
        return parseFloat(data.mark_price || data.last_price || '0');
    } catch (error) {
        console.error(`Gate.io 가격 조회 실패 (${contract}):`, error);
        return null;
    }
}

/**
 * Gate.io 수량을 가격에 맞게 반올림
 * @param quantity - 원본 수량
 * @param price - 현재 가격
 * @returns 반올림된 수량
 */
function roundGateIOQuantity(quantity: number, price: number): number {
    let roundedQuantity: number;

    if (price >= 5000) {
        // 5천달러 이상: 소수점 4자리까지
        roundedQuantity = Math.round(quantity * 10000) / 10000;
    } else if (price >= 1000) {
        // 천달러 이상: 소수점 2자리까지
        roundedQuantity = Math.round(quantity * 100) / 100;
    } else if (price >= 100) {
        // 100달러 이상: 소수점 1자리까지
        roundedQuantity = Math.round(quantity * 10) / 10;
    } else if (price >= 1) {
        // 1달러 이상: 정수
        roundedQuantity = Math.round(quantity);
    } else {
        // 1달러 이하: 10개 단위
        roundedQuantity = Math.round(quantity / 10) * 10;
    }

    // 최소 수량 체크 (Gate.io API 제한)
    if (roundedQuantity < 0.01) {
        console.log(`[경고] 수량이 너무 작습니다: ${roundedQuantity}, 최소 수량 0.01로 조정`);
        return 0.01;
    }

    return roundedQuantity;
}

/**
 * Gate.io 시장가 매수 주문 생성
 * @param contract - 계약명 (예: 'BTC_USDT')
 * @param amount - 매수 금액 (USDT)
 * @param settle - 정산 통화 (기본값: 'usdt')
 * @returns 주문 응답 데이터
 */
export async function createGateIOMarketBuyOrder(
    contract: string,
    amount: number,
    settle: 'usdt' | 'btc' = 'usdt'
): Promise<GateIOFuturesOrderResponse> {
    // 현재 가격 조회
    const currentPrice = await getCurrentGateIOPrice(contract);
    if (!currentPrice) {
        throw new Error(`현재 가격을 조회할 수 없습니다: ${contract}`);
    }

    // 금액을 수량으로 변환
    const quantity = amount / currentPrice;
    const roundedSize = roundGateIOQuantity(quantity, currentPrice);

    console.log(`Gate.io 매수 - 금액: $${amount}, 가격: $${currentPrice}, 수량: ${quantity}, 반올림: ${roundedSize}`);

    const request: GateIOFuturesOrderRequest = {
        contract,
        size: roundedSize,
        price: '0', // 시장가 주문을 위해 0으로 설정
        tif: 'ioc', // 즉시 체결 또는 취소
        text: `t-market-buy-${Date.now()}`,
        reduce_only: false
    };

    return await createGateIOFuturesOrder(request, settle);
}

/**
 * Gate.io 시장가 매수 주문 생성 (수량 기반)
 * @param contract - 계약명 (예: 'BTC_USDT')
 * @param size - 매수 수량 (개수)
 * @param settle - 정산 통화 (기본값: 'usdt')
 * @returns 주문 응답 데이터
 */
export async function createGateIOMarketBuyOrderBySize(
    contract: string,
    size: number,
    settle: 'usdt' | 'btc' = 'usdt'
): Promise<GateIOFuturesOrderResponse> {
    // 현재 가격 조회
    const currentPrice = await getCurrentGateIOPrice(contract);
    if (!currentPrice) {
        throw new Error(`현재 가격을 조회할 수 없습니다: ${contract}`);
    }

    // 수량 반올림
    const roundedSize = roundGateIOQuantity(size, currentPrice);
    console.log(`Gate.io 매수 - 수량: ${size}, 가격: $${currentPrice}, 반올림: ${roundedSize}`);

    const request: GateIOFuturesOrderRequest = {
        contract,
        size: roundedSize,
        price: '0', // 시장가 주문을 위해 0으로 설정
        tif: 'ioc', // 즉시 체결 또는 취소
        text: `t-buy-${Date.now()}`,
        reduce_only: false
    };

    return await createGateIOFuturesOrder(request, settle);
}

/**
 * Gate.io 시장가 매도 주문 생성
 * @param contract - 계약명 (예: 'BTC_USDT')
 * @param size - 매도 수량 (양수)
 * @param settle - 정산 통화 (기본값: 'usdt')
 * @returns 주문 응답 데이터
 */
export async function createGateIOMarketSellOrder(
    contract: string,
    amount: number,
    settle: 'usdt' | 'btc' = 'usdt'
): Promise<GateIOFuturesOrderResponse> {
    // 현재 가격 조회
    const currentPrice = await getCurrentGateIOPrice(contract);
    if (!currentPrice) {
        throw new Error(`현재 가격을 조회할 수 없습니다: ${contract}`);
    }

    // 금액을 수량으로 변환
    const quantity = amount / currentPrice;
    const roundedSize = roundGateIOQuantity(quantity, currentPrice);

    console.log(`Gate.io 매도 - 금액: $${amount}, 가격: $${currentPrice}, 수량: ${quantity}, 반올림: ${roundedSize}`);

    const request: GateIOFuturesOrderRequest = {
        contract,
        size: -roundedSize, // 음수로 변환 (매도)
        price: '0', // 시장가 주문을 위해 0으로 설정
        tif: 'ioc', // 즉시 체결 또는 취소
        text: `t-market-sell-${Date.now()}`,
        reduce_only: false
    };

    return await createGateIOFuturesOrder(request, settle);
}

/**
 * Gate.io 시장가 매도 주문 생성 (수량 기반)
 * @param contract - 계약명 (예: 'BTC_USDT')
 * @param size - 매도 수량 (개수)
 * @param settle - 정산 통화 (기본값: 'usdt')
 * @returns 주문 응답 데이터
 */
export async function createGateIOMarketSellOrderBySize(
    contract: string,
    size: number,
    settle: 'usdt' | 'btc' = 'usdt'
): Promise<GateIOFuturesOrderResponse> {
    // 현재 가격 조회
    const currentPrice = await getCurrentGateIOPrice(contract);
    if (!currentPrice) {
        throw new Error(`현재 가격을 조회할 수 없습니다: ${contract}`);
    }

    // 수량 반올림
    const roundedSize = roundGateIOQuantity(size, currentPrice);

    console.log(`Gate.io 매도 - 수량: ${size}, 가격: $${currentPrice}, 반올림: ${roundedSize}`);

    const request: GateIOFuturesOrderRequest = {
        contract,
        size: -roundedSize, // 음수로 변환 (매도)
        price: '0', // 시장가 주문을 위해 0으로 설정
        tif: 'ioc', // 즉시 체결 또는 취소
        text: `t-sell-${Date.now()}`,
        reduce_only: false
    };

    return await createGateIOFuturesOrder(request, settle);
}

/**
 * Gate.io 포지션 종료 주문 생성 (reduce_only 사용)
 * @param contract - 계약명 (예: 'BTC_USDT')
 * @param size - 현재 포지션 수량 (양수: 롱, 음수: 숏)
 * @param settle - 정산 통화 (기본값: 'usdt')
 * @returns 주문 응답 데이터
 */
export async function createGateIOPositionCloseOrder(
    contract: string,
    size: number,
    settle: 'usdt' | 'btc' = 'usdt'
): Promise<GateIOFuturesOrderResponse> {
    // 반대 방향으로 주문하여 포지션 종료
    const closeSize = size > 0 ? -size : Math.abs(size);

    const request: GateIOFuturesOrderRequest = {
        contract,
        size: closeSize, // 반대 방향으로 주문
        price: '0', // 시장가 주문을 위해 0으로 설정
        reduce_only: true, // 포지션 감소 전용 (새로운 포지션 생성 방지)
        tif: 'ioc',
        text: `t-close-pos-${Date.now()}`
    };

    return await createGateIOFuturesOrder(request, settle);
}

/**
 * 주문 응답 출력
 * @param response - 주문 응답 데이터
 */
export function printGateIOOrderResponse(response: GateIOFuturesOrderResponse): void {
    console.log('\n=== Gate.io 선물 주문 결과 ===');
    console.log(`주문 ID: ${response.id}`);
    console.log(`계약: ${response.contract}`);
    console.log(`수량: ${response.size}`);
    console.log(`가격: ${response.price}`);
    console.log(`상태: ${response.status}`);
    console.log(`체결 가격: ${response.fill_price}`);
    console.log(`Maker 수수료: ${response.mkfr}`);
    console.log(`Taker 수수료: ${response.tkfr}`);
    console.log(`Reduce Only: ${response.is_reduce_only}`);
    console.log(`포지션 종료: ${response.is_close}`);
}

/**
 * Gate.io 계약 정보 조회
 * @param contract - 계약명 (예: 'AAVE_USDT')
 * @returns 계약 정보
 */
export async function getGateIOContractInfo(contract: string): Promise<any> {
    try {
        const response = await fetch(`https://api.gateio.ws/api/v4/futures/usdt/contracts/${contract}`);
        if (!response.ok) {
            throw new Error(`API 호출 실패: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`❌ ${contract} 계약 정보 조회 실패:`, error);
        return null;
    }
}

/**
 * 사용 가능한 금액의 퍼센트로 주문할 수량 계산
 * @param contract - 계약명 (예: 'AAVE_USDT')
 * @param availableAmount - 사용 가능한 금액 (USDT)
 * @param percentage - 사용할 금액의 퍼센트 (0-100)
 * @returns 주문할 포지션 단위 수량
 */
export async function calculateOrderSizeByPercentage(
    contract: string,
    availableAmount: number,
    percentage: number
): Promise<number> {
    // 계약 정보 조회
    const contractInfo = await getGateIOContractInfo(contract);
    if (!contractInfo) {
        throw new Error(`계약 정보를 조회할 수 없습니다: ${contract}`);
    }

    // 현재 가격 조회
    const currentPrice = parseFloat(contractInfo.mark_price || contractInfo.last_price);
    if (!currentPrice || currentPrice <= 0) {
        throw new Error(`현재 가격을 조회할 수 없습니다: ${contract}`);
    }

    // 사용할 금액 계산
    const useAmount = availableAmount * (percentage / 100);

    // 해당 금액으로 살 수 있는 실제 코인 수량 계산
    const coinQuantity = useAmount / currentPrice;

    // 포지션 단위로 변환 (quanto_multiplier 고려)
    const quantoMultiplier = parseFloat(contractInfo.quanto_multiplier);
    const positionUnits = Math.floor(coinQuantity / quantoMultiplier);

    // 최소 주문 크기 확인
    const minOrderSize = contractInfo.order_size_min;
    const finalPositionUnits = Math.max(positionUnits, minOrderSize);


    console.log(`- 실제 구매할 코인 수량: ${finalPositionUnits * quantoMultiplier}`);

    return finalPositionUnits;
}

/**
 * Gate.io 시장가 매수 주문 생성 (금액 퍼센트 기반)
 * @param contract - 계약명 (예: 'AAVE_USDT')
 * @param availableAmount - 사용 가능한 금액 (USDT)
 * @param percentage - 사용할 금액의 퍼센트 (0-100)
 * @param settle - 정산 통화 (기본값: 'usdt')
 * @returns 주문 응답 데이터
 */
export async function createGateIOMarketBuyOrderByPercentage(
    contract: string,
    availableAmount: number,
    percentage: number,
    settle: 'usdt' | 'btc' = 'usdt'
): Promise<GateIOFuturesOrderResponse> {
    // 퍼센트 기반으로 주문 수량 계산
    const orderSize = await calculateOrderSizeByPercentage(contract, availableAmount, percentage);

    // 주문 생성
    return await createGateIOMarketBuyOrderBySize(contract, orderSize, settle);
}

/**
 * Gate.io 시장가 매도 주문 생성 (금액 퍼센트 기반)
 * @param contract - 계약명 (예: 'AAVE_USDT')
 * @param availableAmount - 사용 가능한 금액 (USDT)
 * @param percentage - 사용할 금액의 퍼센트 (0-100)
 * @param settle - 정산 통화 (기본값: 'usdt')
 * @returns 주문 응답 데이터
 */
export async function createGateIOMarketSellOrderByPercentage(
    contract: string,
    availableAmount: number,
    percentage: number,
    settle: 'usdt' | 'btc' = 'usdt'
): Promise<GateIOFuturesOrderResponse> {
    // 퍼센트 기반으로 주문 수량 계산
    const orderSize = await calculateOrderSizeByPercentage(contract, availableAmount, percentage);

    // 주문 생성 (음수로 변환하여 매도)
    return await createGateIOMarketSellOrderBySize(contract, orderSize, settle);
} 