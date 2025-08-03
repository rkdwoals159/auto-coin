import { EnvironmentManager } from '../config/environment';
import { getGateIOFuturesAccount, printUSDTBalance } from '../gateio/request/get/getAssetHistory';
import { getUSDCBalance, printUSDCBalance } from '../aden/request/get/getAssetHistory';
import { getGateIOMarketInfoWithSelectedFields, getGateIOMarketInfoWith24hAmountFilter } from '../gateio/request/get/getMarketInfoForAllSymbols';
import { getMarketInfoWithSelectedFields } from '../aden/request/get/getMarketInfoForAllSymbols';
import { getAllPositionsInfo, printPositionsInfo, PositionSummary } from '../aden/request/get/getAllPositionsInfo';
import {
    createOrder,
    createMarketBuyOrder,
    createMarketSellOrder,
    createLimitBuyOrder,
    createLimitSellOrder,
    printOrderResponse,
    validateOrderRequest,
    CreateOrderRequest,
    CreateOrderResponse
} from '../aden/request/post/createOrder';

/**
 * API 클라이언트 관리 클래스
 */
export class ApiClient {
    private envManager: EnvironmentManager;

    constructor() {
        this.envManager = EnvironmentManager.getInstance();
    }

    /**
     * Gate.io 시장 정보 조회
     */
    async getGateIOMarketData(selectedFields: string[] = ['mark_price', 'index_price']) {
        return await getGateIOMarketInfoWithSelectedFields(selectedFields);
    }

    /**
     * Gate.io 시장 정보 조회 (24시간 거래금액 기준 필터링)
     */
    async getGateIOMarketDataWith24hAmountFilter(selectedFields: string[] = ['mark_price', 'index_price', 'trade_size', 'quote_volume'], minAmount: number = 300000) {
        return await getGateIOMarketInfoWith24hAmountFilter(selectedFields, minAmount);
    }

    /**
     * Orderly 시장 정보 조회
     */
    async getOrderlyMarketData(selectedFields: string[] = ['mark_price', 'index_price']) {
        const adenBaseUrl = 'https://api.orderly.org';
        return await getMarketInfoWithSelectedFields(adenBaseUrl, selectedFields);
    }

    /**
     * Orderly 시장 정보 조회 (24시간 거래금액 기준 필터링)
     */
    async getOrderlyMarketDataWith24hAmountFilter(selectedFields: string[] = ['mark_price', 'index_price', '24h_amount'], minAmount: number = 300000) {
        const adenBaseUrl = 'https://api.orderly.org';
        const allData = await getMarketInfoWithSelectedFields(adenBaseUrl, selectedFields);

        // 24시간 거래금액 기준으로 필터링
        return allData.filter(item => {
            const amount24h = item['24h_amount'] || 0;
            return amount24h >= minAmount;
        });
    }

    /**
     * Gate.io Futures 계정 조회
     */
    async getGateIOFuturesData() {
        console.log('\n=== Gate.io Futures 계정 조회 ===');

        if (!this.envManager.hasGateIOAuth()) {
            console.log('⚠️  Gate.io API 인증 정보가 없어 futures 계정 조회를 건너뜁니다.');
            console.log('환경 변수 설정: GATEIO_API_KEY, GATEIO_SECRET_KEY');
            return null;
        }

        try {
            console.log('Gate.io API 인증 정보 확인 완료');
            const auth = this.envManager.getGateIOAuth();
            const futuresAccount = await getGateIOFuturesAccount('usdt', auth.apiKey!, auth.secretKey! as string);
            printUSDTBalance(futuresAccount);
            return futuresAccount;
        } catch (error) {
            console.error('Gate.io Futures 계정 조회 실패:', error);
            return null;
        }
    }

    /**
     * Orderly USDC 잔고 조회
     */
    async getOrderlyUSDCBalance() {
        console.log('\n=== USDC 잔고 조회 ===');

        if (!this.envManager.hasOrderlyAuth()) {
            console.log('⚠️  Orderly API 인증 정보가 없어 USDC 잔고 조회를 건너뜁니다.');
            return null;
        }

        try {
            const auth = this.envManager.getOrderlyAuth();
            const usdcBalance = await getUSDCBalance(auth.accountId!, auth.secretKey! as Uint8Array, false);

            if (usdcBalance) {
                printUSDCBalance(usdcBalance);
            }

            return usdcBalance;
        } catch (error) {
            console.error('USDC 잔고 조회 실패:', error);
            return null;
        }
    }

