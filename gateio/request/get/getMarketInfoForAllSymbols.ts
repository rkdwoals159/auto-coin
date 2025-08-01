/**
 * Gate.io Market Info Interface
 * 
 * Reference: https://www.gate.io/docs/developers/apiv4/en/
 */

export interface GateIOMarketInfo {
    funding_rate_indicative: string;
    mark_price_round: string;
    funding_offset: number;
    in_delisting: boolean;
    risk_limit_base: string;
    interest_rate: string;
    index_price: string;
    order_price_round: string;
    order_size_min: number;
    ref_rebate_rate: string;
    name: string;
    ref_discount_rate: string;
    order_price_deviate: string;
    maintenance_rate: string;
    mark_type: string;
    funding_interval: number;
    type: string;
    risk_limit_step: string;
    enable_bonus: boolean;
    enable_credit: boolean;
    leverage_min: string;
    funding_rate: string;
    last_price: string;
    mark_price: string;
    order_size_max: number;
    funding_next_apply: number;
    short_users: number;
    config_change_time: number;
    create_time: number;
    trade_size: number;
    position_size: number;
    long_users: number;
    quanto_multiplier: string;
    funding_impact_value: string;
    leverage_max: string;
    cross_leverage_default: string;
    risk_limit_max: string;
    maker_fee_rate: string;
    taker_fee_rate: string;
    orders_limit: number;
    trade_id: number;
    orderbook_id: number;
    funding_cap_ratio: string;
    voucher_leverage: string;
    is_pre_market: boolean;
    status: string;
    launch_time: number;
}

/**
 * 선택한 필드만 포함하는 Gate.io 시장 정보 타입
 */
export type SelectedGateIOMarketInfo = {
    name: string;
    [key: string]: any;
};

/**
 * Gate.io API 호출 함수
 */
async function getGATEIOMarketInfoForAllSymbols(): Promise<GateIOMarketInfo[]> {
    const host = "https://api.gateio.ws";
    const prefix = "/api/v4";
    const headers = { 'Accept': 'application/json', 'Content-Type': 'application/json' };
    const url = '/futures/usdt/contracts';

    try {
        const response = await fetch(host + prefix + url, {
            method: 'GET',
            headers: headers
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json() as GateIOMarketInfo[];
        return data;
    } catch (error) {
        console.error('Gate.io API 호출 에러:', error);
        throw error;
    }
}

/**
 * 모든 심볼의 정보에서 원하는 필드만 선택하여 반환합니다.
 * 
 * @param marketInfo - 전체 시장 정보
 * @param selectedFields - 선택할 필드 배열 (예: ['mark_price', 'index_price', 'funding_rate'])
 * @returns SelectedGateIOMarketInfo[] - 선택된 필드만 포함한 시장 정보 배열
 */
export function selectGateIOMarketInfoFields(marketInfo: GateIOMarketInfo[], selectedFields: string[]): SelectedGateIOMarketInfo[] {
    return marketInfo.map(row => {
        const selected: SelectedGateIOMarketInfo = { name: row.name };

        selectedFields.forEach(field => {
            if (field in row) {
                selected[field] = row[field as keyof GateIOMarketInfo];
            }
        });

        return selected;
    });
}

/**
 * 모든 심볼의 정보에서 원하는 필드만 선택하여 가져옵니다.
 * 
 * @param selectedFields - 선택할 필드 배열 (예: ['mark_price', 'index_price', 'funding_rate', 'trade_size'])
 * @returns Promise<SelectedGateIOMarketInfo[]> - 선택된 필드만 포함한 시장 정보 배열
 */
export async function getGateIOMarketInfoWithSelectedFields(selectedFields: string[]): Promise<SelectedGateIOMarketInfo[]> {
    const marketInfo = await getGATEIOMarketInfoForAllSymbols();
    return selectGateIOMarketInfoFields(marketInfo, selectedFields);
}

/**
 * 특정 심볼의 정보에서 원하는 필드만 선택하여 가져옵니다.
 * 
 * @param symbol - 가져올 심볼 (예: 'ORBS_USDT')
 * @param selectedFields - 선택할 필드 배열 (예: ['mark_price', 'index_price', 'funding_rate'])
 * @returns Promise<SelectedGateIOMarketInfo | undefined> - 선택된 필드만 포함한 심볼 정보 또는 undefined
 */
export async function getGateIOSymbolInfoWithSelectedFields(symbol: string, selectedFields: string[]): Promise<SelectedGateIOMarketInfo | undefined> {
    const marketInfo = await getGATEIOMarketInfoForAllSymbols();
    const symbolInfo = marketInfo.find(row => row.name === symbol);

    if (!symbolInfo) return undefined;

    const selected: SelectedGateIOMarketInfo = { name: symbolInfo.name };

    selectedFields.forEach(field => {
        if (field in symbolInfo) {
            selected[field] = symbolInfo[field as keyof GateIOMarketInfo];
        }
    });

    return selected;
}

/**
 * 특정 심볼의 정보를 필터링합니다.
 * 
 * @param marketInfo - 전체 시장 정보
 * @param symbol - 필터링할 심볼 (예: 'ORBS_USDT')
 * @returns GateIOMarketInfo | undefined - 해당 심볼의 정보 또는 undefined
 */
export function filterGateIOMarketInfoBySymbol(marketInfo: GateIOMarketInfo[], symbol: string): GateIOMarketInfo | undefined {
    return marketInfo.find(row => row.name === symbol);
}

export default getGATEIOMarketInfoForAllSymbols;