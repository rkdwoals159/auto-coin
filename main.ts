import { webcrypto } from 'node:crypto';
import { ApiClient } from './services/apiClient';
import { MarketMonitor } from './action/marketMonitor';
import { EnvironmentManager } from './config/environment';
import { getAllPositionsInfo, printPositionsInfo, monitorPositions } from './aden/request/get/getAllPositionsInfo';

// this is only necessary in Node.js to make `@noble/ed25519` dependency work
if (!globalThis.crypto) globalThis.crypto = webcrypto as any;

const ORDERBOOK_MAX_LEVEL = 3; // orderbook 최대 레벨
const MIN_24_AMOUNT = 500000; // 24시간 거래금액 조건
const POSITON_PERCENT = 1; // 포지션 비율(ex : 0.2 = 현재 시드의 20%)
const PAUSE_THRESHOLD = 0.4; // 가격차이율 임계값 (0.1%)
const TARGET_PROFIT_PERCENT = 0.4; // 목표 수익률 (0.05% = 0.1% - 0.05% = 0.05% 차익)
const DURATION_HOURS = 500; // 모니터링 시간 (3시간)
async function main() {
    try {
        // API 클라이언트 초기화
        const apiClient = new ApiClient();

        // 시장 모니터링 시작
        const marketMonitor = new MarketMonitor();
        const envManager = EnvironmentManager.getInstance();

        // API 호출 함수들 정의
        const getGateioData = async () => {
            // 공통 코인 데이터에서 Gate.io 데이터만 추출
            const commonData = await apiClient.getCommonCoinsData(MIN_24_AMOUNT);
            const result = commonData.commonCoins.map(item => ({
                name: item.symbol,
                mark_price: item.gateio_price.toString(),
                index_price: item.gateio_price.toString(),
                quote_volume: item.gateio_volume
            }));
            return result;
        };

        const getOrderlyData = async () => {
            // 공통 코인 데이터에서 Orderly 데이터만 추출
            const commonData = await apiClient.getCommonCoinsData(MIN_24_AMOUNT);
            const result = commonData.commonCoins.map(item => ({
                symbol: item.symbol,
                mark_price: item.orderly_price,
                index_price: item.orderly_price,
                '24h_amount': item.orderly_volume
            }));
            return result;
        };

        // Orderly 인증 정보 가져오기
        const orderlyAuth = envManager.getOrderlyAuth();

        // 모니터링 시작
        const result = await marketMonitor.startMonitoring(
            getGateioData,
            getOrderlyData,
            DURATION_HOURS, // 3시간
            PAUSE_THRESHOLD, // 0.1%
            orderlyAuth.accountId,
            orderlyAuth.apiKey,
            orderlyAuth.secretKey as Uint8Array,
            ORDERBOOK_MAX_LEVEL,
            POSITON_PERCENT,
            TARGET_PROFIT_PERCENT // 0.05%
        );
        // 모니터링 결과 출력
        // monitor.printMonitoringResult(monitoringResult);



    } catch (error) {
        console.error('에러 발생:', error);
    }
}

main();