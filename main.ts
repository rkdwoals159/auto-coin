import { webcrypto } from 'node:crypto';
import { ApiClient } from './services/apiClient';
import { MarketMonitor } from './action/marketMonitor';
import { EnvironmentManager } from './config/environment';

// this is only necessary in Node.js to make `@noble/ed25519` dependency work
if (!globalThis.crypto) globalThis.crypto = webcrypto as any;

const ORDERBOOK_MAX_LEVEL = 3;

async function main() {
    try {
        // API 클라이언트 초기화
        const apiClient = new ApiClient();

        // 모든 API 데이터 조회
        const allData = await apiClient.getAllData();

        // 시장 모니터링 시작
        const monitor = new MarketMonitor();
        const envManager = EnvironmentManager.getInstance();

        // API 호출 함수들 정의
        const getGateioData = async () => {
            return await apiClient.getGateIOMarketData(['mark_price', 'index_price']);
        };

        const getOrderlyData = async () => {
            return await apiClient.getOrderlyMarketData(['mark_price', 'index_price']);
        };

        // Orderly 인증 정보 가져오기
        const orderlyAuth = envManager.getOrderlyAuth();

        // 모니터링 시작
        const monitoringResult = await monitor.startMonitoring(
            getGateioData,
            getOrderlyData,
            3, // 3시간
            0.6, // 0.6% 임계값
            orderlyAuth.accountId,
            orderlyAuth.apiKey,
            orderlyAuth.secretKey as Uint8Array,
            ORDERBOOK_MAX_LEVEL
        );

        // 모니터링 결과 출력
        // monitor.printMonitoringResult(monitoringResult);

    } catch (error) {
        console.error('에러 발생:', error);
    }
}

main();