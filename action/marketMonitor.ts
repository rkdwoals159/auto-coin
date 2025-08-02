import { processMarketData, MarketDataResult } from './marketDataProcessor';
import { getOrderlyOrderbook, printOrderbook } from '../aden/request/get/orderlyOrderbook';
import getFuturesOrderBook from '../gateio/request/get/getFuturesOrderBook';
import { HighestPriceDifferenceData, MarketMonitoringResult } from '../types/common';

/**
 * Gate.io 실제 orderbook 응답 타입
 */
interface GateIOOrderBookEntry {
    p: string; // price
    s: string; // size
}

interface GateIOOrderBookResponse {
    current: number;
    update: number;
    asks: GateIOOrderBookEntry[];
    bids: GateIOOrderBookEntry[];
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
        pauseThreshold: number = 0.5, // 가격차이율 임계값 (0.5%)
        orderlyAccountId?: string,
        orderlyApiKey?: string,
        orderlySecretKey?: Uint8Array,
        orderbookMaxLevel: number = 3,
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

                // 가격차이율이 임계값을 넘으면 orderbook 분석 수행
                if (shouldPause) {
                    console.log(`\n⚠️  가격차이율이 ${pauseThreshold}%를 초과했습니다!`);
                    console.log(`모니터링을 일시 중단하고 orderbook 분석을 시작합니다...`);
                    console.log(`현재 시간: ${new Date().toLocaleString()}`);
                    console.log('---');

                    // 현재 최고 가격차이율 데이터로 orderbook 분석
                    if (this.highestPriceDifference && orderlyAccountId && orderlyApiKey && orderlySecretKey) {
                        await this.analyzeOrderbookForHighPriceDifference(
                            this.highestPriceDifference,
                            orderlyAccountId,
                            orderlyApiKey,
                            orderlySecretKey,
                            orderbookMaxLevel
                        );
                    } else {
                        console.log('❌ Orderly API 인증 정보가 없어 orderbook 분석을 건너뜁니다.');
                    }

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
            } catch (error: any) {
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
    private calculateAveragePriceDifference(): number {
        if (this.allPriceDifferences.length === 0) return 0;

        const sum = this.allPriceDifferences.reduce((acc, data) => acc + data.price_difference_percent, 0);
        return sum / this.allPriceDifferences.length;
    }

    /**
     * 가격차이율이 높은 코인의 orderbook 조회
     */
    private async analyzeOrderbookForHighPriceDifference(
        highestDifference: HighestPriceDifferenceData,
        orderlyAccountId: string,
        orderlyApiKey: string,
        orderlySecretKey: Uint8Array,
        orderbookMaxLevel: number
    ): Promise<void> {
        try {
            console.log(`\n🔍 ${highestDifference.coin}의 orderbook 분석 시작...`);
            console.log(`가격차이율: ${highestDifference.price_difference_percent.toFixed(4)}%`);
            console.log(`Gate.io 가격: ${highestDifference.gateio_price}`);
            console.log(`Orderly 가격: ${highestDifference.orderly_price}`);

            // 코인 심볼 변환 (예: BTC -> PERP_BTC_USDT)
            const coinSymbol = 'PERP_' + highestDifference.coin.replace('USDC', '') + '_USDC'; // Orderly는 PERP_BTC_USDC 형식 사용
            const gateioContract = highestDifference.coin.replace('USDT', '') + '_USDT'; // Gate.io는 BTC_USDT 형식 사용

            console.log(`\n📊 Gate.io ${gateioContract} orderbook 조회 중...`);

            // Gate.io orderbook 조회
            const gateioOrderbook = await getFuturesOrderBook('usdt', gateioContract, orderbookMaxLevel) as unknown as GateIOOrderBookResponse;

            console.log(`✅ Gate.io orderbook 조회 성공`);
            // console.log(`Asks 수: ${gateioOrderbook.asks.length}`);
            // console.log(`Bids 수: ${gateioOrderbook.bids.length}`);
            // console.log(`타임스탬프: ${gateioOrderbook.current}`);
            // console.log(`응답 데이터 샘플:`, JSON.stringify(gateioOrderbook, null, 2));

            // Gate.io orderbook 출력
            console.log(`\n=== Gate.io ${gateioContract} Orderbook ===`);
            console.log(`타임스탬프: ${gateioOrderbook.current}`);

            console.log('\n--- Asks (매도) ---');
            gateioOrderbook.asks.slice(0, 10).forEach((ask, index) => {
                console.log(`${index + 1}. 가격: ${parseFloat(ask.p).toFixed(4)}, 수량: ${parseFloat(ask.s).toFixed(6)}`);
            });

            console.log('\n--- Bids (매수) ---');
            gateioOrderbook.bids.slice(0, 10).forEach((bid, index) => {
                console.log(`${index + 1}. 가격: ${parseFloat(bid.p).toFixed(4)}, 수량: ${parseFloat(bid.s).toFixed(6)}`);
            });

            // Gate.io 스프레드 계산
            if (gateioOrderbook.asks.length > 0 && gateioOrderbook.bids.length > 0) {
                const bestAsk = parseFloat(gateioOrderbook.asks[0].p);
                const bestBid = parseFloat(gateioOrderbook.bids[0].p);
                const spread = bestAsk - bestBid;
                const spreadPercent = (spread / bestAsk) * 100;

                console.log(`\nGate.io 스프레드: ${spread.toFixed(4)} (${spreadPercent.toFixed(4)}%)`);
            }

            console.log(`\n📊 Orderly ${coinSymbol} orderbook 조회 중...`);
            // Orderly orderbook 조회
            const orderlyOrderbook = await getOrderlyOrderbook(
                coinSymbol,
                orderlyAccountId,
                orderlySecretKey,
                orderbookMaxLevel,
                false
            );

            console.log(`✅ Orderly orderbook 조회 성공`);
            printOrderbook(orderlyOrderbook, coinSymbol);

            // 거래소별 가격 비교 및 분석
            console.log(`\n📈 거래소별 가격 분석:`);
            console.log(`Gate.io 현재가: ${highestDifference.gateio_price}`);
            console.log(`Orderly 현재가: ${highestDifference.orderly_price}`);

            if (highestDifference.gateio_price < highestDifference.orderly_price) {
                console.log(`\n💰 차익거래 기회 발견!`);
                console.log(`Gate.io에서 매수 → Orderly에서 매도`);
                console.log(`예상 수익률: ${highestDifference.price_difference_percent.toFixed(4)}%`);

                // Gate.io 매수 물량 분석
                const gateioBuyVolume = gateioOrderbook.bids.slice(0, 5).reduce((sum, bid) => sum + parseFloat(bid.s), 0);
                console.log(`Gate.io 상위 5개 매수 물량 합계: ${gateioBuyVolume.toFixed(6)}`);

                // Orderly 매도 물량 분석
                const orderlySellVolume = orderlyOrderbook.asks.slice(0, 5).reduce((sum, ask) => sum + ask.quantity, 0);
                console.log(`Orderly 상위 5개 매도 물량 합계: ${orderlySellVolume.toFixed(6)}`);

            } else {
                console.log(`\n💰 차익거래 기회 발견!`);
                console.log(`Orderly에서 매수 → Gate.io에서 매도`);
                console.log(`예상 수익률: ${highestDifference.price_difference_percent.toFixed(4)}%`);

                // Orderly 매수 물량 분석
                const orderlyBuyVolume = orderlyOrderbook.bids.slice(0, 5).reduce((sum, bid) => sum + bid.quantity, 0);
                console.log(`Orderly 상위 5개 매수 물량 합계: ${orderlyBuyVolume.toFixed(6)}`);

                // Gate.io 매도 물량 분석
                const gateioSellVolume = gateioOrderbook.asks.slice(0, 5).reduce((sum, ask) => sum + parseFloat(ask.s), 0);
                console.log(`Gate.io 상위 5개 매도 물량 합계: ${gateioSellVolume.toFixed(6)}`);
            }

        } catch (error: any) {
            console.error(`❌ Orderbook 분석 중 오류:`, error.message);
        }
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