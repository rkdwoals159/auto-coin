import { webcrypto } from 'node:crypto';
import { AutoTradingFacade } from './facade/AutoTradingFacade';

// this is only necessary in Node.js to make `@noble/ed25519` dependency work
if (!globalThis.crypto) globalThis.crypto = webcrypto as any;

async function main() {
    try {
        // 퍼사드 초기화 (기존 파라미터를 기본값으로 사용)
        const autoTrading = new AutoTradingFacade({
            orderbookMaxLevel: 3,   // orderbook 최대 레벨
            min24Amount: 500000,    // 24시간 거래금액 조건
            positionPercent: 1,     // 포지션 비율(ex : 0.2 = 현재 시드의 20%)
            pauseThreshold: 0.4,    // 가격차이율 임계값 (0.4%)
            targetProfitPercent: 0.4, // 목표 수익률
            durationHours: 500      // 모니터링 시간
        });

        // 모니터링 시작 (고수준 퍼사드 API)
        const result = await autoTrading.startMonitoring();
        autoTrading.printMonitoringResult(result);
    } catch (error) {
        console.error('에러 발생:', error);
    }
}

main();