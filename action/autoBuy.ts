import { ApiClient } from '../services/apiClient';
import { EnvironmentManager } from '../config/environment';
import { getAllPositionsInfo, PositionSummary } from '../aden/request/get/getAllPositionsInfo';
import { getMarketInfoWithSelectedFields } from '../aden/request/get/getMarketInfoForAllSymbols';
import { calculateQuantityFromAmount, getQuantityUnitInfo } from './quantityUtils';

/**
 * 자동 매수 설정
 */
export interface AutoBuyConfig {
    symbol: string;           // 매수할 심볼 (예: 'PERP_BTC_USDC')
    percentage: number;       // 사용 가능한 금액의 몇 %를 사용할지 (0.1 = 10%)
    minAmount: number;        // 최소 매수 금액 (USDC)
    maxAmount: number;        // 최대 매수 금액 (USDC)
    clientOrderId?: string;   // 클라이언트 주문 ID (선택사항)
}

/**
 * 자동 매수 결과
 */
export interface AutoBuyResult {
    success: boolean;
    message: string;
    orderId?: number;
    clientOrderId?: string;
    buyAmount: number;
    availableBalance: number;
    usedPercentage: number;
}

/**
 * 자동 매수 실행
 * @param config - 자동 매수 설정
 * @returns 자동 매수 결과
 */
export async function executeAutoBuy(config: AutoBuyConfig): Promise<AutoBuyResult> {
    try {
        console.log('\n=== 자동 매수 실행 ===');
        console.log(`심볼: ${config.symbol}`);
        console.log(`매수 비율: ${config.percentage * 100}%`);
        console.log(`최소 금액: $${config.minAmount}`);
        console.log(`최대 금액: $${config.maxAmount}`);

        const apiClient = new ApiClient();
        const envManager = EnvironmentManager.getInstance();

        // 인증 정보 확인
        if (!envManager.hasOrderlyAuth()) {
            return {
                success: false,
                message: 'Orderly API 인증 정보가 없습니다.',
                buyAmount: 0,
                availableBalance: 0,
                usedPercentage: 0
            };
        }

        // 현재 포지션 정보 조회 (사용 가능한 담보 확인)
        console.log('\n현재 포지션 정보 조회 중...');
        const positions = await getAllPositionsInfo(
            envManager.getOrderlyAuth().accountId!,
            envManager.getOrderlyAuth().secretKey! as Uint8Array,
            false
        );

        if (!positions) {
            return {
                success: false,
                message: '포지션 정보 조회에 실패했습니다.',
                buyAmount: 0,
                availableBalance: 0,
                usedPercentage: 0
            };
        }

        const availableBalance = positions.free_collateral;
        console.log(`사용 가능한 담보: $${availableBalance.toFixed(2)}`);

        // 매수 금액 계산
        const calculatedAmount = availableBalance * config.percentage;
        let buyAmount = Math.min(calculatedAmount, config.maxAmount);
        buyAmount = Math.max(buyAmount, config.minAmount);

        console.log(`계산된 매수 금액: $${calculatedAmount.toFixed(2)}`);
        console.log(`실제 매수 금액: $${buyAmount.toFixed(2)}`);

        // 최소 금액 체크 (Orderly API 요구사항: $10 이상)
        if (buyAmount < 10) {
            console.log(`⚠️ 주문 금액이 $10 미만입니다. $10으로 조정합니다.`);
            buyAmount = 10;
        }

        if (buyAmount < config.minAmount) {
            return {
                success: false,
                message: `사용 가능한 금액이 부족합니다. 최소 매수 금액: $${config.minAmount}`,
                buyAmount: 0,
                availableBalance,
                usedPercentage: 0
            };
        }

        // 현재 가격 조회 (수량 계산용)
        console.log('\n현재 가격 조회 중...');
        const marketInfo = await getMarketInfoWithSelectedFields('https://api.orderly.org', ['mark_price']);
        const symbolInfo = marketInfo.find(item => item.symbol === config.symbol);

        if (!symbolInfo || !symbolInfo.mark_price) {
            return {
                success: false,
                message: '현재 가격을 조회할 수 없습니다.',
                buyAmount,
                availableBalance,
                usedPercentage: config.percentage
            };
        }

        const currentPrice = symbolInfo.mark_price;
        const buyQuantity = calculateQuantityFromAmount(buyAmount, currentPrice);

        console.log(`현재 가격: $${currentPrice.toFixed(2)}`);
        console.log(`수량 단위: ${getQuantityUnitInfo(currentPrice)}`);
        console.log(`매수 수량: ${buyQuantity.toFixed(8)}`);

        // 시장가 매수 주문 생성
        console.log('\n시장가 매수 주문 생성 중...');

        // Client Order ID 길이 제한 (36자 이하)
        const clientOrderId = config.clientOrderId || `ab_${Date.now()}`;
        const shortClientOrderId = clientOrderId.length > 36 ? clientOrderId.slice(0, 36) : clientOrderId;

        const orderResponse = await apiClient.createMarketBuyOrder(
            config.symbol,
            buyQuantity,
            shortClientOrderId
        );

        if (!orderResponse) {
            return {
                success: false,
                message: '주문 생성에 실패했습니다.',
                buyAmount,
                availableBalance,
                usedPercentage: config.percentage
            };
        }

        console.log('✅ 자동 매수 성공!');
        console.log(`주문 ID: ${orderResponse.order_id}`);
        console.log(`매수 금액: $${buyAmount.toFixed(2)}`);
        console.log(`예상 매수 수량: ${buyQuantity.toFixed(8)}`);
        console.log(`실제 체결 수량: ${orderResponse.order_quantity}`);

        return {
            success: true,
            message: '자동 매수가 성공적으로 실행되었습니다.',
            orderId: orderResponse.order_id,
            clientOrderId: orderResponse.client_order_id,
            buyAmount,
            availableBalance,
            usedPercentage: config.percentage
        };

    } catch (error) {
        console.error('자동 매수 실패:', error);
        return {
            success: false,
            message: `자동 매수 중 오류 발생: ${error}`,
            buyAmount: 0,
            availableBalance: 0,
            usedPercentage: 0
        };
    }
}

