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



        // 시장 모니터링 시작
        const monitor = new MarketMonitor();
        const envManager = EnvironmentManager.getInstance();

        // API 호출 함수들 정의
        const getGateioData = async () => {
            // 공통 코인 데이터에서 Gate.io 데이터만 추출
            const commonData = await apiClient.getCommonCoinsData(300000); // 거래량 조건 300k로 변경
            const result = commonData.commonCoins.map(item => ({
                name: item.symbol,
                mark_price: item.gateio_price.toString(),
                index_price: item.gateio_price.toString(),
                quote_volume: item.gateio_volume // Gate.io 개별 거래량
            }));
            return result;
        };

        const getOrderlyData = async () => {
            // 공통 코인 데이터에서 Orderly 데이터만 추출
            const commonData = await apiClient.getCommonCoinsData(300000); // 거래량 조건 300k로 변경
            const result = commonData.commonCoins.map(item => ({
                symbol: item.symbol,
                mark_price: item.orderly_price,
                index_price: item.orderly_price,
                '24h_amount': item.orderly_volume // Orderly 개별 거래량
            }));
            return result;
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



    } catch (error) {
        console.error('에러 발생:', error);
    }
}

main();