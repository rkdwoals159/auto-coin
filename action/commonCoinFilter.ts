import { CommonUtils } from '../utils/commonUtils';
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
    return CommonUtils.coinFiltering.filterCommonCoinsWithVolume(gateioData, orderlyData, minAmount);
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