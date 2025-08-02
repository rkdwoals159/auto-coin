import { processMarketData, MarketDataResult } from './marketDataProcessor';
import { HighestPriceDifferenceData, MarketMonitoringResult } from '../types/common';

/**
 * 가격 모니터링 클래스
 */
export class PriceMonitor {
    private startTime: Date;
    private highestPriceDifference: HighestPriceDifferenceData | null = null;
    private allPriceDifferences: HighestPriceDifferenceData[] = [];
    private totalExecutions: number = 0;

    constructor() {
        this.startTime = new Date();
    }

    /**
     * 단일 모니터링 실행
     * @returns 일시중단 여부 (가격차이율이 임계값을 넘으면 true)
     */
    async executeMonitoring(gateioData: any[], orderlyData: any[], pauseThreshold: number): Promise<boolean> {
        const marketDataResult = await processMarketData(gateioData, orderlyData, 0.1);

        if (marketDataResult.priceComparison.length > 0) {
            const highestDifference = marketDataResult.priceComparison[0]; // 이미 정렬되어 있음

            // 24시간 거래금액 정보 찾기
            const { normalizeGateIOSymbol, normalizeOrderlySymbol } = await import('./symbolNormalizer');

            const gateioItem = gateioData.find(item => {
                const normalizedSymbol = normalizeGateIOSymbol(item.symbol || item.name);
                return normalizedSymbol === highestDifference.symbol;
            });

            const orderlyItem = orderlyData.find(item => {
                const normalizedSymbol = normalizeOrderlySymbol(item.symbol);
                return normalizedSymbol === highestDifference.symbol;
            });

            const gateioVolume = gateioItem ? (gateioItem as any).quote_volume || 0 : 0;
            const orderlyVolume = orderlyItem ? orderlyItem['24h_amount'] || 0 : 0;

            const priceDifferenceData: HighestPriceDifferenceData = {
                timestamp: new Date(),
                coin: highestDifference.symbol,
                gateio_price: highestDifference.gateio_price,
                orderly_price: highestDifference.orderly_price,
                price_difference: highestDifference.price_difference,
                price_difference_percent: highestDifference.price_difference_percent
            };

            this.allPriceDifferences.push(priceDifferenceData);

            // 최고 가격차이율 업데이트
            if (!this.highestPriceDifference ||
                priceDifferenceData.price_difference_percent > this.highestPriceDifference.price_difference_percent) {
                this.highestPriceDifference = priceDifferenceData;

                console.log(`\n새로운 최고 가격차이율 발견!`);
                console.log(`시간: ${priceDifferenceData.timestamp.toLocaleString()}`);
                console.log(`코인: ${priceDifferenceData.coin}`);
                console.log(`가격차이율: ${priceDifferenceData.price_difference_percent.toFixed(4)}%`);
                console.log(`Gate.io 가격: ${priceDifferenceData.gateio_price}`);
                console.log(`Orderly 가격: ${priceDifferenceData.orderly_price}`);
                console.log(`Gate.io 24시간 거래금액: ${gateioVolume.toLocaleString()} USDT`);
                console.log(`Orderly 24시간 거래금액: ${orderlyVolume.toLocaleString()} USDT`);
                console.log('---');
            }

            // 가격차이율이 임계값을 넘으면 일시중단 신호 반환
            return priceDifferenceData.price_difference_percent > pauseThreshold;
        }

        return false;
    }

    /**
     * 평균 가격차이율 계산
     */
    calculateAveragePriceDifference(): number {
        if (this.allPriceDifferences.length === 0) return 0;

        const sum = this.allPriceDifferences.reduce((acc, data) => acc + data.price_difference_percent, 0);
        return sum / this.allPriceDifferences.length;
    }

    /**
     * 최고 가격차이율 데이터 조회
     */
    getHighestPriceDifference(): HighestPriceDifferenceData | null {
        return this.highestPriceDifference;
    }

    /**
     * 총 실행 횟수 증가
     */
    incrementTotalExecutions(): void {
        this.totalExecutions++;
    }

    /**
     * 총 실행 횟수 조회
     */
    getTotalExecutions(): number {
        return this.totalExecutions;
    }

    /**
     * 시작 시간 조회
     */
    getStartTime(): Date {
        return this.startTime;
    }

    /**
     * 모든 가격차이율 데이터 조회
     */
    getAllPriceDifferences(): HighestPriceDifferenceData[] {
        return this.allPriceDifferences;
    }
} 