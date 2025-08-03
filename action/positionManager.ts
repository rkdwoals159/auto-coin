import { getAllPositionsInfo } from '../aden/request/get/getAllPositionsInfo';
import { autoClosePosition, printClosePositionResult } from '../aden/request/post/closePosition';
import { createGateIOPositionCloseOrder } from '../gateio/request/post/createFuturesOrder';
import { getGateIOPositionByContract, getGateIOPositions } from '../gateio/request/get/getPositions';
import { ApiClient } from '../services/apiClient';
import { EnvironmentManager } from '../config/environment';
import { createOrderlyAuthHeaders } from '../aden/request/get/orderlyOrderbook';

/**
 * 포지션 진입 시점 가격 정보
 */
export interface PositionEntryPrice {
    orderlyPrice: number;
    gateioPrice: number;
}

/**
 * 포지션 관리자 클래스
 */
export class PositionManager {
    private positionEntryPriceDifferences: Map<string, PositionEntryPrice> = new Map();
    private apiClient: ApiClient;
    private envManager: EnvironmentManager;

    constructor() {
        this.apiClient = new ApiClient();
        this.envManager = EnvironmentManager.getInstance();
    }

    /**
     * 포지션 진입 가격 정보 저장
     */
    setPositionEntryPrice(symbol: string, orderlyPrice: number, gateioPrice: number): void {
        this.positionEntryPriceDifferences.set(symbol, { orderlyPrice, gateioPrice });
        console.log(`📝 ${symbol} 포지션 진입 가격 저장: Orderly ${orderlyPrice}, Gate.io ${gateioPrice}`);
    }

    /**
     * 포지션 진입 가격 정보 조회
     */
    getPositionEntryPrice(symbol: string): PositionEntryPrice | undefined {
        return this.positionEntryPriceDifferences.get(symbol);
    }

    /**
     * 포지션 진입 가격 정보 삭제
     */
    removePositionEntryPrice(symbol: string): void {
        this.positionEntryPriceDifferences.delete(symbol);
    }

    /**
     * 현재 Gate.io 가격 조회 (실시간 API 호출)
     */
    async getCurrentGateioPrice(symbol: string): Promise<number | null> {
        try {
            // Gate.io 심볼로 변환
            const contract = symbol.replace('PERP_', '').replace('_USDC', '') + '_USDT';

            // Gate.io API를 통해 현재 가격 조회
            const response = await fetch(`https://api.gateio.ws/api/v4/futures/usdt/contracts/${contract}`);

            if (!response.ok) {
                return null;
            }

            const data = await response.json() as any;
            const price = data.mark_price;

            if (price && !isNaN(parseFloat(price))) {
                return parseFloat(price);
            }

            return null;
        } catch (error) {
            return null;
        }
    }

