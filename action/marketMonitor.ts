import { processMarketData, MarketDataResult } from './marketDataProcessor';
// import { KoreanPriceComparisonData } from './dataFormatter';

/**
 * 최고 가격차이율 데이터 타입
 */
export interface HighestPriceDifferenceData {
    timestamp: Date;
    coin: string;
    gateio_price: number;
    orderly_price: number;
    price_difference: number;
    price_difference_percent: number;
}

/**
 * 시장 모니터링 결과 타입
 */
export interface MarketMonitoringResult {
    startTime: Date;
    endTime: Date;
    totalExecutions: number;
    highestPriceDifference: HighestPriceDifferenceData | null;
    averagePriceDifference: number;
    allPriceDifferences: HighestPriceDifferenceData[];
}

/**
 * 시장 데이터를 모니터링하고 최고 가격차이율을 추적
 */
export class MarketMonitor {
    private startTime: Date;
    private highestPriceDifference: HighestPriceDifferenceData | null = null;
    private allPriceDifferences: HighestPriceDifferenceData[] = [];
    private totalExecutions: number = 0;
    private isRunning: boolean = false;

    constructor() {
        this.startTime = new Date();
    }

    /**
 * 지정된 시간 동안 1초마다 시장 데이터를 모니터링
 */
    async startMonitoring(
        getGateioData: () => Promise<any[]>,
        getOrderlyData: () => Promise<any[]>,
        durationHours: number = 0.1, // 테스트용 6분
        pauseThreshold: number = 0.5 // 가격차이율 임계값 (0.5%)
    ): Promise<MarketMonitoringResult> {
        this.isRunning = true;
        const durationMs = durationHours * 60 * 60 * 1000; // 3시간을 밀리초로
        const intervalMs = 1000; // 1초

        console.log(`시장 모니터링 시작: ${this.startTime.toLocaleString()}`);
        console.log(`모니터링 시간: ${durationHours}시간`);
        console.log(`실행 간격: ${intervalMs}ms`);
        console.log(`일시중단 임계값: ${pauseThreshold}%`);

        const endTime = new Date(this.startTime.getTime() + durationMs);

        while (this.isRunning && new Date() < endTime) {
            try {
                // 매번 새로운 API 데이터 가져오기
                const gateioData = await getGateioData();
                const orderlyData = await getOrderlyData();

                const shouldPause = await this.executeMonitoring(gateioData, orderlyData, pauseThreshold);
                this.totalExecutions++;

                // 가격차이율이 임계값을 넘으면 일시 중단
                if (shouldPause) {
                    console.log(`\n⚠️  가격차이율이 ${pauseThreshold}%를 초과했습니다!`);
                    console.log(`모니터링을 일시 중단합니다...`);
                    console.log(`현재 시간: ${new Date().toLocaleString()}`);
                    console.log('---');

                    // 30초 대기 후 계속
                    await new Promise(resolve => setTimeout(resolve, 30000));
                    console.log(`모니터링을 재개합니다...`);
                }

                // 진행 상황 출력 (1분마다)
                if (this.totalExecutions % 60 === 0) {
                    const elapsedMinutes = Math.floor(this.totalExecutions / 60);
                    console.log(`진행 상황: ${elapsedMinutes}분 경과, 총 실행 횟수: ${this.totalExecutions}`);
                }

                // 1초 대기
                await new Promise(resolve => setTimeout(resolve, intervalMs));
            } catch (error) {
                console.error('모니터링 실행 중 에러:', error);
                await new Promise(resolve => setTimeout(resolve, intervalMs));
            }
        }

        this.isRunning = false;
        const finalEndTime = new Date();

        console.log(`모니터링 완료: ${finalEndTime.toLocaleString()}`);
        console.log(`총 실행 횟수: ${this.totalExecutions}`);

        return {
            startTime: this.startTime,
            endTime: finalEndTime,
            totalExecutions: this.totalExecutions,
            highestPriceDifference: this.highestPriceDifference,
            averagePriceDifference: this.calculateAveragePriceDifference(),
            allPriceDifferences: this.allPriceDifferences
        };
    }

    /**
     * 모니터링 중단
     */
    stopMonitoring(): void {
        this.isRunning = false;
    }

    /**
     * 단일 모니터링 실행
     * @returns 일시중단 여부 (가격차이율이 임계값을 넘으면 true)
     */
    private async executeMonitoring(gateioData: any[], orderlyData: any[], pauseThreshold: number): Promise<boolean> {
        const marketDataResult = await processMarketData(gateioData, orderlyData, 0.1);

        if (marketDataResult.priceComparison.length > 0) {
            const highestDifference = marketDataResult.priceComparison[0]; // 이미 정렬되어 있음

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
    private calculateAveragePriceDifference(): number {
        if (this.allPriceDifferences.length === 0) return 0;

        const sum = this.allPriceDifferences.reduce((acc, data) => acc + data.price_difference_percent, 0);
        return sum / this.allPriceDifferences.length;
    }

    /**
     * 모니터링 결과 출력
     */
    printMonitoringResult(result: MarketMonitoringResult): void {
        console.log('\n=== 시장 모니터링 최종 결과 ===');
        console.log(`시작 시간: ${result.startTime.toLocaleString()}`);
        console.log(`종료 시간: ${result.endTime.toLocaleString()}`);
        console.log(`총 실행 횟수: ${result.totalExecutions}`);
        console.log(`평균 가격차이율: ${result.averagePriceDifference.toFixed(4)}%`);

        if (result.highestPriceDifference) {
            console.log('\n=== 최고 가격차이율 데이터 ===');
            console.log(`발견 시간: ${result.highestPriceDifference.timestamp.toLocaleString()}`);
            console.log(`코인: ${result.highestPriceDifference.coin}`);
            console.log(`Gate.io 가격: ${result.highestPriceDifference.gateio_price}`);
            console.log(`Orderly 가격: ${result.highestPriceDifference.orderly_price}`);
            console.log(`가격 차이: ${result.highestPriceDifference.price_difference.toFixed(6)}`);
            console.log(`가격차이율: ${result.highestPriceDifference.price_difference_percent.toFixed(4)}%`);
        }
    }
} 