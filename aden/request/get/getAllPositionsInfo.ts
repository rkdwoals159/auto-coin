import { createOrderlyAuthHeaders } from './orderlyOrderbook';

/**
 * 포지션 데이터 타입
 */
export interface PositionData {
    IMR_withdraw_orders: number;
    MMR_with_orders: number;
    average_open_price: number;
    cost_position: number;
    est_liq_price: number;
    fee_24_h: number;
    imr: number;
    last_sum_unitary_funding: number;
    mark_price: number;
    mmr: number;
    pending_long_qty: number;
    pending_short_qty: number;
    pnl_24_h: number;
    position_qty: number;
    settle_price: number;
    symbol: string;
    seq: number;
    timestamp: number;
    unsettled_pnl: number;
}

/**
 * 포지션 요약 정보 타입
 */
export interface PositionSummary {
    current_margin_ratio_with_orders: number;
    free_collateral: number;
    initial_margin_ratio: number;
    initial_margin_ratio_with_orders: number;
    maintenance_margin_ratio: number;
    maintenance_margin_ratio_with_orders: number;
    margin_ratio: number;
    open_margin_ratio: number;
    total_collateral_value: number;
    total_pnl_24_h: number;
    rows: PositionData[];
}

/**
 * Orderly API 응답 타입
 */
export interface OrderlyPositionsResponse {
    success: boolean;
    timestamp: number;
    data: PositionSummary;
}



/**
 * 모든 포지션 정보 조회
 * @param accountId - Orderly 계정 ID
 * @param secretKey - Orderly 시크릿 키
 * @param isTestnet - 테스트넷 사용 여부 (기본값: false)
 * @returns 포지션 데이터
 */
export async function getAllPositionsInfo(
    accountId: string,
    secretKey: Uint8Array,
    isTestnet: boolean = false
): Promise<PositionSummary> {
    const baseUrl = isTestnet
        ? 'https://testnet-api.orderly.org'
        : 'https://api.orderly.org';

    const url = new URL('/v1/positions', baseUrl);
    const headers = await createOrderlyAuthHeaders(accountId, secretKey, url);

    try {
        console.log('Orderly 포지션 정보 조회 중...');
        // console.log(`URL: ${url.toString()}`);

        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...headers
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const result = await response.json() as OrderlyPositionsResponse;

        if (!result.success) {
            throw new Error('API 응답이 성공하지 않았습니다.');
        }

        // console.log('포지션 정보 조회 성공');
        return result.data;
    } catch (error) {
        console.error('포지션 정보 조회 실패:', error);
        throw error;
    }
}

/**
 * 포지션 정보 출력
 * @param positions - 포지션 데이터
 */
export function printPositionsInfo(positions: PositionSummary): void {
    console.log('\n=== Orderly 포지션 정보 ===');
    console.log(`총 담보 가치: $${positions.total_collateral_value.toFixed(2)}`);
    console.log(`사용 가능한 담보: $${positions.free_collateral.toFixed(2)}`);
    console.log(`마진 비율: ${(positions.margin_ratio * 100).toFixed(2)}%`);
    console.log(`24시간 총 PnL: $${positions.total_pnl_24_h.toFixed(2)}`);

    // 열린 포지션만 필터링
    const openPositions = positions.rows.filter(position => position.position_qty !== 0);
    console.log(`열린 포지션 개수: ${openPositions.length}개`);

    if (openPositions.length > 0) {
        console.log('\n=== 열린 포지션 ===');
        openPositions.forEach((position, index) => {
            console.log(`\n${index + 1}. ${position.symbol}`);
            console.log(`   포지션 수량: ${position.position_qty}`);
            console.log(`   평균 진입가: $${position.average_open_price.toFixed(2)}`);
            console.log(`   마크 가격: $${position.mark_price.toFixed(2)}`);
            console.log(`   미정산 PnL: $${position.unsettled_pnl.toFixed(2)}`);
            console.log(`   24시간 PnL: $${position.pnl_24_h.toFixed(2)}`);
            console.log(`   예상 청산가: $${position.est_liq_price.toFixed(2)}`);

            const pnlPercent = position.average_open_price !== 0
                ? ((position.mark_price - position.average_open_price) / position.average_open_price * 100 * Math.sign(position.position_qty))
                : 0;
            console.log(`   PnL 비율: ${pnlPercent.toFixed(2)}%`);
        });
    } else {
        console.log('\n현재 열린 포지션이 없습니다.');
    }
}

/**
 * 포지션 모니터링 (지속적 조회)
 * @param accountId - Orderly 계정 ID
 * @param secretKey - Orderly 시크릿 키
 * @param intervalMs - 조회 간격 (밀리초, 기본값: 30000)
 * @param isTestnet - 테스트넷 사용 여부 (기본값: false)
 */
export async function monitorPositions(
    accountId: string,
    secretKey: Uint8Array,
    intervalMs: number = 30000, // 30초마다
    isTestnet: boolean = false
): Promise<void> {
    console.log(`포지션 모니터링 시작 (${intervalMs / 1000}초 간격)`);
    console.log('종료하려면 Ctrl+C를 누르세요.\n');

    const monitor = async () => {
        try {
            const positions = await getAllPositionsInfo(accountId, secretKey, isTestnet);
            printPositionsInfo(positions);

            // 다음 조회 예정 시간 표시
            const nextCheck = new Date(Date.now() + intervalMs);
            console.log(`\n다음 조회: ${nextCheck.toLocaleTimeString()}`);
            console.log('─'.repeat(50));
        } catch (error) {
            console.error('포지션 모니터링 중 오류:', error);
        }
    };

    // 즉시 첫 번째 조회 실행
    await monitor();

    // 주기적 모니터링 시작
    setInterval(monitor, intervalMs);
}

/**
 * 특정 심볼의 포지션만 필터링
 * @param positions - 전체 포지션 데이터
 * @param symbol - 필터링할 심볼
 * @returns 필터링된 포지션
 */
export function filterPositionsBySymbol(positions: PositionSummary, symbol: string): PositionData[] {
    return positions.rows.filter(position =>
        position.symbol.toLowerCase().includes(symbol.toLowerCase())
    );
}

/**
 * 수익 중인 포지션만 필터링
 * @param positions - 전체 포지션 데이터
 * @returns 수익 중인 포지션
 */
export function getProfitablePositions(positions: PositionSummary): PositionData[] {
    return positions.rows.filter(position => position.unsettled_pnl > 0);
}

/**
 * 손실 중인 포지션만 필터링
 * @param positions - 전체 포지션 데이터
 * @returns 손실 중인 포지션
 */
export function getLosingPositions(positions: PositionSummary): PositionData[] {
    return positions.rows.filter(position => position.unsettled_pnl < 0);
}

/**
 * 열린 포지션만 필터링
 * @param positions - 전체 포지션 데이터
 * @returns 열린 포지션만
 */
export function getOpenPositions(positions: PositionSummary): PositionData[] {
    return positions.rows.filter(position => position.position_qty !== 0);
} 