    /**
     * 포지션 종료 조건 확인 및 실행 (임시: 5초 후 자동 종료)
     */
    async checkAndClosePositions(
        orderlyAuth: { accountId: string; secretKey: Uint8Array },
        gateioData: any[]
    ): Promise<void> {
        console.log('\n=== 포지션 종료 조건 체크 (임시: 5초 후 자동 종료) ===');

        // 5초 대기
        console.log('5초 후 자동 포지션 종료...');
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Orderly 포지션 종료
        const currentPositions = await getAllPositionsInfo(orderlyAuth.accountId, orderlyAuth.secretKey, false);
        if (currentPositions && currentPositions.rows.length > 0) {
            for (const position of currentPositions.rows) {
                if (position.position_qty === 0) continue;

                console.log(`\n⚠️ 자동 포지션 종료: ${position.symbol}`);
                console.log(`수량: ${position.position_qty}`);

                // 진입 가격 정보 가져오기
                const entryPrice = this.getPositionEntryPrice(position.symbol);
                if (entryPrice) {
                    // 현재 가격 조회
                    const marketInfo = await this.apiClient.getOrderlyMarketData(['mark_price']);
                    const symbolInfo = marketInfo.find(item => item.symbol === position.symbol);
                    const currentOrderlyPrice = symbolInfo ? symbolInfo.mark_price : 0;
                    const currentGateioPrice = await this.getCurrentGateioPrice(position.symbol);

                    if (currentOrderlyPrice && currentGateioPrice) {
                        const positionQuantity = Math.abs(position.position_qty);

                        const closeResult = await autoClosePosition(
                            position.symbol,
                            orderlyAuth.accountId,
                            orderlyAuth.secretKey,
                            'MARKET',
                            false
                        );

                        printClosePositionResult(closeResult);

                        // 수익률 계산 및 출력
                        if (closeResult.success) {
                            // 실제 종료 체결가 조회
                            const actualOrderlyClosePrice = closeResult.orderId ? await this.getOrderlyOrderClosePrice(closeResult.orderId.toString()) : null;
                            const actualGateioClosePrice = await this.getGateIOPositionClosePrice(position.symbol);

                            await this.calculateAndPrintProfitLoss(
                                position.symbol,
                                entryPrice.orderlyPrice,
                                entryPrice.gateioPrice,
                                actualOrderlyClosePrice || currentOrderlyPrice,
                                actualGateioClosePrice || currentGateioPrice,
                                positionQuantity,
                                closeResult
                            );
                        }
                    }
                } else {
                    // 진입 가격 정보가 없는 경우 기본 종료
                    const closeResult = await autoClosePosition(
                        position.symbol,
                        orderlyAuth.accountId,
                        orderlyAuth.secretKey,
                        'MARKET',
                        false
                    );

                    printClosePositionResult(closeResult);
                }

                this.removePositionEntryPrice(position.symbol);
            }
        }

        // Gate.io 포지션 종료
        try {
            // 모든 Gate.io 포지션 조회
            const allGateioPositions = await getGateIOPositions('usdt');
            if (allGateioPositions && allGateioPositions.length > 0) {
                for (const gateioPosition of allGateioPositions) {
                    if (parseFloat(gateioPosition.size) !== 0) {
                        console.log(`\n⚠️ Gate.io 자동 포지션 종료: ${gateioPosition.contract}`);
                        console.log(`수량: ${gateioPosition.size}`);

                        // Orderly 심볼로 변환하여 진입 가격 정보 찾기
                        const orderlySymbol = 'PERP_' + gateioPosition.contract.replace('_USDT', '') + '_USDC';
                        const entryPrice = this.getPositionEntryPrice(orderlySymbol);

                        if (entryPrice) {
                            // 현재 가격 조회
                            const currentGateioPrice = await this.getCurrentGateioPrice(gateioPosition.contract);
                            const currentOrderlyPrice = await this.getCurrentOrderlyPrice(orderlySymbol);

                            if (currentOrderlyPrice && currentGateioPrice) {
                                const positionQuantity = Math.abs(parseFloat(gateioPosition.size));

                                const closeResult = await createGateIOPositionCloseOrder(
                                    gateioPosition.contract,
                                    parseFloat(gateioPosition.size),
                                    'usdt'
                                );

                                if (closeResult && closeResult.id) {
                                    console.log(`✅ Gate.io 포지션 종료 성공! 주문ID: ${closeResult.id}`);
                                    console.log(`체결 가격: ${closeResult.fill_price}`);

                                    // 실제 체결가 조회
                                    let actualOrderlyClosePrice = currentOrderlyPrice;
                                    let actualGateioClosePrice = currentGateioPrice;

                                    // Gate.io 실제 체결가 조회
                                    const gateioClosePrice = await this.getGateIOPositionClosePrice(gateioPosition.contract);
                                    if (gateioClosePrice) {
                                        actualGateioClosePrice = gateioClosePrice;
                                    }

                                    // 수익률 계산 및 출력
                                    await this.calculateAndPrintProfitLoss(
                                        gateioPosition.contract,
                                        entryPrice.orderlyPrice,
                                        entryPrice.gateioPrice,
                                        actualOrderlyClosePrice,
                                        actualGateioClosePrice,
                                        positionQuantity,
                                        closeResult
                                    );
                                } else {
                                    console.log(`❌ Gate.io 포지션 종료 실패`);
                                }
                            }
                        } else {
                            // 진입 가격 정보가 없는 경우 기본 종료
                            const closeResult = await createGateIOPositionCloseOrder(
                                gateioPosition.contract,
                                parseFloat(gateioPosition.size),
                                'usdt'
                            );

                            if (closeResult && closeResult.id) {
                                console.log(`✅ Gate.io 포지션 종료 성공! 주문ID: ${closeResult.id}`);
                                console.log(`체결 가격: ${closeResult.fill_price}`);
                            } else {
                                console.log(`❌ Gate.io 포지션 종료 실패`);
                            }
                        }
                    }
                }
            } else {
                console.log('Gate.io 포지션이 없습니다.');
            }
        } catch (error) {
            console.log(`Gate.io 포지션 종료 오류: ${error}`);
        }
    }