    /**
     * Orderly 포지션 정보 조회
     */
    async getOrderlyPositions() {
        console.log('\n=== Orderly 포지션 정보 조회 ===');

        if (!this.envManager.hasOrderlyAuth()) {
            console.log('⚠️  Orderly API 인증 정보가 없어 포지션 조회를 건너뜁니다.');
            return null;
        }

        try {
            const auth = this.envManager.getOrderlyAuth();
            const positions = await getAllPositionsInfo(auth.accountId!, auth.secretKey! as Uint8Array, false);

            if (positions) {
                printPositionsInfo(positions);
            }

            return positions;
        } catch (error) {
            console.error('Orderly 포지션 조회 실패:', error);
            return null;
        }
    }

    /**
     * Orderly 주문 생성
     */
    async createOrderlyOrder(request: CreateOrderRequest) {
        console.log('\n=== Orderly 주문 생성 ===');

        if (!this.envManager.hasOrderlyAuth()) {
            console.log('⚠️  Orderly API 인증 정보가 없어 주문 생성을 건너뜁니다.');
            return null;
        }

        // 주문 요청 데이터 검증
        const validation = validateOrderRequest(request);
        if (!validation.isValid) {
            console.error('주문 요청 데이터 검증 실패:', validation.error);
            return null;
        }

        try {
            const auth = this.envManager.getOrderlyAuth();
            const orderResponse = await createOrder(request, auth.accountId!, auth.secretKey! as Uint8Array, false);

            if (orderResponse) {
                printOrderResponse(orderResponse);
            }

            return orderResponse;
        } catch (error) {
            console.error('Orderly 주문 생성 실패:', error);
            return null;
        }
    }

    /**
     * 시장가 매수 주문 생성
     */
    async createMarketBuyOrder(symbol: string, quantity: number, clientOrderId?: string) {
        if (!this.envManager.hasOrderlyAuth()) {
            console.log('⚠️  Orderly API 인증 정보가 없습니다.');
            return null;
        }

        try {
            const auth = this.envManager.getOrderlyAuth();
            const orderResponse = await createMarketBuyOrder(
                symbol,
                quantity,
                auth.accountId!,
                auth.secretKey! as Uint8Array,
                clientOrderId,
                false,
                false // reduce_only = false (새로운 포지션 생성)
            );

            if (orderResponse) {
                printOrderResponse(orderResponse);
            }

            return orderResponse;
        } catch (error) {
            console.error('시장가 매수 주문 생성 실패:', error);
            return null;
        }
    }

    /**
     * 시장가 매도 주문 생성
     */
    async createMarketSellOrder(symbol: string, quantity: number, clientOrderId?: string) {
        if (!this.envManager.hasOrderlyAuth()) {
            console.log('⚠️  Orderly API 인증 정보가 없습니다.');
            return null;
        }

        try {
            const auth = this.envManager.getOrderlyAuth();
            const orderResponse = await createMarketSellOrder(
                symbol,
                quantity,
                auth.accountId!,
                auth.secretKey! as Uint8Array,
                clientOrderId,
                false,
                true // reduce_only = true (기존 포지션 줄이기)
            );

            if (orderResponse) {
                printOrderResponse(orderResponse);
            }

            return orderResponse;
        } catch (error) {
            console.error('시장가 매도 주문 생성 실패:', error);
            return null;
        }
    }

    /**
     * 지정가 매수 주문 생성
     */
    async createLimitBuyOrder(symbol: string, price: number, quantity: number, clientOrderId?: string) {
        if (!this.envManager.hasOrderlyAuth()) {
            console.log('⚠️  Orderly API 인증 정보가 없습니다.');
            return null;
        }

        try {
            const auth = this.envManager.getOrderlyAuth();
            const orderResponse = await createLimitBuyOrder(
                symbol,
                price,
                quantity,
                auth.accountId!,
                auth.secretKey! as Uint8Array,
                clientOrderId,
                false
            );

            if (orderResponse) {
                printOrderResponse(orderResponse);
            }

            return orderResponse;
        } catch (error) {
            console.error('지정가 매수 주문 생성 실패:', error);
            return null;
        }
    }

