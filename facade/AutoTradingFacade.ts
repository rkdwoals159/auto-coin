import { ApiClient } from '../services/apiClient';
import { MarketMonitor } from '../action/marketMonitor';
import { EnvironmentManager } from '../config/environment';
import { MarketMonitoringResult } from '../types/common';

/**
 * 자동 차익거래/시장 모니터링을 위한 고수준 퍼사드
 * - 외부에서는 이 클래스를 통해서만 자동 매매 로직을 사용하도록 권장합니다.
 * - 내부 구현(시장 모니터링, 포지션 관리, 게이트웨이 호출 등)은 캡슐화합니다.
 */
export interface AutoTradingConfig {
    /** 모니터링 시간(시간 단위) */
    durationHours?: number;
    /** 가격차이율 임계값 (%) */
    pauseThreshold?: number;
    /** 포지션 비율 (1 = 100%) */
    positionPercent?: number;
    /** 목표 수익률 (%) */
    targetProfitPercent?: number;
    /** Orderbook 조회 최대 레벨 */
    orderbookMaxLevel?: number;
    /** 24시간 거래금액 최소 조건 */
    min24Amount?: number;
}

export class AutoTradingFacade {
    private readonly apiClient: ApiClient;
    private readonly marketMonitor: MarketMonitor;
    private readonly envManager: EnvironmentManager;
    private lastResult: MarketMonitoringResult | null = null;

    constructor(private readonly config: AutoTradingConfig = {}) {
        this.apiClient = new ApiClient();
        this.marketMonitor = new MarketMonitor();
        this.envManager = EnvironmentManager.getInstance();
    }

    /**
     * 현재 설정값을 기반으로 자동 차익거래 모니터링을 시작합니다.
     * - 외부에서는 데이터 제공 함수나 세부 클래스를 알 필요 없이 이 메서드만 호출하면 됩니다.
     */
    async startMonitoring(): Promise<MarketMonitoringResult> {
        const {
            durationHours = 500,
            pauseThreshold = 0.4,
            positionPercent = 1,
            targetProfitPercent = 0.4,
            orderbookMaxLevel = 3,
            min24Amount = 500000
        } = this.config;

        // 공통 코인 데이터에서 Gate.io 데이터만 추출
        const getGateioData = async () => {
            const commonData = await this.apiClient.getCommonCoinsData(min24Amount);
            return commonData.commonCoins.map(item => ({
                name: item.symbol,
                mark_price: item.gateio_price.toString(),
                index_price: item.gateio_price.toString(),
                quote_volume: item.gateio_volume
            }));
        };

        // 공통 코인 데이터에서 Orderly 데이터만 추출
        const getOrderlyData = async () => {
            const commonData = await this.apiClient.getCommonCoinsData(min24Amount);
            return commonData.commonCoins.map(item => ({
                symbol: item.symbol,
                mark_price: item.orderly_price,
                index_price: item.orderly_price,
                '24h_amount': item.orderly_volume
            }));
        };

        // Orderly 인증 정보 가져오기
        const orderlyAuth = this.envManager.getOrderlyAuth();

        const result = await this.marketMonitor.startMonitoring(
            getGateioData,
            getOrderlyData,
            durationHours,
            pauseThreshold,
            orderlyAuth.accountId,
            orderlyAuth.apiKey,
            orderlyAuth.secretKey as Uint8Array,
            orderbookMaxLevel,
            positionPercent,
            targetProfitPercent
        );

        this.lastResult = result;
        return result;
    }

    /**
     * 모니터링을 중단합니다.
     */
    stop(): void {
        this.marketMonitor.stopMonitoring();
    }

    /**
     * 마지막 모니터링 결과를 반환합니다.
     */
    getLastResult(): MarketMonitoringResult | null {
        return this.lastResult;
    }

    /**
     * 모니터링 결과를 표준 포맷으로 출력합니다.
     * - 내부적으로는 `MarketMonitor`의 출력 형식을 그대로 재사용합니다.
     */
    printMonitoringResult(result?: MarketMonitoringResult): void {
        const target = result ?? this.lastResult;
        if (!target) {
            console.log('⚠️ 출력할 모니터링 결과가 없습니다.');
            return;
        }
        this.marketMonitor.printMonitoringResult(target);
    }
}


