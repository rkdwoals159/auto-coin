import { CommonUtils } from '../utils/commonUtils';
import { getGateIOMarketInfoWith24hAmountFilter } from '../gateio/request/get/getMarketInfoForAllSymbols';
import { getMarketInfoWithSelectedFields } from '../aden/request/get/getMarketInfoForAllSymbols';

/**
 * 공통 코인 데이터 타입
 */
export interface CommonCoinData {
    symbol: string;
    gateio_price: number;
    orderly_price: number;
    avgVolume: number;
    gateio_volume: number;
    orderly_volume: number;
}

/**
 * 가격 비교 데이터 타입
 */
export interface PriceComparisonData {
    symbol: string;
    gateio_price: number;
    orderly_price: number;
    price_difference: number;
    price_difference_percent: number;
}

/**
 * 시장 데이터 처리 결과 타입
 */
export interface MarketDataResult {
    commonCoins: CommonCoinData[];
    priceComparisons: PriceComparisonData[];
    arbitrageOpportunities: PriceComparisonData[];
    totalCommonCoins: number;
    averagePriceDifference: number;
}

/**
 * 통합 데이터 처리 서비스
 * 시장 데이터 조회, 필터링, 분석을 통합하여 관리
 */
export class DataProcessingService {

    /**
     * 공통 코인 데이터 조회 (거래량 필터링 포함)
     */
    async getCommonCoinsData(minAmount: number = 300000): Promise<{ commonCoins: CommonCoinData[] }> {
        try {
            // Gate.io 데이터 조회 (24시간 거래금액 필터링 포함)
            const gateioData = await getGateIOMarketInfoWith24hAmountFilter(
                ['mark_price', 'index_price', 'trade_size', 'quote_volume'],
                minAmount
            );

            // Orderly 데이터 조회 (24시간 거래금액 필터링 포함)
            const orderlyData = await getMarketInfoWithSelectedFields(
                'https://api.orderly.org',
                ['mark_price', 'index_price', '24h_amount']
            );

            // 24시간 거래금액 기준으로 필터링
            const filteredOrderlyData = orderlyData.filter(item => {
                const amount24h = item['24h_amount'] || 0;
                return amount24h >= minAmount;
            });

            // 공통 코인 필터링
            const commonCoins = CommonUtils.coinFiltering.filterCommonCoinsWithVolume(
                gateioData,
                filteredOrderlyData,
                minAmount
            );

            return { commonCoins };
        } catch (error) {
            console.error('공통 코인 데이터 조회 실패:', error);
            return { commonCoins: [] };
        }
    }

    /**
     * 가격 비교 분석 수행
     */
    async analyzePriceDifferences(gateioData: any[], orderlyData: any[]): Promise<MarketDataResult> {
        try {
            // 심볼 매칭
            const matchedSymbols = CommonUtils.dataMatching.matchSymbolData(gateioData, orderlyData);

            // 가격 차이 분석
            const priceComparisons = CommonUtils.dataMatching.analyzePriceDifference(matchedSymbols);

            // 차익거래 기회 찾기 (0.5% 이상)
            const arbitrageOpportunities = priceComparisons.filter(item => item.price_difference_percent >= 0.5);

            // 평균 가격 차이 계산
            const averagePriceDifference = priceComparisons.length > 0
                ? priceComparisons.reduce((sum, item) => sum + item.price_difference_percent, 0) / priceComparisons.length
                : 0;

            return {
                commonCoins: [],
                priceComparisons,
                arbitrageOpportunities,
                totalCommonCoins: matchedSymbols.length,
                averagePriceDifference
            };
        } catch (error) {
            console.error('가격 차이 분석 실패:', error);
            return {
                commonCoins: [],
                priceComparisons: [],
                arbitrageOpportunities: [],
                totalCommonCoins: 0,
                averagePriceDifference: 0
            };
        }
    }

    /**
     * 통합 시장 데이터 처리
     */
    async processMarketData(
        gateioData: any[],
        orderlyData: any[],
        arbitrageThreshold: number = 0.5
    ): Promise<MarketDataResult> {
        try {
            // 공통 코인 필터링
            const commonCoins = CommonUtils.coinFiltering.filterCommonCoinsWithVolume(
                gateioData,
                orderlyData,
                300000 // 기본 최소 거래량
            );

            // 가격 비교 분석
            const matchedSymbols = CommonUtils.dataMatching.matchSymbolData(gateioData, orderlyData);
            const priceComparisons = CommonUtils.dataMatching.analyzePriceDifference(matchedSymbols);

            // 차익거래 기회 찾기
            const arbitrageOpportunities = priceComparisons.filter(item => item.price_difference_percent >= arbitrageThreshold);

            // 평균 가격 차이 계산
            const averagePriceDifference = priceComparisons.length > 0
                ? priceComparisons.reduce((sum, item) => sum + item.price_difference_percent, 0) / priceComparisons.length
                : 0;

            return {
                commonCoins,
                priceComparisons,
                arbitrageOpportunities,
                totalCommonCoins: commonCoins.length,
                averagePriceDifference
            };
        } catch (error) {
            console.error('시장 데이터 처리 실패:', error);
            return {
                commonCoins: [],
                priceComparisons: [],
                arbitrageOpportunities: [],
                totalCommonCoins: 0,
                averagePriceDifference: 0
            };
        }
    }

    /**
     * 레거시 호환성을 위한 메서드
     */
    async processMarketDataLegacy(
        gateioData: any[],
        orderlyData: any[],
        arbitrageThreshold: number = 0.5
    ): Promise<{
        priceComparison: PriceComparisonData[];
        arbitrageOpportunities: PriceComparisonData[];
        totalMatchedSymbols: number;
        averagePriceDifference: number;
    }> {
        const result = await this.processMarketData(gateioData, orderlyData, arbitrageThreshold);
        return {
            priceComparison: result.priceComparisons,
            arbitrageOpportunities: result.arbitrageOpportunities,
            totalMatchedSymbols: result.totalCommonCoins,
            averagePriceDifference: result.averagePriceDifference
        };
    }

    /**
     * 필터링 결과 출력
     */
    printFilteringResults(commonCoins: CommonCoinData[], minVolume: number): void {
        console.log(`\n=== 공통 코인 필터링 결과 ===`);
        console.log(`최소 거래금액: ${minVolume.toLocaleString()} USDT`);
        console.log(`공통 코인 수: ${commonCoins.length}개`);

        if (commonCoins.length > 0) {
            console.log(`\n상위 5개 코인:`);
            commonCoins.slice(0, 5).forEach((coin, index) => {
                console.log(`${index + 1}. ${coin.symbol} - 평균 거래량: ${coin.avgVolume.toLocaleString()} USDT`);
            });
        } else {
            console.log(`⚠️  조건을 만족하는 공통 코인이 없습니다.`);
        }
        console.log('---');
    }
} 