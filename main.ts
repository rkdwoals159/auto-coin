import { config } from 'dotenv';
import bs58 from 'bs58';
import { webcrypto } from 'node:crypto';
import {
    getMarketInfoWithSelectedFields,
} from "./aden/request/get/getMarketInfoForAllSymbols";
import {
    getGateIOMarketInfoWithSelectedFields,
} from "./gateio/request/get/getMarketInfoForAllSymbols";
import { processMarketData, printMarketDataResult, printSymbolDetail } from "./action/marketDataProcessor";
import { MarketMonitor } from "./action/marketMonitor";
import getFuturesOrderBook from "./gateio/request/get/getFuturesOrderBook"
import { getUSDCBalance, printUSDCBalance, getCurrentHoldings, printAllHoldings, getAssetHistory, printAssetHistory } from "./aden/request/get/getAssetHistory";
import { getGateIOFuturesAccount, printUSDTBalance, printFuturesAccount } from "./gateio/request/get/getAssetHistory";
// this is only necessary in Node.js to make `@noble/ed25519` dependency work
if (!globalThis.crypto) globalThis.crypto = webcrypto as any;

config();


const ORDERBOOK_MAX_LEVEL = 3;

async function main() {
    const adenBaseUrl = 'https://api.orderly.org';

    const orderlySecretKey = bs58.decode(process.env.ORDERLY_SECRET_KEY!);
    try {
        // Gate.io API 호출 - 선택한 필드만
        console.log('=== Gate.io API 호출');
        const gateIOSelectedFields = ['mark_price', 'index_price'];
        const gateIOSelectedData = await getGateIOMarketInfoWithSelectedFields(gateIOSelectedFields);

        // Gate.io Futures 계정 정보 조회 
        try {
            console.log('\n=== Gate.io Futures 계정 조회 ===');
            const gateIOApiKey = process.env.GATEIO_API_KEY;
            const gateIOSecretKey = process.env.GATEIO_SECRET_KEY;

            if (gateIOApiKey && gateIOSecretKey) {
                console.log('Gate.io API 인증 정보 확인 완료');
                const gateIOFuturesAccount = await getGateIOFuturesAccount('usdt', gateIOApiKey, gateIOSecretKey);
                printUSDTBalance(gateIOFuturesAccount);
            } else {
                console.log('⚠️  Gate.io API 인증 정보가 없어 futures 계정 조회를 건너뜁니다.');
                console.log('환경 변수 설정: GATEIO_API_KEY, GATEIO_SECRET_KEY');
            }
        } catch (error) {
            console.error('Gate.io Futures 계정 조회 실패:', error);
        }

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

        // Orderly API 인증 정보 로드
        const orderlyAccountId = process.env.ORDERLY_ACCOUNT_ID;
        const orderlyApiKey = process.env.ORDERLY_API_KEY;

        if (!orderlyAccountId || !orderlyApiKey || !process.env.ORDERLY_SECRET_KEY) {
            console.log('⚠️  Orderly API 인증 정보가 없어 orderbook 분석 기능은 비활성화됩니다.');
        } else {
            console.log('✅ Orderly API 인증 정보 확인 완료');
            console.log(`계정 ID: ${orderlyAccountId}`);
            console.log(`API 키: ${orderlyApiKey.substring(0, 8)}...`);
            console.log(`시크릿 키: ${process.env.ORDERLY_SECRET_KEY!.substring(0, 8)}...`);

            // USDC 잔고 조회
            try {
                console.log('\n=== USDC 잔고 조회 ===');
                const usdcBalance = await getUSDCBalance(orderlyAccountId, orderlySecretKey, false);

                if (usdcBalance) {
                    printUSDCBalance(usdcBalance);
                }

            } catch (error) {
                console.error('자산 조회 실패:', error);
            }
        }

        // const monitoringResult = await monitor.startMonitoring(
        //     getGateioData,
        //     getOrderlyData,
        //     3, // 3시간
        //     0.6, // 0.6% 임계값
        //     orderlyAccountId,
        //     orderlyApiKey,
        //     orderlySecretKey,
        //     ORDERBOOK_MAX_LEVEL
        // );

        // 모니터링 결과 출력
        // monitor.printMonitoringResult(monitoringResult);

    } catch (error) {
        console.error('에러 발생:', error);
    }
}

main();