    /**
     * 개별 포지션 종료 조건 확인
     */
    private async checkPositionForClose(
        position: any,
        entryPrice: PositionEntryPrice,
        gateioData: any[],
        orderlyAuth: { accountId: string; secretKey: Uint8Array }
    ): Promise<void> {
        const marketInfo = await this.apiClient.getOrderlyMarketData(['mark_price']);
        const symbolInfo = marketInfo.find(item => item.symbol === position.symbol);

        if (symbolInfo && symbolInfo.mark_price) {
            const currentOrderlyPrice = symbolInfo.mark_price;
            const currentGateioPrice = await this.getCurrentGateioPrice(position.symbol);

            if (currentGateioPrice) {
                console.log(`${position.symbol}: 현재 Orderly ${currentOrderlyPrice}, Gate.io ${currentGateioPrice}, 가격차이율 : ${((currentOrderlyPrice - currentGateioPrice) / currentGateioPrice * 100).toFixed(4)}%`);
                console.log(`${position.symbol}: 진입 시 Orderly ${entryPrice.orderlyPrice}, Gate.io ${entryPrice.gateioPrice}, 가격차이율 : ${((entryPrice.orderlyPrice - entryPrice.gateioPrice) / entryPrice.gateioPrice * 100).toFixed(4)}%`);

                // 가격차이율 반전 확인
                const entryOrderlyHigher = entryPrice.orderlyPrice > entryPrice.gateioPrice;
                const currentOrderlyHigher = currentOrderlyPrice > currentGateioPrice;

                if (entryOrderlyHigher !== currentOrderlyHigher) {
                    console.log(`\n⚠️ 가격차이율 반전! ${position.symbol} 포지션 종료`);
                    console.log(`진입 시: Orderly ${entryOrderlyHigher ? '높음' : '낮음'}`);
                    console.log(`현재: Orderly ${currentOrderlyHigher ? '높음' : '낮음'}`);
                    console.log(`수량: ${position.position_qty}`);

                    // 진입 시 정보 저장
                    const entryOrderlyPrice = entryPrice.orderlyPrice;
                    const entryGateioPrice = entryPrice.gateioPrice;
                    const positionQuantity = Math.abs(position.position_qty);

                    const closeResult = await autoClosePosition(
                        position.symbol,
                        orderlyAuth.accountId,
                        orderlyAuth.secretKey,
                        'MARKET',
                        false
                    );

                    printClosePositionResult(closeResult);

                    // 실제 수익률 및 금액 계산
                    if (closeResult.success) {
                        // 실제 체결가 조회
                        let actualOrderlyClosePrice = currentOrderlyPrice;
                        let actualGateioClosePrice = currentGateioPrice;

                        // Orderly 실제 체결가 조회
                        if (closeResult.orderId) {
                            const orderlyClosePrice = await this.getOrderlyOrderClosePrice(closeResult.orderId.toString());
                            if (orderlyClosePrice) {
                                actualOrderlyClosePrice = orderlyClosePrice;
                            }
                        }

                        // Gate.io 실제 체결가 조회
                        const gateioClosePrice = await this.getGateIOPositionClosePrice(position.symbol);
                        if (gateioClosePrice) {
                            actualGateioClosePrice = gateioClosePrice;
                        }

                        await this.calculateAndPrintProfitLoss(
                            position.symbol,
                            entryOrderlyPrice,
                            entryGateioPrice,
                            actualOrderlyClosePrice,
                            actualGateioClosePrice,
                            positionQuantity,
                            closeResult
                        );
                    }

                    // 포지션 종료 후 진입 가격 정보 삭제
                    this.removePositionEntryPrice(position.symbol);
                }
            }
        }
    }

