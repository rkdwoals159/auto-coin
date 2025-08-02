import { createOrderlyPostAuthHeaders } from './createOrder';
import { getPublicKeyAsync, signAsync } from '@noble/ed25519';
import { encodeBase58 } from 'ethers';
import { getAllPositionsInfo, PositionData } from '../get/getAllPositionsInfo';
import { getMarketInfoWithSelectedFields } from '../get/getMarketInfoForAllSymbols';
import { OrderlyCreateOrderResponse } from './createOrder';

/**
 * 포지션 종료 타입
 */
export type ClosePositionType = 'MARKET' | 'REDUCE_ONLY' | 'CLOSE_ALL';

/**
 * 포지션 종료 요청 데이터
 */
export interface ClosePositionRequest {
    symbol: string;
    positionQty: number;
    closeType: ClosePositionType;
    clientOrderId?: string;
}

/**
 * 포지션 종료 결과
 */
export interface ClosePositionResult {
    success: boolean;
    message: string;
    orderId?: number;
    clientOrderId?: string;
    closedQuantity: number;
    remainingQuantity: number;
}

/**
 * 포지션 종료 (시장가 반대 주문)
 * @param symbol - 심볼 (예: 'PERP_BTC_USDC')
 * @param positionQty - 현재 포지션 수량 (양수: 롱, 음수: 숏)
 * @param accountId - Orderly 계정 ID
 * @param secretKey - Orderly 시크릿 키
 * @param clientOrderId - 클라이언트 주문 ID (선택사항)
 * @param isTestnet - 테스트넷 사용 여부 (기본값: false)
 * @returns 포지션 종료 결과
 */
export async function closePositionByMarketOrder(
    symbol: string,
    positionQty: number,
    accountId: string,
    secretKey: Uint8Array,
    clientOrderId?: string,
    isTestnet: boolean = false
): Promise<ClosePositionResult> {
    try {
        console.log(`\n=== 포지션 종료 (시장가) ===`);
        console.log(`심볼: ${symbol}`);
        console.log(`포지션 수량: ${positionQty}`);
        console.log(`포지션 타입: ${positionQty > 0 ? '롱' : '숏'}`);

        if (positionQty === 0) {
            return {
                success: false,
                message: '청산할 포지션이 없습니다.',
                closedQuantity: 0,
                remainingQuantity: 0
            };
        }

        const baseUrl = isTestnet
            ? 'https://testnet-api.orderly.org'
            : 'https://api.orderly.org';

        const url = new URL('/v1/order', baseUrl);

        // 반대 방향으로 시장가 주문
        const side = positionQty > 0 ? 'SELL' : 'BUY';
        const quantity = Math.abs(positionQty);

        // Client Order ID 길이 제한 (36자 이하)
        const defaultClientOrderId = `close_${symbol}_${Date.now()}`;
        const finalClientOrderId = (clientOrderId || defaultClientOrderId).slice(0, 36);

        const request = {
            symbol,
            order_type: 'MARKET',
            side,
            order_quantity: quantity,
            client_order_id: finalClientOrderId
        };

        const requestBody = JSON.stringify(request);
        const headers = await createOrderlyPostAuthHeaders(accountId, secretKey, url, requestBody);

        console.log(`시장가 ${side} 주문 생성 중...`);
        console.log(`수량: ${quantity}`);

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

        const result = await response.json() as any;

        if (!result.success) {
            throw new Error('API 응답이 성공하지 않았습니다.');
        }

        console.log('✅ 포지션 종료 성공!');
        console.log(`주문 ID: ${result.data.order_id}`);

        return {
            success: true,
            message: '포지션이 성공적으로 종료되었습니다.',
            orderId: result.data.order_id,
            clientOrderId: result.data.client_order_id,
            closedQuantity: quantity,
            remainingQuantity: 0
        };

    } catch (error) {
        console.error('포지션 종료 실패:', error);
        return {
            success: false,
            message: `포지션 종료 중 오류 발생: ${error}`,
            closedQuantity: 0,
            remainingQuantity: positionQty
        };
    }
}

/**
 * 포지션 종료 (reduce_only 옵션 사용)
 * @param symbol - 심볼 (예: 'PERP_BTC_USDC')
 * @param positionQty - 현재 포지션 수량 (양수: 롱, 음수: 숏)
 * @param accountId - Orderly 계정 ID
 * @param secretKey - Orderly 시크릿 키
 * @param clientOrderId - 클라이언트 주문 ID (선택사항)
 * @param isTestnet - 테스트넷 사용 여부 (기본값: false)
 * @returns 포지션 종료 결과
 */
