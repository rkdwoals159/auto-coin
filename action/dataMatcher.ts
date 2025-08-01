import { normalizeGateIOSymbol, normalizeOrderlySymbol } from './symbolNormalizer';

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
    const matchedData: MatchedSymbolData[] = [];

    // Gate.io 데이터를 정규화된 심볼로 매핑
    const gateioMap = new Map<string, any>();
    gateioData.forEach(item => {
        const normalizedSymbol = normalizeGateIOSymbol(item.name);
        gateioMap.set(normalizedSymbol, item);
    });

    // Orderly 데이터를 정규화된 심볼로 매핑
    const orderlyMap = new Map<string, any>();
    orderlyData.forEach(item => {
        const normalizedSymbol = normalizeOrderlySymbol(item.symbol);
        orderlyMap.set(normalizedSymbol, item);
    });

    // 공통 심볼 찾기
    const commonSymbols = new Set([...gateioMap.keys(), ...orderlyMap.keys()]);

    commonSymbols.forEach(symbol => {
        const gateioItem = gateioMap.get(symbol);
        const orderlyItem = orderlyMap.get(symbol);

        if (gateioItem && orderlyItem) {
            matchedData.push({
                symbol: symbol,
                gateio_mark_price: gateioItem.mark_price,
                orderly_mark_price: orderlyItem.mark_price
            });
        }
    });

    return matchedData;
}

/**
 * 매칭된 데이터를 기반으로 가격 차이를 분석
 */
export function analyzePriceDifference(matchedData: MatchedSymbolData[]): PriceComparisonData[] {
    return matchedData.map(item => ({
        symbol: item.symbol,
        gateio_price: parseFloat(item.gateio_mark_price),
        orderly_price: item.orderly_mark_price,
        price_difference: Math.abs(parseFloat(item.gateio_mark_price) - item.orderly_mark_price),
        price_difference_percent: Math.abs(parseFloat(item.gateio_mark_price) - item.orderly_mark_price) / parseFloat(item.gateio_mark_price) * 100
    })).sort((a, b) => b.price_difference_percent - a.price_difference_percent);
}

/**
 * 차익거래 기회가 있는 심볼들을 필터링
 * @param threshold - 가격 차이 임계값 (백분율)
 */
export function findArbitrageOpportunities(matchedData: MatchedSymbolData[], threshold: number = 0.5): PriceComparisonData[] {
    const priceComparison = analyzePriceDifference(matchedData);
    return priceComparison.filter(item => item.price_difference_percent >= threshold);
} 