    /**
     * 지정가 매도 주문 생성
     */
    async createLimitSellOrder(symbol: string, price: number, quantity: number, clientOrderId?: string) {
        if (!this.envManager.hasOrderlyAuth()) {
            console.log('⚠️  Orderly API 인증 정보가 없습니다.');
            return null;
        }

        try {
            const auth = this.envManager.getOrderlyAuth();
            const orderResponse = await createLimitSellOrder(
                symbol,
                price,
                quantity,
                auth.accountId!,
                auth.secretKey! as Uint8Array,
                clientOrderId,
                false
            );

            if (orderResponse) {
                printOrderResponse(orderResponse);
            }

            return orderResponse;
        } catch (error) {
            console.error('지정가 매도 주문 생성 실패:', error);
            return null;
        }
    }

    /**
     * 병렬로 주문 생성 (최적화용)
     */
    async createParallelOrders(
        orderlyOrder: { symbol: string; quantity: number; clientOrderId: string },
        gateioOrder: { contract: string; size: number; settle: 'usdt' | 'btc' }
    ) {
        const { createGateIOMarketBuyOrder, createGateIOMarketSellOrder } = require('../gateio/request/post/createFuturesOrder');

        try {
            // Orderly와 Gate.io 주문을 병렬로 실행
            const [orderlyResult, gateioResult] = await Promise.all([
                this.createMarketBuyOrder(
                    orderlyOrder.symbol,
                    orderlyOrder.quantity,
                    orderlyOrder.clientOrderId
                ),
                createGateIOMarketSellOrder(
                    gateioOrder.contract,
                    gateioOrder.size,
                    gateioOrder.settle
                )
            ]);

            return {
                orderly: orderlyResult,
                gateio: gateioResult,
                success: !!(orderlyResult && gateioResult)
            };
        } catch (error) {
            console.error('병렬 주문 생성 실패:', error);
            return {
                orderly: null,
                gateio: null,
                success: false,
                error: error
            };
        }
    }

    /**
     * 병렬로 포지션 정보 조회 (최적화용)
     */
    async getParallelPositions(orderlyAccountId: string, orderlySecretKey: Uint8Array, gateioContract: string) {
        const { getGateIOPositionByContract } = require('../gateio/request/get/getPositions');

        try {
            const [orderlyPositions, gateioPosition] = await Promise.all([
                getAllPositionsInfo(orderlyAccountId, orderlySecretKey, false),
                getGateIOPositionByContract(gateioContract)
            ]);

            return {
                orderly: orderlyPositions,
                gateio: gateioPosition,
                success: true
            };
        } catch (error) {
            console.error('병렬 포지션 조회 실패:', error);
            return {
                orderly: null,
                gateio: null,
                success: false,
                error: error
            };
        }
    }

    /**
     * 모든 API 데이터 조회
     */
    async getAllData() {
        // 인증 정보 출력
        this.envManager.printAuthInfo();

        // Gate.io 데이터 조회
        const gateIOData = await this.getGateIOMarketData();

        // Gate.io Futures 데이터 조회
        const gateIOFuturesData = await this.getGateIOFuturesData();

        // Orderly 데이터 조회
        const orderlyData = await this.getOrderlyMarketData();

        // Orderly USDC 잔고 조회
        const orderlyUSDCBalance = await this.getOrderlyUSDCBalance();

        // Orderly 포지션 정보 조회
        const orderlyPositions = await this.getOrderlyPositions();

        return {
            gateIOData,
            gateIOFuturesData,
            orderlyData,
            orderlyUSDCBalance,
            orderlyPositions,
        };
    }

    /**
     * 공통 코인 필터링된 시장 데이터 조회 (24시간 거래금액 기준)
     */
    async getCommonCoinsData(minAmount: number = 300000) {
        const { DataProcessingService } = await import('./dataProcessingService');
        const dataProcessingService = new DataProcessingService();
        return await dataProcessingService.getCommonCoinsData(minAmount);
    }
} 