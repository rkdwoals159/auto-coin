import { MarketMonitoringResult } from '../types/common';
import { executeAutoBuy, AutoBuyConfig } from './autoBuy';
import { ApiClient } from '../services/apiClient';
import { getAllPositionsInfo } from '../aden/request/get/getAllPositionsInfo';
import { createMarketSellOrder } from '../aden/request/post/createOrder';
import { calculateQuantityFromAmount } from './quantityUtils';
import { PositionManager } from './positionManager';
import { OrderbookAnalyzer } from './orderbookAnalyzer';
import { PriceMonitor } from './priceMonitor';

/**
 * 시장 데이터를 모니터링하고 최고 가격차이율을 추적
 */
export class MarketMonitor {
    private isRunning: boolean = false;
    private positionManager: PositionManager;
    private orderbookAnalyzer: OrderbookAnalyzer;
    private priceMonitor: PriceMonitor;

    constructor() {
        this.positionManager = new PositionManager();
        this.orderbookAnalyzer = new OrderbookAnalyzer();
        this.priceMonitor = new PriceMonitor();
    }

    /**
     * 지정된 시간 동안 1초마다 시장 데이터를 모니터링
     */
    async startMonitoring(
        getGateioData: () => Promise<any[]>,
        getOrderlyData: () => Promise<any[]>,
        durationHours: number = 0.1, // 테스트용 6분
        pauseThreshold: number = 0.5, // 가격차이율 임계값 (0.5%)
        orderlyAccountId?: string,
        orderlyApiKey?: string,
        orderlySecretKey?: Uint8Array,
        orderbookMaxLevel: number = 3,
        percent: number = 0.2, // 포지션 비율
    ): Promise<MarketMonitoringResult> {
        this.isRunning = true;

        const durationMs = durationHours * 60 * 60 * 1000;
        const intervalMs = 1000; // 1초

        console.log(`시장 모니터링 시작: ${this.priceMonitor.getStartTime().toLocaleString()}`);
        console.log(`모니터링 시간: ${durationHours}시간`);
        console.log(`실행 간격: ${intervalMs}ms`);
        console.log(`일시중단 임계값: ${pauseThreshold}%`);

        const endTime = new Date(this.priceMonitor.getStartTime().getTime() + durationMs);

        while (this.isRunning && new Date() < endTime) {
            try {
                // 매번 새로운 API 데이터 가져오기
                const gateioData = await getGateioData();
                const orderlyData = await getOrderlyData();

                const shouldPause = await this.priceMonitor.executeMonitoring(gateioData, orderlyData, pauseThreshold);
                this.priceMonitor.incrementTotalExecutions();

                // 가격차이율이 임계값을 넘으면 orderbook 분석 수행
                if (shouldPause) {
                    console.log(`\n⚠️  가격차이율이 ${pauseThreshold}%를 초과했습니다!`);
                    console.log(`모니터링을 일시 중단하고 orderbook 분석을 시작합니다...`);
                    console.log(`현재 시간: ${new Date().toLocaleString()}`);
                    console.log('---');

                    // 현재 최고 가격차이율 데이터로 orderbook 분석
                    const highestDifference = this.priceMonitor.getHighestPriceDifference();
                    if (highestDifference && orderlyAccountId && orderlyApiKey && orderlySecretKey) {
                        await this.orderbookAnalyzer.analyzeOrderbookForHighPriceDifference(
                            highestDifference,
                            orderlyAccountId,
                            orderlyApiKey,
                            orderlySecretKey,
                            orderbookMaxLevel
                        );

                        // === 자동 매매 ===
                        await this.executeAutoTrading(highestDifference, gateioData, orderlyAccountId, orderlySecretKey, percent);

                        // === 포지션 종료 조건 체크 ===
                        await this.positionManager.checkAndClosePositions(
                            { accountId: orderlyAccountId, secretKey: orderlySecretKey },
                            gateioData
                        );

                        // === 포지션 모니터링 ===
                        await this.positionManager.monitorPositions(
                            { accountId: orderlyAccountId, secretKey: orderlySecretKey },
                            gateioData,
                            endTime,
                            this.isRunning
                        );
                    } else {
                        console.log('❌ Orderly API 인증 정보가 없어 orderbook 분석을 건너뜁니다.');
                    }
                }

                // 진행 상황 출력 (1분마다)
                if (this.priceMonitor.getTotalExecutions() % 60 === 0) {
                    const elapsedMinutes = Math.floor(this.priceMonitor.getTotalExecutions() / 60);
                    console.log(`진행 상황: ${elapsedMinutes}분 경과, 총 실행 횟수: ${this.priceMonitor.getTotalExecutions()}`);
                }

                // 1초 대기
                await new Promise(resolve => setTimeout(resolve, intervalMs));
            } catch (error: any) {
                console.error('모니터링 실행 중 에러:', error);
                await new Promise(resolve => setTimeout(resolve, intervalMs));
            }
        }

        this.isRunning = false;
        const finalEndTime = new Date();

        console.log(`모니터링 완료: ${finalEndTime.toLocaleString()}`);
        console.log(`총 실행 횟수: ${this.priceMonitor.getTotalExecutions()}`);

        return {
            startTime: this.priceMonitor.getStartTime(),
            endTime: finalEndTime,
            totalExecutions: this.priceMonitor.getTotalExecutions(),
            highestPriceDifference: this.priceMonitor.getHighestPriceDifference(),
            averagePriceDifference: this.priceMonitor.calculateAveragePriceDifference(),
            allPriceDifferences: this.priceMonitor.getAllPriceDifferences()
        };
    }

