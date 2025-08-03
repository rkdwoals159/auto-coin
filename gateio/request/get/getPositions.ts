import { EnvironmentManager } from '../../../config/environment';

/**
 * Gate.io 포지션 데이터 타입
 */
export interface GateIOPosition {
    user: number;
    contract: string;
    size: string; // API에서 문자열로 반환됨
    leverage: string;
    risk_limit: string;
    leverage_max: string;
    maintenance_rate: string;
    value: string;
    margin: string;
    entry_price: string;
    liq_price: string;
    mark_price: string;
    unrealised_pnl: string;
    realised_pnl: string;
    pnl_pnl: string;
    pnl_fund: string;
    pnl_fee: string;
    history_pnl: string;
    last_close_pnl: string;
    realised_point: string;
    history_point: string;
    adl_ranking: number;
    pending_orders: number;
    close_order: {
        id: number;
        price: string;
        is_liq: boolean;
    };
    mode: string;
    update_time: number;
    update_id: number;
    cross_leverage_limit: string;
    risk_limit_table: string;
    average_maintenance_rate: string;
}

/**
 * Gate.io API 인증 헤더 생성
 */
async function createGateIOAuthHeaders(
    method: string,
    path: string,
    queryParam: string,
    body: string = ''
): Promise<Record<string, string>> {
    const envManager = EnvironmentManager.getInstance();

    if (!envManager.hasGateIOAuth()) {
        throw new Error('Gate.io API 인증 정보가 없습니다.');
    }

    const auth = envManager.getGateIOAuth();
    const apiKey = auth.apiKey!;
    const secretKey = auth.secretKey as string;

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const hashedPayload = require('crypto').createHash('sha512').update(body).digest('hex');

    // Gate.io API 서명 생성: [method, URL, queryString, hashedPayload, ts].join("\n")
    const signatureString = [method, path, queryParam, hashedPayload, timestamp].join('\n');
    const sign = require('crypto').createHmac('sha512', secretKey).update(signatureString).digest('hex');

    return {
        'KEY': apiKey,
        'SIGN': sign,
        'Timestamp': timestamp
    };
}

/**
 * Gate.io 포지션 목록 조회
 * @param settle - 정산 통화 ('usdt' 또는 'btc')
 * @param holding - 실제 포지션만 반환 여부 (기본값: true)
 * @returns 포지션 목록
 */
export async function getGateIOPositions(
    settle: 'usdt' | 'btc' = 'usdt',
    holding: boolean = true
): Promise<GateIOPosition[]> {
    const host = 'https://api.gateio.ws';
    const prefix = '/api/v4';
    const url = `/futures/${settle}/positions`;
    const queryParam = `holding=${holding}`;

    const headers = await createGateIOAuthHeaders('GET', prefix + url, queryParam);
    headers['Accept'] = 'application/json';
    headers['Content-Type'] = 'application/json';

    try {
        console.log('Gate.io 포지션 목록 조회 중...');
        console.log(`정산 통화: ${settle}`);
        console.log(`실제 포지션만: ${holding}`);

        const response = await fetch(`${host}${prefix}${url}?${queryParam}`, {
            method: 'GET',
            headers
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const positions = await response.json() as GateIOPosition[];

        console.log(`✅ Gate.io 포지션 조회 성공! 총 ${positions.length}개 포지션`);

        return positions;
    } catch (error) {
        console.error('Gate.io 포지션 조회 실패:', error);
        throw error;
    }
}

/**
 * 특정 계약의 포지션 조회
 * @param contract - 계약명 (예: 'BTC_USDT')
 * @param settle - 정산 통화 (기본값: 'usdt')
 * @returns 해당 계약의 포지션 또는 null
 */
export async function getGateIOPositionByContract(
    contract: string,
    settle: 'usdt' | 'btc' = 'usdt'
): Promise<GateIOPosition | null> {
    const positions = await getGateIOPositions(settle, true);
    return positions.find(pos => pos.contract === contract) || null;
}

/**
 * 포지션 정보 출력
 * @param position - 포지션 데이터
 */
export function printGateIOPosition(position: GateIOPosition): void {
    console.log('\n=== Gate.io 포지션 정보 ===');
    console.log(`계약: ${position.contract}`);
    console.log(`수량: ${position.size}`);
    console.log(`진입가: $${position.entry_price}`);
    console.log(`마크가: $${position.mark_price}`);
    console.log(`미실현 PnL: $${position.unrealised_pnl}`);
    console.log(`실현 PnL: $${position.realised_pnl}`);
    console.log(`포지션 가치: $${position.value}`);
    console.log(`마진: $${position.margin}`);
    console.log(`청산가: $${position.liq_price}`);
    console.log(`모드: ${position.mode}`);
    console.log(`업데이트 시간: ${new Date(position.update_time * 1000).toLocaleString()}`);
}

/**
 * 모든 포지션 정보 출력
 * @param positions - 포지션 목록
 */
export function printGateIOPositions(positions: GateIOPosition[]): void {
    console.log('\n=== Gate.io 포지션 목록 ===');
    console.log(`총 포지션 수: ${positions.length}개`);

    if (positions.length === 0) {
        console.log('현재 열린 포지션이 없습니다.');
        return;
    }

    positions.forEach((position, index) => {
        console.log(`\n${index + 1}. ${position.contract}`);
        console.log(`   수량: ${position.size}`);
        console.log(`   진입가: $${position.entry_price}`);
        console.log(`   마크가: $${position.mark_price}`);
        console.log(`   미실현 PnL: $${position.unrealised_pnl}`);
        console.log(`   실현 PnL: $${position.realised_pnl}`);
    });
} 