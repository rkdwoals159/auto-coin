import { matchSymbolData, analyzePriceDifference, findArbitrageOpportunities, MatchedSymbolData, PriceComparisonData } from './dataMatcher';

/**
 * 시장 데이터 처리 결과 타입
 */
export interface MarketDataResult {
    matchedSymbols: MatchedSymbolData[];
    priceComparison: PriceComparisonData[];
    arbitrageOpportunities: PriceComparisonData[];
    totalMatchedSymbols: number;
    averagePriceDifference: number;
}



/**
 * 두 거래소의 시장 데이터를 처리하고 분석
 */
export async function processMarketData(
    gateioData: any[],
    orderlyData: any[],
    arbitrageThreshold: number = 0.5
): Promise<MarketDataResult> {

    // 심볼 매칭
    const matchedSymbols = matchSymbolData(gateioData, orderlyData);

    // 가격 차이 분석
    const priceComparison = analyzePriceDifference(matchedSymbols);

    // 차익거래 기회 찾기
    const arbitrageOpportunities = findArbitrageOpportunities(matchedSymbols, arbitrageThreshold);

    // 평균 가격 차이 계산
    const averagePriceDifference = priceComparison.length > 0
        ? priceComparison.reduce((sum, item) => sum + item.price_difference_percent, 0) / priceComparison.length
        : 0;

    return {
        matchedSymbols,
        priceComparison,
        arbitrageOpportunities,
        totalMatchedSymbols: matchedSymbols.length,
        averagePriceDifference
    };
}

