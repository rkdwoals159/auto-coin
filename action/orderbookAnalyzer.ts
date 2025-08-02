import { getOrderlyOrderbook, printOrderbook } from '../aden/request/get/orderlyOrderbook';
import getFuturesOrderBook from '../gateio/request/get/getFuturesOrderBook';
import { HighestPriceDifferenceData } from '../types/common';

/**
 * Gate.io 실제 orderbook 응답 타입
 */
interface GateIOOrderBookEntry {
    p: string; // price
    s: string; // size
}

interface GateIOOrderBookResponse {
    current: number;
    update: number;
    asks: GateIOOrderBookEntry[];
    bids: GateIOOrderBookEntry[];
}

/**
 * Orderbook 분석기 클래스
 */
export class OrderbookAnalyzer {
    /**
     * 가격차이율이 높은 코인의 orderbook 조회 및 분석
     */
    async analyzeOrderbookForHighPriceDifference(
        highestDifference: HighestPriceDifferenceData,
        orderlyAccountId: string,
        orderlyApiKey: string,
        orderlySecretKey: Uint8Array,
        orderbookMaxLevel: number
    ): Promise<void> {
        try {
            console.log(`\n🔍 ${highestDifference.coin}의 orderbook 분석 시작...`);
            console.log(`가격차이율: ${highestDifference.price_difference_percent.toFixed(4)}%`);
            console.log(`Gate.io 가격: ${highestDifference.gateio_price}`);
            console.log(`Orderly 가격: ${highestDifference.orderly_price}`);

            // 코인 심볼 변환
            const coinSymbol = 'PERP_' + highestDifference.coin.replace('USDC', '') + '_USDC';
            const gateioContract = highestDifference.coin.replace('USDT', '') + '_USDT';

            console.log(`\n📊 Gate.io ${gateioContract} orderbook 조회 중...`);

            // Gate.io orderbook 조회
            const gateioOrderbook = await getFuturesOrderBook('usdt', gateioContract, orderbookMaxLevel) as unknown as GateIOOrderBookResponse;

            console.log(`✅ Gate.io orderbook 조회 성공`);

            // Gate.io orderbook 출력
            console.log(`\n=== Gate.io ${gateioContract} Orderbook ===`);

            console.log('\n--- Asks (매도) ---');
            gateioOrderbook.asks.slice(0, 10).forEach((ask, index) => {
                console.log(`${index + 1}. 가격: ${parseFloat(ask.p).toFixed(4)}, 수량: ${parseFloat(ask.s).toFixed(6)}`);
            });

            console.log('\n--- Bids (매수) ---');
            gateioOrderbook.bids.slice(0, 10).forEach((bid, index) => {
                console.log(`${index + 1}. 가격: ${parseFloat(bid.p).toFixed(4)}, 수량: ${parseFloat(bid.s).toFixed(6)}`);
            });

            // Gate.io 스프레드 계산
            if (gateioOrderbook.asks.length > 0 && gateioOrderbook.bids.length > 0) {
                const bestAsk = parseFloat(gateioOrderbook.asks[0].p);
                const bestBid = parseFloat(gateioOrderbook.bids[0].p);
                const spread = bestAsk - bestBid;
                const spreadPercent = (spread / bestAsk) * 100;

                console.log(`\nGate.io 스프레드: ${spread.toFixed(4)} (${spreadPercent.toFixed(4)}%)`);
            }

            // Orderly orderbook 조회
            const orderlyOrderbook = await getOrderlyOrderbook(
                coinSymbol,
                orderlyAccountId,
                orderlySecretKey,
                orderbookMaxLevel,
                false
            );

            console.log(`✅ Orderly orderbook 조회 성공`);
            printOrderbook(orderlyOrderbook, coinSymbol);

            // 거래소별 가격 비교 및 분석
            console.log(`\n📈 거래소별 가격 분석:`);
            console.log(`Gate.io 현재가: ${highestDifference.gateio_price}`);
            console.log(`Orderly 현재가: ${highestDifference.orderly_price}`);

            if (highestDifference.gateio_price > highestDifference.orderly_price) {
                console.log(`\n💰 차익거래 기회 발견!`);
                console.log(`Gate.io에서 매수 → Orderly에서 매도`);
                console.log(`코인이름 : ${highestDifference.coin}`);
                console.log(`예상 수익률: ${highestDifference.price_difference_percent.toFixed(4)}%`);

                // Gate.io 매수 물량 분석
                const gateioBuyVolume = gateioOrderbook.bids.slice(0, 5).reduce((sum, bid) => sum + parseFloat(bid.s), 0);
                console.log(`Gate.io 상위 5개 매수 물량 합계: ${gateioBuyVolume.toFixed(6)}`);

                // Orderly 매도 물량 분석
                const orderlySellVolume = orderlyOrderbook.asks.slice(0, 5).reduce((sum, ask) => sum + ask.quantity, 0);
                console.log(`Orderly 상위 5개 매도 물량 합계: ${orderlySellVolume.toFixed(6)}`);

            } else {
                console.log(`\n💰 차익거래 기회 발견!`);
                console.log(`Orderly에서 매수 → Gate.io에서 매도`);
                console.log(`코인이름 : ${highestDifference.coin}`);
                console.log(`예상 수익률: ${highestDifference.price_difference_percent.toFixed(4)}%`);

                // Orderly 매수 물량 분석
                const orderlyBuyVolume = orderlyOrderbook.bids.slice(0, 5).reduce((sum, bid) => sum + bid.quantity, 0);
                console.log(`Orderly 상위 5개 매수 물량 합계: ${orderlyBuyVolume.toFixed(6)}`);

                // Gate.io 매도 물량 분석
                const gateioSellVolume = gateioOrderbook.asks.slice(0, 5).reduce((sum, ask) => sum + parseFloat(ask.s), 0);
                console.log(`Gate.io 상위 5개 매도 물량 합계: ${gateioSellVolume.toFixed(6)}`);
            }

        } catch (error: any) {
            console.error(`❌ Orderbook 분석 중 오류:`, error.message);
        }
    }
} 