    /**
     * Gate.io 개별 포지션 종료 조건 확인
     */
    private async checkGateIOPositionForClose(
        gateioPosition: any,
        entryPrice: PositionEntryPrice,
        gateioData: any[]
    ): Promise<void> {
        const currentGateioPrice = await this.getCurrentGateioPrice(gateioPosition.contract);
        const currentOrderlyPrice = await this.getCurrentOrderlyPrice('PERP_S_USDC'); // 임시로 S_USDC

        if (currentGateioPrice && currentOrderlyPrice) {
            console.log(`${gateioPosition.contract}: 현재 Orderly ${currentOrderlyPrice}, Gate.io ${currentGateioPrice}`);
            console.log(`${gateioPosition.contract}: 진입 시 Orderly ${entryPrice.orderlyPrice}, Gate.io ${entryPrice.gateioPrice}`);

            // 가격차이율 반전 확인
            const entryOrderlyHigher = entryPrice.orderlyPrice > entryPrice.gateioPrice;
            const currentOrderlyHigher = currentOrderlyPrice > currentGateioPrice;

            if (entryOrderlyHigher !== currentOrderlyHigher) {
                console.log(`\n⚠️ 가격차이율 반전! ${gateioPosition.contract} Gate.io 포지션 종료`);
                console.log(`진입 시: Orderly ${entryOrderlyHigher ? '높음' : '낮음'}`);
                console.log(`현재: Orderly ${currentOrderlyHigher ? '높음' : '낮음'}`);
                console.log(`수량: ${gateioPosition.size}`);

                // 진입 시 정보 저장
                const entryOrderlyPrice = entryPrice.orderlyPrice;
                const entryGateioPrice = entryPrice.gateioPrice;
                const positionQuantity = Math.abs(parseFloat(gateioPosition.size));

                try {
                    const closeResult = await createGateIOPositionCloseOrder(
                        gateioPosition.contract,
                        parseFloat(gateioPosition.size),
                        'usdt'
                    );

                    if (closeResult && closeResult.id) {
                        console.log(`✅ Gate.io 포지션 종료 성공! 주문ID: ${closeResult.id}`);
                        console.log(`체결 가격: ${closeResult.fill_price}`);

                        // 실제 수익률 및 금액 계산
                        await this.calculateAndPrintProfitLoss(
                            gateioPosition.contract,
                            entryOrderlyPrice,
                            entryGateioPrice,
                            currentOrderlyPrice,
                            currentGateioPrice,
                            positionQuantity,
                            closeResult
                        );
                    } else {
                        console.log(`❌ Gate.io 포지션 종료 실패`);
                    }
                } catch (error) {
                    console.log(`Gate.io 포지션 종료 오류: ${error}`);
                }
            }
        }
    }

    /**
     * Orderly 현재 가격 조회
     */
    private async getCurrentOrderlyPrice(symbol: string): Promise<number | null> {
        try {
            const marketInfo = await this.apiClient.getOrderlyMarketData(['mark_price']);
            const symbolInfo = marketInfo.find(item => item.symbol === symbol);
            return symbolInfo ? symbolInfo.mark_price : null;
        } catch (error) {
            console.error(`Orderly 가격 조회 실패 (${symbol}):`, error);
            return null;
        }
    }

    /**
     * Orderly 주문 체결가 조회
     */
    private async getOrderlyOrderClosePrice(orderId: string): Promise<number | null> {
        try {
            // Orderly API를 통해 주문 체결 내역 조회 (인증 필요)
            if (!this.envManager.hasOrderlyAuth()) {
                return null;
            }

            const auth = this.envManager.getOrderlyAuth();
            const baseUrl = 'https://api.orderly.org';

            // 여러 가능한 엔드포인트 시도
            const endpoints = [
                `/v1/orders/${orderId}/fills`,
                `/v1/orders/${orderId}/trades`,
                `/v1/orders/${orderId}`,
                `/v1/trades?order_id=${orderId}`
            ];

            for (const endpoint of endpoints) {
                try {
                    const url = new URL(endpoint, baseUrl);

                    // 기존 인증 헤더 생성 함수 사용
                    const headers = await createOrderlyAuthHeaders(
                        auth.accountId!,
                        auth.secretKey as Uint8Array,
                        url
                    );

                    const response = await fetch(url.toString(), {
                        method: 'GET',
                        headers: {
                            'Content-Type': 'application/json',
                            ...headers
                        }
                    });

                    if (response.ok) {
                        const data = await response.json() as any;

                        // 데이터 구조에 따라 체결가 추출
                        let fillPrice = null;

                        if (Array.isArray(data)) {
                            // 배열 형태인 경우 (fills, trades)
                            if (data.length > 0) {
                                const lastItem = data[data.length - 1];
                                fillPrice = lastItem.price || lastItem.fill_price || lastItem.exec_price;
                            }
                        } else if (data.data && data.data.rows) {
                            // trades 엔드포인트 응답 구조
                            const trades = data.data.rows;
                            if (trades.length > 0) {
                                // 해당 주문의 체결 내역 찾기
                                const orderTrades = trades.filter((trade: any) => trade.order_id.toString() === orderId);
                                if (orderTrades.length > 0) {
                                    // 가장 최근 체결가 사용
                                    const latestTrade = orderTrades[orderTrades.length - 1];
                                    fillPrice = latestTrade.executed_price;
                                }
                            }
                        } else if (data.data) {
                            // 객체 형태인 경우
                            const orderData = data.data;
                            fillPrice = orderData.price || orderData.fill_price || orderData.exec_price;
                        }

                        if (fillPrice) {
                            return parseFloat(fillPrice);
                        }
                    }
                } catch (error) {
                    // 에러 무시하고 다음 엔드포인트 시도
                }
            }

            return null;
        } catch (error) {
            return null;
        }
    }