    /**
     * 자동 매매 실행
     */
    private async executeAutoTrading(
        highestDifference: any,
        gateioData: any[],
        orderlyAccountId: string,
        orderlySecretKey: Uint8Array,
        percent: number
    ): Promise<void> {
        const coinSymbol = 'PERP_' + highestDifference.coin.replace('USDC', '') + '_USDC';
        const apiClient = new ApiClient();
        const envManager = require('../config/environment').EnvironmentManager.getInstance();
        const orderlyAuth = envManager.getOrderlyAuth();

        // 사용가능 금액 조회
        const positions = await getAllPositionsInfo(orderlyAuth.accountId, orderlyAuth.secretKey, false);
        const freeCollateral = positions.free_collateral;
        const minAmount = 12; // 최소 12 USDC (Orderly 최소 주문 금액)
        const maxAmount = freeCollateral; // 최대는 전액
        const orderAmount = Math.max(Math.min(freeCollateral * percent, maxAmount), minAmount);

        // clientOrderId 생성 함수
        function makeShortClientOrderId(prefix: string, symbol: string) {
            const coin = symbol.replace('PERP_', '').replace('_USDC', '').slice(0, 8);
            return `${prefix}_${coin}_${Date.now()}`.slice(0, 36);
        }

        // 현재 포지션 확인
        const checkPositions = await getAllPositionsInfo(orderlyAuth.accountId, orderlyAuth.secretKey, false);
        const existingPosition = checkPositions?.rows.find(p => p.symbol === coinSymbol && p.position_qty !== 0);

        if (highestDifference.gateio_price > highestDifference.orderly_price) {
            // Gate.io 가격이 더 높으면 Orderly에서 매수
            if (existingPosition) {
                console.log(`⚠️ ${coinSymbol}에 이미 포지션이 있습니다. 매수를 건너뜁니다.`);
                console.log(`현재 포지션: ${existingPosition.position_qty} (${existingPosition.position_qty > 0 ? '롱' : '숏'})`);
            } else {
                console.log(`\n[자동매매] Gate.io 가격이 더 높으므로 Orderly에서 시장가 매수 시도!`);
                const buyConfig: AutoBuyConfig = {
                    symbol: coinSymbol,
                    percentage: percent,
                    minAmount,
                    maxAmount,
                    clientOrderId: makeShortClientOrderId('ab', coinSymbol)
                };
                const buyResult = await executeAutoBuy(buyConfig);
                if (buyResult.success) {
                    console.log(`[자동매매] 시장가 매수 성공! 주문ID: ${buyResult.orderId}`);

                    // 실제 체결가 조회를 위해 잠시 대기
                    await new Promise(resolve => setTimeout(resolve, 2000));

                    // 현재 포지션 정보 조회하여 실제 체결가 확인
                    const currentPositions = await getAllPositionsInfo(orderlyAuth.accountId, orderlyAuth.secretKey, false);
                    const newPosition = currentPositions?.rows.find(p => p.symbol === coinSymbol && p.position_qty > 0);

                    if (newPosition) {
                        this.positionManager.setPositionEntryPrice(
                            coinSymbol,
                            newPosition.average_open_price || highestDifference.orderly_price,
                            highestDifference.gateio_price
                        );
                    } else {
                        this.positionManager.setPositionEntryPrice(
                            coinSymbol,
                            highestDifference.orderly_price,
                            highestDifference.gateio_price
                        );
                    }
                } else {
                    console.log(`[자동매매] 시장가 매수 실패: ${buyResult.message}`);
                }
            }
        } else {
            // Orderly 가격이 더 높으면 Orderly에서 공매도(매도)
            if (existingPosition) {
                console.log(`⚠️ ${coinSymbol}에 이미 포지션이 있습니다. 공매도를 건너뜁니다.`);
                console.log(`현재 포지션: ${existingPosition.position_qty} (${existingPosition.position_qty > 0 ? '롱' : '숏'})`);
            } else {
                console.log(`\n[자동매매] Orderly 가격이 더 높으므로 Orderly에서 시장가 공매도(매도) 시도!`);
                const marketInfo = await apiClient.getOrderlyMarketData(['mark_price']);
                const symbolInfo = marketInfo.find(item => item.symbol === coinSymbol);
                if (!symbolInfo || !symbolInfo.mark_price) {
                    console.log('[자동매매] 현재가 조회 실패, 공매도 스킵');
                } else {
                    const sellQuantity = calculateQuantityFromAmount(orderAmount, symbolInfo.mark_price);
                    try {
                        const sellResult = await createMarketSellOrder(
                            coinSymbol,
                            sellQuantity,
                            orderlyAuth.accountId,
                            orderlyAuth.secretKey,
                            makeShortClientOrderId('as', coinSymbol),
                            false,
                            false  // reduceOnly를 false로 설정
                        );
                        if (sellResult && sellResult.order_id) {
                            console.log(`[자동매매] 시장가 공매도 성공! 주문ID: ${sellResult.order_id}`);

                            // 실제 체결가 조회를 위해 잠시 대기
                            await new Promise(resolve => setTimeout(resolve, 2000));

                            // 현재 포지션 정보 조회하여 실제 체결가 확인
                            const currentPositions = await getAllPositionsInfo(orderlyAuth.accountId, orderlyAuth.secretKey, false);
                            const newPosition = currentPositions?.rows.find(p => p.symbol === coinSymbol && p.position_qty < 0);

                            if (newPosition) {
                                this.positionManager.setPositionEntryPrice(
                                    coinSymbol,
                                    newPosition.average_open_price || highestDifference.orderly_price,
                                    highestDifference.gateio_price
                                );
                            } else {
                                this.positionManager.setPositionEntryPrice(
                                    coinSymbol,
                                    highestDifference.orderly_price,
                                    highestDifference.gateio_price
                                );
                            }
                        } else {
                            console.log('[자동매매] 시장가 공매도 실패');
                        }
                    } catch (e) {
                        console.log(`[자동매매] 시장가 공매도 오류: ${e}`);
                    }
                }
            }
        }
    }

