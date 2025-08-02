import { getAllPositionsInfo } from '../aden/request/get/getAllPositionsInfo';
import { autoClosePosition, printClosePositionResult } from '../aden/request/post/closePosition';
import { ApiClient } from '../services/apiClient';

/**
 * 포지션 진입 시점 가격 정보
 */
export interface PositionEntryPrice {
    orderlyPrice: number;
    gateioPrice: number;
}

/**
 * 포지션 관리자 클래스
 */
export class PositionManager {
    private positionEntryPriceDifferences: Map<string, PositionEntryPrice> = new Map();
    private apiClient: ApiClient;

    constructor() {
        this.apiClient = new ApiClient();
    }

    /**
     * 포지션 진입 가격 정보 저장
     */
    setPositionEntryPrice(symbol: string, orderlyPrice: number, gateioPrice: number): void {
        this.positionEntryPriceDifferences.set(symbol, { orderlyPrice, gateioPrice });
        console.log(`📝 ${symbol} 포지션 진입 가격 저장: Orderly ${orderlyPrice}, Gate.io ${gateioPrice}`);
    }

    /**
     * 포지션 진입 가격 정보 조회
     */
    getPositionEntryPrice(symbol: string): PositionEntryPrice | undefined {
        return this.positionEntryPriceDifferences.get(symbol);
    }

    /**
     * 포지션 진입 가격 정보 삭제
     */
    removePositionEntryPrice(symbol: string): void {
        this.positionEntryPriceDifferences.delete(symbol);
    }

    /**
     * 현재 Gate.io 가격 조회
     */
    getCurrentGateioPrice(symbol: string, gateioData: any[]): number | null {
        const { normalizeGateIOSymbol } = require('./symbolNormalizer');
        const normalizedSymbol = normalizeGateIOSymbol(symbol.replace('PERP_', '').replace('_USDC', '') + '_USDT');

        const gateioItem = gateioData.find(item => {
            const itemSymbol = normalizeGateIOSymbol(item.symbol || item.name);
            return itemSymbol === normalizedSymbol;
        });

        if (!gateioItem) return null;

        const price = gateioItem.mark_price || gateioItem.price;
        if (!price) return null;

        // 문자열을 숫자로 변환
        const numericPrice = typeof price === 'string' ? parseFloat(price) : price;
        return isNaN(numericPrice) ? null : numericPrice;
    }

    /**
     * 포지션 종료 조건 확인 및 실행
     */
    async checkAndClosePositions(
        orderlyAuth: { accountId: string; secretKey: Uint8Array },
        gateioData: any[]
    ): Promise<void> {
        console.log('\n=== 포지션 종료 조건 체크 ===');
        const currentPositions = await getAllPositionsInfo(orderlyAuth.accountId, orderlyAuth.secretKey, false);

        if (currentPositions && currentPositions.rows.length > 0) {
            for (const position of currentPositions.rows) {
                if (position.position_qty === 0) continue;

                const currentPriceDiff = this.getPositionEntryPrice(position.symbol);
                if (currentPriceDiff) {
                    await this.checkPositionForClose(position, currentPriceDiff, gateioData, orderlyAuth);
                }
            }
        }
    }

    /**
     * 개별 포지션 종료 조건 확인
     */
    private async checkPositionForClose(
        position: any,
        entryPrice: PositionEntryPrice,
        gateioData: any[],
        orderlyAuth: { accountId: string; secretKey: Uint8Array }
    ): Promise<void> {
        const marketInfo = await this.apiClient.getOrderlyMarketData(['mark_price']);
        const symbolInfo = marketInfo.find(item => item.symbol === position.symbol);

        if (symbolInfo && symbolInfo.mark_price) {
            const currentOrderlyPrice = symbolInfo.mark_price;
            const currentGateioPrice = this.getCurrentGateioPrice(position.symbol, gateioData);

            if (currentGateioPrice) {
                console.log(`${position.symbol}: 현재 Orderly ${currentOrderlyPrice}, Gate.io ${currentGateioPrice}`);
                console.log(`${position.symbol}: 진입 시 Orderly ${entryPrice.orderlyPrice}, Gate.io ${entryPrice.gateioPrice}`);

                // 가격차이율 반전 확인
                const entryOrderlyHigher = entryPrice.orderlyPrice > entryPrice.gateioPrice;
                const currentOrderlyHigher = currentOrderlyPrice > currentGateioPrice;

                if (entryOrderlyHigher !== currentOrderlyHigher) {
                    console.log(`\n⚠️ 가격차이율 반전! ${position.symbol} 포지션 종료`);
                    console.log(`진입 시: Orderly ${entryOrderlyHigher ? '높음' : '낮음'}`);
                    console.log(`현재: Orderly ${currentOrderlyHigher ? '높음' : '낮음'}`);
                    console.log(`수량: ${position.position_qty}`);

                    const closeResult = await autoClosePosition(
                        position.symbol,
                        orderlyAuth.accountId,
                        orderlyAuth.secretKey,
                        'MARKET',
                        false
                    );

                    printClosePositionResult(closeResult);

                    // 포지션 종료 후 진입 가격 정보 삭제
                    this.removePositionEntryPrice(position.symbol);
                }
            }
        }
    }