    /**
     * Gate.io 포지션 종료 및 체결가 조회
     */
    private async getGateIOPositionClosePrice(symbol: string): Promise<number | null> {
        try {
            // Gate.io 심볼로 변환
            const gateioContract = symbol.replace('PERP_', '').replace('_USDC', '') + '_USDT';

            // Gate.io 포지션 조회
            const gateioPositions = await getGateIOPositions('usdt');
            const gateioPosition = gateioPositions.find(p => p.contract === gateioContract);

            if (gateioPosition && parseFloat(gateioPosition.size) !== 0) {
                // Gate.io 포지션 종료
                const closeResult = await createGateIOPositionCloseOrder(
                    gateioContract,
                    parseFloat(gateioPosition.size),
                    'usdt'
                );

                if (closeResult && closeResult.id) {
                    console.log(`✅ Gate.io 포지션 종료 성공! 주문ID: ${closeResult.id}`);
                    console.log(`체결 가격: ${closeResult.fill_price}`);

                    // 체결가 반환
                    return parseFloat(closeResult.fill_price);
                }
            }
            return null;
        } catch (error) {
            console.log(`Gate.io 포지션 종료 및 체결가 조회 오류: ${symbol} -> ${error}`);
            return null;
        }
    }

    /**
     * 수익률 및 금액 계산 및 출력
     */
    private async calculateAndPrintProfitLoss(
        symbol: string,
        entryOrderlyPrice: number,
        entryGateioPrice: number,
        currentOrderlyPrice: number,
        currentGateioPrice: number,
        positionQuantity: number,
        closeResult: any
    ): Promise<void> {
        try {
            console.log(`\n💰 ${symbol} 차익거래 수익률 분석 ===`);

            // 진입 시 정보
            console.log(`📈 진입 시점:`);
            console.log(`  - Orderly 가격: $${entryOrderlyPrice.toFixed(6)}`);
            console.log(`  - Gate.io 가격: $${entryGateioPrice.toFixed(6)}`);
            console.log(`  - 가격차이율: ${((entryOrderlyPrice - entryGateioPrice) / entryGateioPrice * 100).toFixed(4)}%`);

            // 종료 시 정보
            console.log(`📉 종료 시점:`);
            console.log(`  - Orderly 가격: $${currentOrderlyPrice.toFixed(6)}`);
            console.log(`  - Gate.io 가격: $${currentGateioPrice.toFixed(6)}`);
            console.log(`  - 가격차이율: ${((currentOrderlyPrice - currentGateioPrice) / currentGateioPrice * 100).toFixed(4)}%`);

            // 거래 방향 판단 (실제 거래 방향 기준)
            // Orderly에서 매도 + Gate.io에서 매수 (Orderly 가격이 높을 때)
            const entryOrderlyHigher = entryOrderlyPrice > entryGateioPrice;
            const tradeDirection = entryOrderlyHigher ? 'Orderly 매도 + Gate.io 매수' : 'Gate.io 매도 + Orderly 매수';
            console.log(`🔄 거래 방향: ${tradeDirection}`);

            // 각 거래소별 수익 계산
            let orderlyProfit = 0;
            let gateioProfit = 0;
            let totalInvestment = 0;

            if (entryOrderlyHigher) {
                // Orderly에서 매도, Gate.io에서 매수한 경우
                // Orderly: 매도 → 매수 (숏 포지션)
                orderlyProfit = (entryOrderlyPrice - currentOrderlyPrice) * positionQuantity;
                // Gate.io: 매수 → 매도 (롱 포지션)
                gateioProfit = (currentGateioPrice - entryGateioPrice) * positionQuantity;
                totalInvestment = entryOrderlyPrice * positionQuantity; // Orderly 진입 금액
            } else {
                // Gate.io에서 매도, Orderly에서 매수한 경우
                // Gate.io: 매도 → 매수 (숏 포지션)
                gateioProfit = (entryGateioPrice - currentGateioPrice) * positionQuantity;
                // Orderly: 매수 → 매도 (롱 포지션)
                orderlyProfit = (currentOrderlyPrice - entryOrderlyPrice) * positionQuantity;
                totalInvestment = entryGateioPrice * positionQuantity; // Gate.io 진입 금액
            }

            // 총 수익 계산
            const totalProfit = orderlyProfit + gateioProfit;
            const totalProfitPercent = (totalProfit / totalInvestment) * 100;

            // 수수료 계산 (각 거래소별 실제 수수료)
            const orderlyFee = (entryOrderlyPrice + currentOrderlyPrice) * positionQuantity * 0.00018; // Orderly 0.018%
            const gateioFee = (entryGateioPrice + currentGateioPrice) * positionQuantity * 0.00016; // Gate.io 0.016%
            const totalFee = orderlyFee + gateioFee;

            // 순수익 계산
            const netProfit = totalProfit - totalFee;
            const netProfitPercent = (netProfit / totalInvestment) * 100;

            console.log(`\n💵 거래소별 수익 분석:`);
            console.log(`  - 거래 수량: ${positionQuantity.toFixed(6)}`);
            console.log(`  - 총 투자 금액: $${totalInvestment.toFixed(6)}`);
            console.log(`\n📊 Orderly 거래소:`);
            console.log(`  - 진입가: $${entryOrderlyPrice.toFixed(6)}`);
            console.log(`  - 종료가: $${currentOrderlyPrice.toFixed(6)}`);
            console.log(`  - 수익/손실: $${orderlyProfit.toFixed(6)}`);
            console.log(`  - 수수료: $${orderlyFee.toFixed(6)}`);
            console.log(`\n📊 Gate.io 거래소:`);
            console.log(`  - 진입가: $${entryGateioPrice.toFixed(6)}`);
            console.log(`  - 종료가: $${currentGateioPrice.toFixed(6)}`);
            console.log(`  - 수익/손실: $${gateioProfit.toFixed(6)}`);
            console.log(`  - 수수료: $${gateioFee.toFixed(6)}`);

            console.log(`\n💰 최종 수익 분석:`);
            console.log(`  - 총 수익/손실: $${totalProfit.toFixed(6)}`);
            console.log(`  - 총 수수료: $${totalFee.toFixed(6)}`);
            console.log(`  - 순 수익/손실: $${netProfit.toFixed(6)}`);
            console.log(`  - 총 수익률: ${totalProfitPercent.toFixed(4)}%`);
            console.log(`  - 순 수익률: ${netProfitPercent.toFixed(4)}%`);

            // 결과 표시
            if (netProfit > 0) {
                console.log(`✅ 차익거래 성공! 순수익: $${netProfit.toFixed(6)} (${netProfitPercent.toFixed(4)}%)`);
            } else {
                console.log(`❌ 차익거래 손실: 순손실: $${Math.abs(netProfit).toFixed(6)} (${Math.abs(netProfitPercent).toFixed(4)}%)`);
            }

            // 추가 통계
            const priceChangeOrderly = ((currentOrderlyPrice - entryOrderlyPrice) / entryOrderlyPrice) * 100;
            const priceChangeGateio = ((currentGateioPrice - entryGateioPrice) / entryGateioPrice) * 100;

            console.log(`\n📊 가격 변동:`);
            console.log(`  - Orderly 가격 변동: ${priceChangeOrderly.toFixed(4)}%`);
            console.log(`  - Gate.io 가격 변동: ${priceChangeGateio.toFixed(4)}%`);
            console.log(`  - 가격차이율 변화: ${((currentOrderlyPrice - currentGateioPrice) / currentGateioPrice * 100 - (entryOrderlyPrice - entryGateioPrice) / entryGateioPrice * 100).toFixed(4)}%`);

        } catch (error) {
            console.error(`수익률 계산 중 오류: ${error}`);
        }
    }

