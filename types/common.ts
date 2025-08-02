/**
 * 공통 API 응답 타입
 */
export interface ApiResponse<T> {
    success: boolean;
    timestamp: number;
    data: T;
}

/**
 * 가격 정보 타입
 */
export interface PriceInfo {
    symbol: string;
    mark_price: number;
    index_price?: number;
    [key: string]: any;
}

/**
 * 최고 가격차이율 데이터 타입
 */
export interface HighestPriceDifferenceData {
    timestamp: Date;
    coin: string;
    gateio_price: number;
    orderly_price: number;
    price_difference: number;
    price_difference_percent: number;
}

/**
 * 시장 모니터링 결과 타입
 */
export interface MarketMonitoringResult {
    startTime: Date;
    endTime: Date;
    totalExecutions: number;
    highestPriceDifference: HighestPriceDifferenceData | null;
    averagePriceDifference: number;
    allPriceDifferences: HighestPriceDifferenceData[];
}

/**
 * 인증 정보 타입
 */
export interface AuthConfig {
    accountId?: string;
    apiKey?: string;
    secretKey?: Uint8Array | string;
}

/**
 * 환경 변수 타입
 */
export interface EnvironmentConfig {
    ORDERLY_ACCOUNT_ID?: string;
    ORDERLY_API_KEY?: string;
    ORDERLY_SECRET_KEY?: string;
    GATEIO_API_KEY?: string;
    GATEIO_SECRET_KEY?: string;
} 