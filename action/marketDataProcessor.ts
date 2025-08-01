import { matchSymbolData, analyzePriceDifference, findArbitrageOpportunities, MatchedSymbolData, PriceComparisonData } from './dataMatcher';
import { formatPriceComparisonArray, KoreanPriceComparisonData } from './dataFormatter';

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
 * 한국어 key를 포함한 시장 데이터 결과 타입
 */
export interface KoreanMarketDataResult {
    matchedSymbols: MatchedSymbolData[];
    priceComparison: KoreanPriceComparisonData[];
    arbitrageOpportunities: KoreanPriceComparisonData[];
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

/**
 * 시장 데이터 결과를 콘솔에 출력
 */
export function printMarketDataResult(result: MarketDataResult): void {
    console.log('\n=== 시장 데이터 분석 결과 ===');
    console.log(`총 매칭된 심볼 수: ${result.totalMatchedSymbols}`);
    console.log(`평균 가격 차이: ${result.averagePriceDifference.toFixed(4)}%`);
    console.log(`차익거래 기회 수: ${result.arbitrageOpportunities.length}`);

    if (result.arbitrageOpportunities.length > 0) {
        console.log('\n=== 차익거래 기회 (임계값 이상) ===');
        const koreanArbitrage = formatPriceComparisonArray(result.arbitrageOpportunities.slice(0, 10));
        console.log(JSON.stringify(koreanArbitrage, null, 2));
    }

    console.log('\n=== 가격 차이가 큰 순서 (상위 10개) ===');
    const koreanPriceComparison = formatPriceComparisonArray(result.priceComparison.slice(0, 10));
    console.log(JSON.stringify(koreanPriceComparison, null, 2));
}

/**
 * 특정 심볼의 상세 정보 출력
 */
export function printSymbolDetail(symbol: string, result: MarketDataResult): void {
    const symbolData = result.matchedSymbols.find(item => item.symbol === symbol);
    const priceData = result.priceComparison.find(item => item.symbol === symbol);

    if (symbolData && priceData) {
        console.log(`\n=== ${symbol} 상세 정보 ===`);
        console.log(`Gate.io 가격: ${symbolData.gateio_mark_price}`);
        console.log(`Orderly 가격: ${symbolData.gateio_mark_price}`);
        console.log(`가격 차이: ${priceData.price_difference.toFixed(6)}`);
        console.log(`가격 차이율: ${priceData.price_difference_percent.toFixed(4)}%`);
    } else {
        console.log(`\n${symbol} 심볼을 찾을 수 없습니다.`);
    }
} 