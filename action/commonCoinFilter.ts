import { normalizeGateIOSymbol, normalizeOrderlySymbol } from './symbolNormalizer';
import { SelectedGateIOMarketInfo } from '../gateio/request/get/getMarketInfoForAllSymbols';
import { SelectedMarketInfo } from '../aden/request/get/getMarketInfoForAllSymbols';
import { CommonCoinData } from '../types/common';

/**
 * 두 거래소의 데이터에서 공통 코인을 찾고 거래금액 기준을 적용합니다.
 * 
 * @param gateioData - Gate.io 데이터
 * @param orderlyData - Orderly 데이터
 * @param minAmount - 최소 거래금액 (기본값: 300000)
 * @returns CommonCoinData[] - 공통 코인 데이터
 */
export function filterCommonCoinsWithVolume(
    gateioData: SelectedGateIOMarketInfo[],
    orderlyData: SelectedMarketInfo[],
    minAmount: number = 300000
): CommonCoinData[] {
    // Gate.io 데이터를 정규화된 심볼로 매핑
    const gateioMap = new Map<string, SelectedGateIOMarketInfo>();
    gateioData.forEach(item => {
        const normalizedSymbol = normalizeGateIOSymbol(item.name);
        gateioMap.set(normalizedSymbol, item);
    });

    // Orderly 데이터를 정규화된 심볼로 매핑
    const orderlyMap = new Map<string, SelectedMarketInfo>();
    orderlyData.forEach(item => {
        const normalizedSymbol = normalizeOrderlySymbol(item.symbol);
        orderlyMap.set(normalizedSymbol, item);
    });

    // 공통 심볼 찾기
    const commonSymbols = new Set([...gateioMap.keys(), ...orderlyMap.keys()]);

    const commonCoins: CommonCoinData[] = [];

    // 공통 심볼에 대해 거래량 조건 확인
    for (const symbol of commonSymbols) {
        const gateioItem = gateioMap.get(symbol);
        const orderlyItem = orderlyMap.get(symbol);

        if (gateioItem && orderlyItem) {
            const gateioVolume = (gateioItem as any).quote_volume || 0;
            const orderlyVolume = orderlyItem['24h_amount'] || 0;

            // 두 거래소 모두에서 최소 거래량을 만족하는 경우만 포함
            if (gateioVolume >= minAmount && orderlyVolume >= minAmount) {
                const avgVolume = (gateioVolume + orderlyVolume) / 2;
                commonCoins.push({
                    symbol: symbol,
                    gateio_price: gateioItem.mark_price,
                    orderly_price: orderlyItem.mark_price,
                    avgVolume: avgVolume,
                    gateio_volume: gateioVolume,
                    orderly_volume: orderlyVolume
                });
                // console.log(`✅ ${symbol} 매칭 성공! 평균 거래량: ${avgVolume.toLocaleString()}`);
            }
        }
    }

    // console.log(`🎯 최종 공통 코인 수: ${commonCoins.length}개`);
    return commonCoins;
}

/**
 * 필터링 결과를 출력합니다.
 * 
 * @param commonCoins - 공통 코인 데이터
 * @param minVolume - 최소 거래량
 */
export function printFilteringResults(commonCoins: CommonCoinData[], minVolume: number): void {
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