/**
 * 자동 매수 결과 출력
 * @param result - 자동 매수 결과
 */
export function printAutoBuyResult(result: AutoBuyResult): void {
    console.log('\n=== 자동 매수 결과 ===');
    console.log(`성공: ${result.success ? '✅' : '❌'}`);
    console.log(`메시지: ${result.message}`);

    if (result.success) {
        console.log(`주문 ID: ${result.orderId}`);
        console.log(`클라이언트 주문 ID: ${result.clientOrderId}`);
        console.log(`매수 금액: $${result.buyAmount.toFixed(2)}`);
        console.log(`사용 가능한 담보: $${result.availableBalance.toFixed(2)}`);
        console.log(`사용 비율: ${(result.usedPercentage * 100).toFixed(1)}%`);
    }
}

/**
 * 안전한 자동 매수 (추가 검증 포함)
 * @param config - 자동 매수 설정
 * @returns 자동 매수 결과
 */
export async function executeSafeAutoBuy(config: AutoBuyConfig): Promise<AutoBuyResult> {
    console.log('\n=== 안전한 자동 매수 실행 ===');

    // 추가 검증
    if (config.percentage <= 0 || config.percentage > 1) {
        return {
            success: false,
            message: '매수 비율은 0과 1 사이의 값이어야 합니다.',
            buyAmount: 0,
            availableBalance: 0,
            usedPercentage: 0
        };
    }

    if (config.minAmount <= 0) {
        return {
            success: false,
            message: '최소 매수 금액은 0보다 커야 합니다.',
            buyAmount: 0,
            availableBalance: 0,
            usedPercentage: 0
        };
    }

    if (config.maxAmount <= config.minAmount) {
        return {
            success: false,
            message: '최대 매수 금액은 최소 매수 금액보다 커야 합니다.',
            buyAmount: 0,
            availableBalance: 0,
            usedPercentage: 0
        };
    }

    // 사용자 확인 (실제 운영에서는 주석 처리)
    console.log(`\n⚠️  확인: ${config.symbol}에 $${config.minAmount}~$${config.maxAmount} 범위에서 사용 가능한 금액의 ${config.percentage * 100}%로 시장가 매수를 실행합니다.`);
    console.log('계속하려면 Enter를 누르세요...');

    // 실제 운영에서는 이 부분을 주석 처리하거나 다른 방식으로 처리
    // await new Promise(resolve => process.stdin.once('data', resolve));

    return await executeAutoBuy(config);
}

/**
 * 기본 자동 매수 설정 생성
 * @param symbol - 매수할 심볼
 * @returns 기본 설정
 */
export function createDefaultAutoBuyConfig(symbol: string): AutoBuyConfig {
    return {
        symbol,
        percentage: 0.1,      // 10%
        minAmount: 10,        // 최소 10 USDC (Orderly 최소 주문 금액)
        maxAmount: 100,       // 최대 100 USDC
        clientOrderId: `auto_buy_${symbol}_${Date.now()}`
    };
} 