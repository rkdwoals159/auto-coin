import { CommonUtils } from '../utils/commonUtils';

/**
 * 심볼 매칭 결과 타입
 */
export interface MatchedSymbolData {
    symbol: string;
    gateio_mark_price: string;
    orderly_mark_price: number;
}

/**
 * 가격 비교 결과 타입
 */
export interface PriceComparisonData {
    symbol: string;
    gateio_price: number;
    orderly_price: number;
    price_difference: number;
    price_difference_percent: number;
}

/**
 * 두 API의 데이터를 매칭하여 같은 심볼끼리 비교
 */
export function matchSymbolData(gateioData: any[], orderlyData: any[]): MatchedSymbolData[] {
    return CommonUtils.dataMatching.matchSymbolData(gateioData, orderlyData);
}

/**
 * 매칭된 데이터를 기반으로 가격 차이를 분석
 */
export function analyzePriceDifference(matchedData: MatchedSymbolData[]): PriceComparisonData[] {
    return CommonUtils.dataMatching.analyzePriceDifference(matchedData);
}

/**
 * 차익거래 기회가 있는 심볼들을 필터링
 * @param threshold - 가격 차이 임계값 (백분율)
 */
export function findArbitrageOpportunities(matchedData: MatchedSymbolData[], threshold: number = 0.5): PriceComparisonData[] {
    const priceComparison = analyzePriceDifference(matchedData);
    return priceComparison.filter(item => item.price_difference_percent >= threshold);
} 