    /**
     * 모니터링 중단
     */
    stopMonitoring(): void {
        this.isRunning = false;
    }

    /**
     * 모니터링 결과 출력
     */
    printMonitoringResult(result: MarketMonitoringResult): void {
        console.log('\n=== 시장 모니터링 최종 결과 ===');
        console.log(`시작 시간: ${result.startTime.toLocaleString()}`);
        console.log(`종료 시간: ${result.endTime.toLocaleString()}`);
        console.log(`총 실행 횟수: ${result.totalExecutions}`);
        console.log(`평균 가격차이율: ${result.averagePriceDifference.toFixed(4)}%`);

        if (result.highestPriceDifference) {
            console.log('\n=== 최고 가격차이율 데이터 ===');
            console.log(`발견 시간: ${result.highestPriceDifference.timestamp.toLocaleString()}`);
            console.log(`코인: ${result.highestPriceDifference.coin}`);
            console.log(`Gate.io 가격: ${result.highestPriceDifference.gateio_price}`);
            console.log(`Orderly 가격: ${result.highestPriceDifference.orderly_price}`);
            console.log(`가격 차이: ${result.highestPriceDifference.price_difference.toFixed(6)}`);
            console.log(`가격차이율: ${result.highestPriceDifference.price_difference_percent.toFixed(4)}%`);
        }
    }
}