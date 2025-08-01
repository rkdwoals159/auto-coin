/**
 * Get Market Info for All Symbols
 * 
 * Reference: https://orderly.network/docs/build-on-omnichain/evm-api/restful-api/public/get-market-info-for-all-symbols
 * 
 * Limit: 10 requests per 1 second per IP address
 * GET /v1/public/futures
 */

export interface MarketInfo {
    symbol: string;
    index_price: number;
    mark_price: number;
    sum_unitary_funding: number;
    est_funding_rate: number;
    last_funding_rate: number;
    next_funding_time: number;
    open_interest: string | null;
    "24h_open": number;
    "24h_close": number;
    "24h_high": number;
    "24h_low": number;
    "24h_amount": number;
    "24h_volume": number;
}

export interface MarketInfoResponse {
    success: boolean;
    timestamp: number;
    data: {
        rows: MarketInfo[];
    };
}

/**
 * 모든 심볼의 시장 정보를 가져옵니다.
 * 
 * @param baseUrl - API 기본 URL (예: 'https://api.orderly.org' 또는 'https://testnet-api.orderly.org')
 * @returns Promise<MarketInfoResponse> - 시장 정보 응답
 */
export async function getMarketInfoForAllSymbols(baseUrl: string): Promise<MarketInfoResponse> {
    const url = `${baseUrl}/v1/public/futures`;

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json() as MarketInfoResponse;
        return data;
    } catch (error) {
        console.error('Failed to fetch market info:', error);
        throw error;
    }
}

/**
 * 특정 심볼의 시장 정보를 필터링합니다.
 * 
 * @param marketInfo - 전체 시장 정보
 * @param symbol - 필터링할 심볼 (예: 'PERP_ETH_USDC')
 * @returns MarketInfo | undefined - 해당 심볼의 정보 또는 undefined
 */
export function filterMarketInfoBySymbol(marketInfo: MarketInfoResponse, symbol: string): MarketInfo | undefined {
    return marketInfo.data.rows.find(row => row.symbol === symbol);
}

/**
 * 특정 심볼의 시장 정보만 가져옵니다.
 * 
 * @param baseUrl - API 기본 URL
 * @param symbol - 가져올 심볼 (예: 'PERP_ETH_USDC')
 * @returns Promise<MarketInfo | undefined> - 해당 심볼의 정보 또는 undefined
 */
export async function getMarketInfoForSymbol(baseUrl: string, symbol: string): Promise<MarketInfo | undefined> {
    const marketInfo = await getMarketInfoForAllSymbols(baseUrl);
    return filterMarketInfoBySymbol(marketInfo, symbol);
}

/**
 * 선택한 필드만 포함하는 시장 정보 타입
 */
export type SelectedMarketInfo = {
    symbol: string;
    [key: string]: any;
};

/**
 * 모든 심볼의 정보에서 원하는 필드만 선택하여 반환합니다.
 * 
 * @param marketInfo - 전체 시장 정보
 * @param selectedFields - 선택할 필드 배열 (예: ['mark_price', '24h_volume'])
 * @returns SelectedMarketInfo[] - 선택된 필드만 포함한 시장 정보 배열
 */
export function selectMarketInfoFields(marketInfo: MarketInfoResponse, selectedFields: string[]): SelectedMarketInfo[] {
    return marketInfo.data.rows.map(row => {
        const selected: SelectedMarketInfo = { symbol: row.symbol };

        selectedFields.forEach(field => {
            if (field in row) {
                selected[field] = row[field as keyof MarketInfo];
            }
        });

        return selected;
    });
}

/**
 * 모든 심볼의 정보에서 원하는 필드만 선택하여 가져옵니다.
 * 
 * @param baseUrl - API 기본 URL
 * @param selectedFields - 선택할 필드 배열 (예: ['mark_price', '24h_volume', '24h_high', '24h_low'])
 * @returns Promise<SelectedMarketInfo[]> - 선택된 필드만 포함한 시장 정보 배열
 */
export async function getMarketInfoWithSelectedFields(baseUrl: string, selectedFields: string[]): Promise<SelectedMarketInfo[]> {
    const marketInfo = await getMarketInfoForAllSymbols(baseUrl);
    return selectMarketInfoFields(marketInfo, selectedFields);
}

/**
 * 특정 심볼의 정보에서 원하는 필드만 선택하여 가져옵니다.
 * 
 * @param baseUrl - API 기본 URL
 * @param symbol - 가져올 심볼 (예: 'PERP_ETH_USDC')
 * @param selectedFields - 선택할 필드 배열 (예: ['mark_price', '24h_volume'])
 * @returns Promise<SelectedMarketInfo | undefined> - 선택된 필드만 포함한 심볼 정보 또는 undefined
 */
export async function getSymbolInfoWithSelectedFields(baseUrl: string, symbol: string, selectedFields: string[]): Promise<SelectedMarketInfo | undefined> {
    const marketInfo = await getMarketInfoForAllSymbols(baseUrl);
    const symbolInfo = filterMarketInfoBySymbol(marketInfo, symbol);

    if (!symbolInfo) return undefined;

    const selected: SelectedMarketInfo = { symbol: symbolInfo.symbol };

    selectedFields.forEach(field => {
        if (field in symbolInfo) {
            selected[field] = symbolInfo[field as keyof MarketInfo];
        }
    });

    return selected;
}