    /**
     * 포지션 모니터링
     */
    async monitorPositions(
        orderlyAuth: { accountId: string; secretKey: Uint8Array },
        gateioData: any[],
        endTime: Date,
        isRunning: boolean
    ): Promise<void> {
        console.log('\n=== 포지션 모니터링 시작 ===');
        let positionClosed = false;
        let monitoringCount = 0;

        while (!positionClosed && isRunning && new Date() < endTime) {
            try {
                const checkPositions = await getAllPositionsInfo(orderlyAuth.accountId, orderlyAuth.secretKey, false);
                const activePositions = checkPositions?.rows.filter(p => p.position_qty !== 0) || [];

                monitoringCount++;

                if (activePositions.length === 0) {
                    console.log('✅ 모든 포지션이 종료되었습니다. 모니터링을 재개합니다.');
                    positionClosed = true;
                    break;
                }

                // 각 활성 포지션에 대해 종료 조건 확인
                for (const position of activePositions) {
                    const currentPriceDiff = this.getPositionEntryPrice(position.symbol);
                    if (currentPriceDiff) {
                        await this.checkPositionForClose(position, currentPriceDiff, gateioData, orderlyAuth);
                    }
                }

                // 10초마다 포지션 상태 확인
                await new Promise(resolve => setTimeout(resolve, 10000));

                // 진행 상황 출력 (1분마다 - 6회마다)
                if (monitoringCount % 6 === 0) {
                    console.log(`포지션 모니터링 중... 활성 포지션: ${activePositions.length}개 (${monitoringCount * 10}초 경과)`);

                    // 각 활성 포지션의 상세 정보 출력
                    for (const position of activePositions) {
                        const currentPriceDiff = this.getPositionEntryPrice(position.symbol);
                        if (currentPriceDiff) {
                            await this.printPositionDetails(position, currentPriceDiff, gateioData);
                        }
                    }
                }

            } catch (error: any) {
                console.error('포지션 모니터링 중 에러:', error);
                await new Promise(resolve => setTimeout(resolve, 10000));
            }
        }
    }

    /**
     * 포지션 상세 정보 출력
     */
    private async printPositionDetails(
        position: any,
        entryPrice: PositionEntryPrice,
        gateioData: any[]
    ): Promise<void> {
        const marketInfo = await this.apiClient.getOrderlyMarketData(['mark_price']);
        const symbolInfo = marketInfo.find(item => item.symbol === position.symbol);

        if (symbolInfo && symbolInfo.mark_price) {
            const currentOrderlyPrice = symbolInfo.mark_price;
            const currentGateioPrice = this.getCurrentGateioPrice(position.symbol, gateioData);

            if (currentGateioPrice) {
                const entryOrderlyHigher = entryPrice.orderlyPrice > entryPrice.gateioPrice;
                const currentOrderlyHigher = currentOrderlyPrice > currentGateioPrice;

                // 현재 가격차이율 계산
                const currentPriceDiffPercent = Math.abs(currentOrderlyPrice - currentGateioPrice) / currentGateioPrice * 100;
                const entryPriceDiffPercent = Math.abs(entryPrice.orderlyPrice - entryPrice.gateioPrice) / entryPrice.gateioPrice * 100;

                console.log(`  📊 ${position.symbol}:`);
                console.log(`    진입 시 - Orderly: ${entryPrice.orderlyPrice.toFixed(6)}, Gate.io: ${entryPrice.gateioPrice.toFixed(6)} (차이: ${entryPriceDiffPercent.toFixed(4)}%)`);
                console.log(`    현재 - Orderly: ${currentOrderlyPrice.toFixed(6)}, Gate.io: ${currentGateioPrice.toFixed(6)} (차이: ${currentPriceDiffPercent.toFixed(4)}%)`);
                console.log(`    포지션: ${position.position_qty} (${position.position_qty > 0 ? '롱' : '숏'})`);
                console.log(`    가격차이율 반전: ${entryOrderlyHigher !== currentOrderlyHigher ? '⚠️ 반전됨' : '🟢 유지'}`);
            } else {
                console.log(`  📊 ${position.symbol}: Gate.io 가격 조회 실패 (${currentGateioPrice})`);
            }
        }
    }
} 