export async function closePositionByReduceOnly(
    symbol: string,
    positionQty: number,
    accountId: string,
    secretKey: Uint8Array,
    clientOrderId?: string,
    isTestnet: boolean = false
): Promise<ClosePositionResult> {
    try {
        console.log(`\n=== 포지션 종료 (Reduce Only) ===`);
        console.log(`심볼: ${symbol}`);
        console.log(`포지션 수량: ${positionQty}`);

        if (positionQty === 0) {
            return {
                success: false,
                message: '청산할 포지션이 없습니다.',
                closedQuantity: 0,
                remainingQuantity: 0
            };
        }

        const baseUrl = isTestnet
            ? 'https://testnet-api.orderly.org'
            : 'https://api.orderly.org';

        const url = new URL('/v1/order', baseUrl);

        // 현재 가격 조회
        const marketInfo = await getMarketInfoWithSelectedFields('https://api.orderly.org', ['mark_price']);
        const symbolInfo = marketInfo.find(item => item.symbol === symbol);

        if (!symbolInfo || !symbolInfo.mark_price) {
            return {
                success: false,
                message: '현재 가격을 조회할 수 없습니다.',
                closedQuantity: 0,
                remainingQuantity: positionQty
            };
        }

        const currentPrice = symbolInfo.mark_price;
        const quantity = Math.abs(positionQty);
        const side = positionQty > 0 ? 'SELL' : 'BUY';

        // Client Order ID 길이 제한 (36자 이하)
        const defaultClientOrderId = `reduce_${symbol}_${Date.now()}`;
        const finalClientOrderId = (clientOrderId || defaultClientOrderId).slice(0, 36);

        // reduce_only 옵션으로 주문
        const request = {
            symbol,
            order_type: 'MARKET',
            side,
            order_quantity: quantity,
            reduce_only: true,
            client_order_id: finalClientOrderId
        };

        const requestBody = JSON.stringify(request);
        const headers = await createOrderlyPostAuthHeaders(accountId, secretKey, url, requestBody);

        console.log(`Reduce Only ${side} 주문 생성 중...`);
        console.log(`수량: ${quantity}`);
        console.log(`현재 가격: $${currentPrice.toFixed(2)}`);

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

        const result = await response.json() as any;

        if (!result.success) {
            throw new Error('API 응답이 성공하지 않았습니다.');
        }

        console.log('✅ 포지션 종료 성공!');
        console.log(`주문 ID: ${result.data.order_id}`);

        return {
            success: true,
            message: '포지션이 성공적으로 종료되었습니다.',
            orderId: result.data.order_id,
            clientOrderId: result.data.client_order_id,
            closedQuantity: quantity,
            remainingQuantity: 0
        };

    } catch (error) {
        console.error('포지션 종료 실패:', error);
        return {
            success: false,
            message: `포지션 종료 중 오류 발생: ${error}`,
            closedQuantity: 0,
            remainingQuantity: positionQty
        };
    }
}

/**
 * 특정 조건에서 포지션 자동 종료
 * @param symbol - 심볼
 * @param accountId - Orderly 계정 ID
 * @param secretKey - Orderly 시크릿 키
 * @param closeType - 종료 타입
 * @param isTestnet - 테스트넷 사용 여부 (기본값: false)
 * @returns 포지션 종료 결과
 */
export async function autoClosePosition(
    symbol: string,
    accountId: string,
    secretKey: Uint8Array,
    closeType: ClosePositionType = 'MARKET',
    isTestnet: boolean = false
): Promise<ClosePositionResult> {
    try {
        console.log(`\n=== 자동 포지션 종료 ===`);
        console.log(`심볼: ${symbol}`);
        console.log(`종료 타입: ${closeType}`);

        // 현재 포지션 정보 조회
        const positions = await getAllPositionsInfo(accountId, secretKey, isTestnet);
        if (!positions) {
            return {
                success: false,
                message: '포지션 정보 조회에 실패했습니다.',
                closedQuantity: 0,
                remainingQuantity: 0
            };
        }

        // 해당 심볼의 포지션 찾기
        const position = positions.rows.find(p => p.symbol === symbol);
        if (!position || position.position_qty === 0) {
            return {
                success: false,
                message: '청산할 포지션이 없습니다.',
                closedQuantity: 0,
                remainingQuantity: 0
            };
        }

        console.log(`현재 포지션: ${position.position_qty}`);
        console.log(`평균 진입가: $${position.average_open_price.toFixed(2)}`);
        console.log(`현재 가격: $${position.mark_price.toFixed(2)}`);
        console.log(`미정산 PnL: $${position.unsettled_pnl.toFixed(2)}`);

        // 종료 타입에 따라 실행
        if (closeType === 'MARKET') {
            return await closePositionByMarketOrder(
                symbol,
                position.position_qty,
                accountId,
                secretKey,
                `auto_close_${symbol}_${Date.now()}`,
                isTestnet
            );
        } else if (closeType === 'REDUCE_ONLY') {
            return await closePositionByReduceOnly(
                symbol,
                position.position_qty,
                accountId,
                secretKey,
                `auto_reduce_${symbol}_${Date.now()}`,
                isTestnet
            );
        } else {
            return {
                success: false,
                message: '지원하지 않는 종료 타입입니다.',
                closedQuantity: 0,
                remainingQuantity: position.position_qty
            };
        }

    } catch (error) {
        console.error('자동 포지션 종료 실패:', error);
        return {
            success: false,
            message: `자동 포지션 종료 중 오류 발생: ${error}`,
            closedQuantity: 0,
            remainingQuantity: 0
        };
    }
}

/**
 * 포지션 종료 결과 출력
 * @param result - 포지션 종료 결과
 */
export function printClosePositionResult(result: ClosePositionResult): void {
    console.log('\n=== 포지션 종료 결과 ===');
    console.log(`성공: ${result.success ? '✅' : '❌'}`);
    console.log(`메시지: ${result.message}`);

    if (result.success) {
        console.log(`주문 ID: ${result.orderId}`);
        console.log(`클라이언트 주문 ID: ${result.clientOrderId}`);
        console.log(`종료된 수량: ${result.closedQuantity}`);
        console.log(`남은 수량: ${result.remainingQuantity}`);
    }
} 