import { config } from 'dotenv';
import { webcrypto } from 'node:crypto';
import {
    getMarketInfoWithSelectedFields,
} from "./aden/request/get/getMarketInfoForAllSymbols";
import {
    getGateIOMarketInfoWithSelectedFields,
} from "./gateio/request/get/getMarketInfoForAllSymbols";
import { processMarketData, printMarketDataResult, printSymbolDetail } from "./action/marketDataProcessor";
import { MarketMonitor } from "./action/marketMonitor";

// this is only necessary in Node.js to make `@noble/ed25519` dependency work
if (!globalThis.crypto) globalThis.crypto = webcrypto as any;

config();



async function main() {
    const adenBaseUrl = 'https://api.orderly.org';

    try {
        // Gate.io API 호출 - 선택한 필드만
        console.log('=== Gate.io API 호출');
        const gateIOSelectedFields = ['mark_price', 'index_price'];
        const gateIOSelectedData = await getGateIOMarketInfoWithSelectedFields(gateIOSelectedFields);

        // Orderly API 호출
        console.log('\n=== Orderly API 호출 ===');
        const priceFields = ['mark_price', 'index_price'];
        const priceInfo = await getMarketInfoWithSelectedFields(adenBaseUrl, priceFields);

        // 시장 모니터링 시작
        const monitor = new MarketMonitor();

        // API 호출 함수들 정의
        const getGateioData = async () => {
            return await getGateIOMarketInfoWithSelectedFields(['mark_price', 'index_price']);
        };

        const getOrderlyData = async () => {
            return await getMarketInfoWithSelectedFields(adenBaseUrl, ['mark_price', 'index_price']);
        };

        const monitoringResult = await monitor.startMonitoring(getGateioData, getOrderlyData, 3); // 3시간

        // 모니터링 결과 출력
        // monitor.printMonitoringResult(monitoringResult);

    } catch (error) {
        console.error('에러 발생:', error);
    }
}

main();