import { EnvironmentManager } from '../config/environment';
import { getGateIOFuturesAccount, printUSDTBalance } from '../gateio/request/get/getAssetHistory';
import { getUSDCBalance, printUSDCBalance } from '../aden/request/get/getAssetHistory';
import { getGateIOMarketInfoWithSelectedFields, getGateIOMarketInfoWith24hAmountFilter } from '../gateio/request/get/getMarketInfoForAllSymbols';
import { getMarketInfoWithSelectedFields } from '../aden/request/get/getMarketInfoForAllSymbols';

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

        return {
            gateIOData,
            gateIOFuturesData,
            orderlyData,
            orderlyUSDCBalance,
        };
    }

    /**
     * 공통 코인 필터링된 시장 데이터 조회 (24시간 거래금액 기준)
     */
    async getCommonCoinsData(minAmount: number = 300000) {
        // Gate.io 데이터 조회 (24시간 거래금액 필터링 포함)
        const gateioData = await this.getGateIOMarketDataWith24hAmountFilter(['mark_price', 'index_price', 'trade_size', 'quote_volume'], minAmount);

        // Orderly 데이터 조회 (24시간 거래금액 필터링 포함)
        const orderlyData = await this.getOrderlyMarketDataWith24hAmountFilter(['mark_price', 'index_price', '24h_amount'], minAmount);

        // 공통 코인 필터링
        const { filterCommonCoinsWithVolume } = await import('../action/commonCoinFilter');
        const commonCoins = filterCommonCoinsWithVolume(gateioData, orderlyData, minAmount);

        return {
            commonCoins
        };
    }
} 