    /**
     * 포지션 모니터링
     */
    async monitorPositions(
        orderlyAuth: { accountId: string; secretKey: Uint8Array },
        gateioData: any[],
        endTime: Date,
        isRunning: boolean
    ): Promise<void> {
        console.log('\n=== 포지션 모니터링 시작 ===');
        let positionClosed = false;
        let monitoringCount = 0;

        while (!positionClosed && isRunning && new Date() < endTime) {
            try {
                const checkPositions = await getAllPositionsInfo(orderlyAuth.accountId, orderlyAuth.secretKey, false);
                const activePositions = checkPositions?.rows.filter(p => p.position_qty !== 0) || [];

                monitoringCount++;

                if (activePositions.length === 0) {
                    console.log('✅ 모든 포지션이 종료되었습니다. 모니터링을 재개합니다.');
                    positionClosed = true;
                    break;
                }

                // 각 활성 포지션에 대해 종료 조건 확인
                for (const position of activePositions) {
                    const currentPriceDiff = this.getPositionEntryPrice(position.symbol);
                    if (currentPriceDiff) {
                        await this.checkPositionForClose(position, currentPriceDiff, gateioData, orderlyAuth);
                    }
                }

                // 10초마다 포지션 상태 확인
                await new Promise(resolve => setTimeout(resolve, 10000));

                // 진행 상황 출력 (1분마다 - 6회마다)
                if (monitoringCount % 6 === 0) {
                    console.log(`포지션 모니터링 중... 활성 포지션: ${activePositions.length}개 (${monitoringCount * 10}초 경과)`);

                    // 각 활성 포지션의 상세 정보 출력
                    for (const position of activePositions) {
                        const currentPriceDiff = this.getPositionEntryPrice(position.symbol);
                        if (currentPriceDiff) {
                            await this.printPositionDetails(position, currentPriceDiff, gateioData);
                        }
                    }
                }

            } catch (error: any) {
                console.error('포지션 모니터링 중 에러:', error);
                await new Promise(resolve => setTimeout(resolve, 10000));
            }
        }
    }

