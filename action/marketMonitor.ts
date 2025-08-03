import { MarketMonitoringResult } from '../types/common';
import { executeAutoBuy, AutoBuyConfig } from './autoBuy';
import { ApiClient } from '../services/apiClient';
import { getAllPositionsInfo } from '../aden/request/get/getAllPositionsInfo';
import { createMarketSellOrder } from '../aden/request/post/createOrder';
import { createGateIOMarketBuyOrder, createGateIOMarketSellOrder, createGateIOMarketBuyOrderByPercentage, createGateIOMarketSellOrderByPercentage, getGateIOContractInfo } from '../gateio/request/post/createFuturesOrder';
import { getGateIOPositionByContract } from '../gateio/request/get/getPositions';
import { calculateQuantityFromAmount } from './quantityUtils';
import { PositionManager } from './positionManager';
import { OrderbookAnalyzer } from './orderbookAnalyzer';
import { PriceMonitor } from './priceMonitor';

/**
 * Gate.io 기준으로 수량 계산
 */
async function calculateGateIOQuantity(contract: string, amount: number): Promise<number | null> {
    try {
        const response = await fetch(`https://api.gateio.ws/api/v4/futures/usdt/contracts/${contract}`);
        if (!response.ok) {
            return null;
        }
        const data = await response.json() as any;
        const currentPrice = parseFloat(data.mark_price || data.last_price || '0');

        if (currentPrice <= 0) return null;

        // 금액을 수량으로 변환
        const quantity = amount / currentPrice;

        // Gate.io 수량 반올림 규칙 적용
        if (currentPrice >= 5000) {
            return Math.round(quantity * 10000) / 10000;
        } else if (currentPrice >= 1000) {
            return Math.round(quantity * 100) / 100;
        } else if (currentPrice >= 100) {
            return Math.round(quantity * 10) / 10;
        } else if (currentPrice >= 1) {
            return Math.round(quantity);
        } else {
            return Math.round(quantity / 10) * 10;
        }
    } catch (error) {
        console.error(`Gate.io 수량 계산 실패 (${contract}):`, error);
        return null;
    }
}

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

                // === Gate.io 기준으로 수량 계산 ===
                const gateioContract = highestDifference.coin.replace('USDT', '') + '_USDT';
                const gateioQuantity = await calculateGateIOQuantity(gateioContract, orderAmount);

                if (gateioQuantity) {
                    console.log(`Gate.io 기준 수량: ${gateioQuantity}`);

                    // Orderly에서 매수 (Gate.io 수량 기준)
                    const buyConfig: AutoBuyConfig = {
                        symbol: coinSymbol,
                        percentage: percent,
                        minAmount,
                        maxAmount,
                        clientOrderId: makeShortClientOrderId('ab', coinSymbol),
                        targetQuantity: gateioQuantity // Gate.io 수량을 Orderly에도 적용
                    };
                    const buyResult = await executeAutoBuy(buyConfig);
                    if (buyResult.success) {
                        console.log(`[자동매매] 시장가 매수 성공! 주문ID: ${buyResult.orderId}`);

                        // === Gate.io 반대 포지션 진입 ===
                        try {
                            console.log(`\n[Gate.io 자동매매] Orderly 매수에 대응하여 Gate.io에서 공매도 시도!`);
                            console.log(`계약: ${gateioContract}`);

                            // Gate.io에서 공매도 (퍼센트 기반)
                            const gateioSellResult = await createGateIOMarketSellOrderByPercentage(
                                gateioContract,
                                freeCollateral, // 사용 가능한 금액
                                percent * 100, // 퍼센트 (0.2 -> 20)
                                'usdt'
                            );

                            if (gateioSellResult && gateioSellResult.id) {
                                console.log(`[Gate.io 자동매매] 공매도 성공! 주문ID: ${gateioSellResult.id}`);
                                console.log(`체결 가격: ${gateioSellResult.fill_price}`);
                                console.log(`Gate.io 체결 수량: ${gateioSellResult.size}`);

                                // Gate.io 실제 진입가 조회
                                await new Promise(resolve => setTimeout(resolve, 2000)); // 잠시 대기
                                const gateioPosition = await getGateIOPositionByContract(gateioContract);
                                const gateioEntryPrice = gateioPosition ? parseFloat(gateioPosition.entry_price) : highestDifference.gateio_price;

                                // Gate.io 실제 체결 수량 계산 (포지션 단위를 실제 코인 수량으로 변환)
                                let gateioActualSize = 0;
                                if (gateioPosition) {
                                    const positionSize = Math.abs(parseFloat(gateioPosition.size));
                                    // Gate.io 계약 정보 조회하여 quanto_multiplier 확인
                                    try {
                                        const contractInfo = await getGateIOContractInfo(gateioContract);
                                        if (contractInfo && contractInfo.quanto_multiplier) {
                                            gateioActualSize = positionSize * contractInfo.quanto_multiplier;
                                        } else {
                                            gateioActualSize = positionSize; // 배수 정보가 없으면 그대로 사용
                                        }
                                    } catch (error) {
                                        gateioActualSize = positionSize; // 에러 시 그대로 사용
                                    }
                                } else {
                                    gateioActualSize = Math.abs(gateioSellResult.size);
                                }

                                // 소수점 자릿수 정리 (Orderly 필터 요구사항 만족)
                                gateioActualSize = Math.round(gateioActualSize * 1000000) / 1000000; // 소수점 6자리로 제한

                                console.log(`Gate.io 실제 진입가: $${gateioEntryPrice}`);
                                console.log(`Gate.io 실제 체결 수량: ${gateioActualSize}`);

                                // Gate.io 수량을 Orderly에도 동일하게 적용
                                console.log(`\n[Orderly 수량 동기화] Gate.io 수량(${gateioActualSize})을 Orderly에도 적용`);

                                // Orderly에서 추가 매수 (Gate.io 수량에 맞춰서)
                                const additionalBuyConfig: AutoBuyConfig = {
                                    symbol: coinSymbol,
                                    percentage: 0, // 퍼센트는 0으로 설정하고 수량으로 직접 지정
                                    minAmount,
                                    maxAmount,
                                    clientOrderId: makeShortClientOrderId('ab_sync', coinSymbol),
                                    targetQuantity: gateioActualSize // Gate.io 실제 수량 사용
                                };

                                const additionalBuyResult = await executeAutoBuy(additionalBuyConfig);
                                if (additionalBuyResult.success) {
                                    console.log(`[Orderly 수량 동기화] 추가 매수 성공! 주문ID: ${additionalBuyResult.orderId}`);
                                } else {
                                    console.log(`[Orderly 수량 동기화] 추가 매수 실패: ${additionalBuyResult.message}`);
                                }
                            } else {
                                console.log(`[Gate.io 자동매매] 공매도 실패`);
                            }
                        } catch (gateioError) {
                            console.log(`[Gate.io 자동매매] 공매도 오류: ${gateioError}`);
                        }

                        // 실제 체결가 조회를 위해 잠시 대기
                        await new Promise(resolve => setTimeout(resolve, 2000));

                        // 현재 포지션 정보 조회하여 실제 체결가 확인
                        const currentPositions = await getAllPositionsInfo(orderlyAuth.accountId, orderlyAuth.secretKey, false);
                        const newPosition = currentPositions?.rows.find(p => p.symbol === coinSymbol && p.position_qty > 0);

                        if (newPosition) {
                            // Gate.io 실제 진입가 조회
                            const gateioPosition = await getGateIOPositionByContract(gateioContract);
                            const gateioEntryPrice = gateioPosition ? parseFloat(gateioPosition.entry_price) : highestDifference.gateio_price;

                            const orderlyEntryPrice = newPosition.average_open_price || highestDifference.orderly_price;

                            this.positionManager.setPositionEntryPrice(
                                coinSymbol,
                                orderlyEntryPrice,
                                gateioEntryPrice
                            );

                            // 차익거래 진입 정보 로그
                            console.log(`\n💰 ${coinSymbol} 차익거래 진입 완료! ===`);
                            console.log(`📈 진입 시점 정보:`);
                            console.log(`  - Orderly 진입가: $${orderlyEntryPrice.toFixed(6)}`);
                            console.log(`  - Gate.io 진입가: $${gateioEntryPrice.toFixed(6)}`);
                            console.log(`  - 거래 수량: ${Math.abs(newPosition.position_qty).toFixed(6)}`);
                            console.log(`  - 거래 방향: Orderly 매수 + Gate.io 매도`);
                            console.log(`  - 진입 시 가격차이율: ${((orderlyEntryPrice - gateioEntryPrice) / gateioEntryPrice * 100).toFixed(4)}%`);
                            console.log(`  - 예상 수익률: ${((orderlyEntryPrice - gateioEntryPrice) / gateioEntryPrice * 100).toFixed(4)}%`);

                        } else {
                            this.positionManager.setPositionEntryPrice(
                                coinSymbol,
                                highestDifference.orderly_price,
                                highestDifference.gateio_price
                            );

                            // 차익거래 진입 정보 로그 (실제 체결 정보 없음)
                            console.log(`\n💰 ${coinSymbol} 차익거래 진입 완료! ===`);
                            console.log(`📈 진입 시점 정보:`);
                            console.log(`  - Orderly 진입가: $${highestDifference.orderly_price.toFixed(6)}`);
                            console.log(`  - Gate.io 진입가: $${highestDifference.gateio_price.toFixed(6)}`);
                            console.log(`  - 거래 방향: Orderly 매수 + Gate.io 매도`);
                            console.log(`  - 진입 시 가격차이율: ${((highestDifference.orderly_price - highestDifference.gateio_price) / highestDifference.gateio_price * 100).toFixed(4)}%`);
                            console.log(`  - 예상 수익률: ${((highestDifference.orderly_price - highestDifference.gateio_price) / highestDifference.gateio_price * 100).toFixed(4)}%`);
                        }
                    } else {
                        console.log(`[자동매매] 시장가 매수 실패: ${buyResult.message}`);
                    }
                } else {
                    console.log(`[자동매매] Gate.io 수량 계산 실패`);
                }
            }
        } else {
            // Orderly 가격이 더 높으면 Orderly에서 공매도(매도)
            if (existingPosition) {
                console.log(`⚠️ ${coinSymbol}에 이미 포지션이 있습니다. 공매도를 건너뜁니다.`);
                console.log(`현재 포지션: ${existingPosition.position_qty} (${existingPosition.position_qty > 0 ? '롱' : '숏'})`);
            } else {
                console.log(`\n[자동매매] Orderly 가격이 더 높으므로 Orderly에서 시장가 공매도(매도) 시도!`);

                // === Gate.io 먼저 실행하여 실제 체결 수량 확인 ===
                const gateioContract = highestDifference.coin.replace('USDT', '') + '_USDT';

                try {
                    console.log(`\n[Gate.io 자동매매] Orderly 공매도에 대응하여 Gate.io에서 매수 시도!`);
                    console.log(`계약: ${gateioContract}`);

                    // Gate.io에서 매수 (퍼센트 기반)
                    const gateioBuyResult = await createGateIOMarketBuyOrderByPercentage(
                        gateioContract,
                        freeCollateral, // 사용 가능한 금액
                        percent * 100, // 퍼센트 (0.2 -> 20)
                        'usdt'
                    );

                    if (gateioBuyResult && gateioBuyResult.id) {
                        console.log(`[Gate.io 자동매매] 매수 성공! 주문ID: ${gateioBuyResult.id}`);
                        console.log(`체결 가격: ${gateioBuyResult.fill_price}`);
                        console.log(`Gate.io 체결 수량: ${gateioBuyResult.size}`);

                        // Gate.io 실제 진입가 조회
                        await new Promise(resolve => setTimeout(resolve, 2000)); // 잠시 대기
                        const gateioPosition = await getGateIOPositionByContract(gateioContract);
                        const gateioEntryPrice = gateioPosition ? parseFloat(gateioPosition.entry_price) : highestDifference.gateio_price;

                        // Gate.io 실제 체결 수량 계산 (포지션 단위를 실제 코인 수량으로 변환)
                        let gateioActualSize = 0;
                        if (gateioPosition) {
                            const positionSize = Math.abs(parseFloat(gateioPosition.size));
                            // Gate.io 계약 정보 조회하여 quanto_multiplier 확인
                            try {
                                const contractInfo = await getGateIOContractInfo(gateioContract);
                                if (contractInfo && contractInfo.quanto_multiplier) {
                                    gateioActualSize = positionSize * contractInfo.quanto_multiplier;
                                } else {
                                    gateioActualSize = positionSize; // 배수 정보가 없으면 그대로 사용
                                }
                            } catch (error) {
                                gateioActualSize = positionSize; // 에러 시 그대로 사용
                            }
                        } else {
                            gateioActualSize = Math.abs(gateioBuyResult.size);
                        }

                        // 소수점 자릿수 정리 (Orderly 필터 요구사항 만족)
                        gateioActualSize = Math.round(gateioActualSize * 1000000) / 1000000; // 소수점 6자리로 제한

                        console.log(`Gate.io 실제 진입가: $${gateioEntryPrice}`);
                        console.log(`Gate.io 실제 체결 수량: ${gateioActualSize}`);

                        // Gate.io 수량을 Orderly에도 동일하게 적용
                        console.log(`\n[Orderly 수량 동기화] Gate.io 수량(${gateioActualSize})을 Orderly에도 적용`);

                        // Orderly에서 공매도 (Gate.io 실제 수량에 맞춰서)
                        const marketInfo = await apiClient.getOrderlyMarketData(['mark_price']);
                        const symbolInfo = marketInfo.find(item => item.symbol === coinSymbol);
                        if (symbolInfo && symbolInfo.mark_price) {
                            try {
                                const sellResult = await createMarketSellOrder(
                                    coinSymbol,
                                    gateioActualSize, // Gate.io 실제 수량 사용
                                    orderlyAuth.accountId,
                                    orderlyAuth.secretKey,
                                    makeShortClientOrderId('as_sync', coinSymbol),
                                    false,
                                    false
                                );
                                if (sellResult && sellResult.order_id) {
                                    console.log(`[Orderly 수량 동기화] 공매도 성공! 주문ID: ${sellResult.order_id}`);

                                    // 실제 체결가 조회를 위해 잠시 대기
                                    await new Promise(resolve => setTimeout(resolve, 2000));

                                    // 현재 포지션 정보 조회하여 실제 체결가 확인
                                    const currentPositions = await getAllPositionsInfo(orderlyAuth.accountId, orderlyAuth.secretKey, false);
                                    const newPosition = currentPositions?.rows.find(p => p.symbol === coinSymbol && p.position_qty < 0);

                                    if (newPosition) {
                                        // Gate.io 실제 진입가 조회
                                        const gateioPosition = await getGateIOPositionByContract(gateioContract);
                                        const gateioEntryPrice = gateioPosition ? parseFloat(gateioPosition.entry_price) : highestDifference.gateio_price;

                                        const orderlyEntryPrice = newPosition.average_open_price || highestDifference.orderly_price;

                                        this.positionManager.setPositionEntryPrice(
                                            coinSymbol,
                                            orderlyEntryPrice,
                                            gateioEntryPrice
                                        );

                                        // 차익거래 진입 정보 로그
                                        console.log(`\n💰 ${coinSymbol} 차익거래 진입 완료! ===`);
                                        console.log(`📈 진입 시점 정보:`);
                                        console.log(`  - Orderly 진입가: $${orderlyEntryPrice.toFixed(6)}`);
                                        console.log(`  - Gate.io 진입가: $${gateioEntryPrice.toFixed(6)}`);
                                        console.log(`  - 거래 수량: ${Math.abs(newPosition.position_qty).toFixed(6)}`);
                                        console.log(`  - 거래 방향: Gate.io 매수 + Orderly 매도`);
                                        console.log(`  - 진입 시 가격차이율: ${((orderlyEntryPrice - gateioEntryPrice) / gateioEntryPrice * 100).toFixed(4)}%`);
                                        console.log(`  - 예상 수익률: ${((orderlyEntryPrice - gateioEntryPrice) / gateioEntryPrice * 100).toFixed(4)}%`);

                                    } else {
                                        this.positionManager.setPositionEntryPrice(
                                            coinSymbol,
                                            highestDifference.orderly_price,
                                            highestDifference.gateio_price
                                        );

                                        // 차익거래 진입 정보 로그 (실제 체결 정보 없음)
                                        console.log(`\n💰 ${coinSymbol} 차익거래 진입 완료! ===`);
                                        console.log(`📈 진입 시점 정보:`);
                                        console.log(`  - Orderly 진입가: $${highestDifference.orderly_price.toFixed(6)}`);
                                        console.log(`  - Gate.io 진입가: $${highestDifference.gateio_price.toFixed(6)}`);
                                        console.log(`  - 거래 방향: Gate.io 매수 + Orderly 매도`);
                                        console.log(`  - 진입 시 가격차이율: ${((highestDifference.orderly_price - highestDifference.gateio_price) / highestDifference.gateio_price * 100).toFixed(4)}%`);
                                        console.log(`  - 예상 수익률: ${((highestDifference.orderly_price - highestDifference.gateio_price) / highestDifference.gateio_price * 100).toFixed(4)}%`);
                                    }
                                } else {
                                    console.log(`[Orderly 수량 동기화] 공매도 실패`);
                                }
                            } catch (sellError) {
                                console.log(`[Orderly 수량 동기화] 공매도 오류: ${sellError}`);
                            }
                        }
                    } else {
                        console.log(`[Gate.io 자동매매] 매수 실패`);
                    }
                } catch (gateioError) {
                    console.log(`[Gate.io 자동매매] 매수 오류: ${gateioError}`);
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