    /**
     * 포지션 상세 정보 출력
     */
    private async printPositionDetails(
        position: any,
        entryPrice: PositionEntryPrice,
        gateioData: any[]
    ): Promise<void> {
        const marketInfo = await this.apiClient.getOrderlyMarketData(['mark_price']);
        const symbolInfo = marketInfo.find(item => item.symbol === position.symbol);

        if (symbolInfo && symbolInfo.mark_price) {
            const currentOrderlyPrice = symbolInfo.mark_price;
            const currentGateioPrice = await this.getCurrentGateioPrice(position.symbol);

            if (currentGateioPrice) {
                const entryOrderlyHigher = entryPrice.orderlyPrice > entryPrice.gateioPrice;
                const currentOrderlyHigher = currentOrderlyPrice > currentGateioPrice;

                // 현재 가격차이율 계산
                const currentPriceDiffPercent = Math.abs(currentOrderlyPrice - currentGateioPrice) / currentGateioPrice * 100;
                const entryPriceDiffPercent = Math.abs(entryPrice.orderlyPrice - entryPrice.gateioPrice) / entryPrice.gateioPrice * 100;

                console.log(`  📊 ${position.symbol}:`);
                console.log(`    진입 시 - Orderly: ${entryPrice.orderlyPrice.toFixed(6)}, Gate.io: ${entryPrice.gateioPrice.toFixed(6)} (차이: ${entryPriceDiffPercent.toFixed(4)}%)`);
                console.log(`    현재 - Orderly: ${currentOrderlyPrice.toFixed(6)}, Gate.io: ${currentGateioPrice.toFixed(6)} (차이: ${currentPriceDiffPercent.toFixed(4)}%)`);
                console.log(`    포지션: ${position.position_qty} (${position.position_qty > 0 ? '롱' : '숏'})`);
                console.log(`    가격차이율 반전: ${entryOrderlyHigher !== currentOrderlyHigher ? '⚠️ 반전됨' : '🟢 유지'}`);
            } else {
                console.log(`  📊 ${position.symbol}: Gate.io 가격 조회 실패`);
            }
        }
    }
} 