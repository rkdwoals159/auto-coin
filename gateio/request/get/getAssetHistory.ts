import crypto from 'crypto';

/**
 * Gate.io Futures Account API 응답 데이터 타입
 */
export interface GateIOFuturesAccountData {
    total: string;
    unrealised_pnl: string;
    position_margin: string;
    order_margin: string;
    available: string;
    point: string;
    currency: string;
    in_dual_mode: boolean;
    enable_credit: boolean;
    position_initial_margin: string;
    maintenance_margin: string;
    bonus: string;
    enable_evolved_classic: boolean;
    cross_order_margin: string;
    cross_initial_margin: string;
    cross_maintenance_margin: string;
    cross_unrealised_pnl: string;
    cross_available: string;
    cross_margin_balance: string;
    cross_mmr: string;
    cross_imr: string;
    isolated_position_margin: string;
    enable_new_dual_mode: boolean;
    margin_mode: number;
    enable_tiered_mm: boolean;
    position_voucher_total: string;
    history: {
        dnw: string;
        pnl: string;
        fee: string;
        refr: string;
        fund: string;
        point_dnw: string;
        point_fee: string;
        point_refr: string;
        bonus_dnw: string;
        bonus_offset: string;
    };
}

/**
 * Gate.io Futures Account API 응답 타입
 */
export interface GateIOFuturesAccountResponse {
    total: string;
    unrealised_pnl: string;
    position_margin: string;
    order_margin: string;
    available: string;
    point: string;
    currency: string;
    in_dual_mode: boolean;
    enable_credit: boolean;
    position_initial_margin: string;
    maintenance_margin: string;
    bonus: string;
    enable_evolved_classic: boolean;
    cross_order_margin: string;
    cross_initial_margin: string;
    cross_maintenance_margin: string;
    cross_unrealised_pnl: string;
    cross_available: string;
    cross_margin_balance: string;
    cross_mmr: string;
    cross_imr: string;
    isolated_position_margin: string;
    enable_new_dual_mode: boolean;
    margin_mode: number;
    enable_tiered_mm: boolean;
    position_voucher_total: string;
    history: {
        dnw: string;
        pnl: string;
        fee: string;
        refr: string;
        fund: string;
        point_dnw: string;
        point_fee: string;
        point_refr: string;
        bonus_dnw: string;
        bonus_offset: string;
    };
}

/**
 * Gate.io Futures 계정 정보 조회
 * @param settle - 정산 통화 (usdt, btc)
 * @param apiKey - Gate.io API 키 (선택사항)
 * @param secretKey - Gate.io 시크릿 키 (선택사항)
 * @returns futures 계정 정보
 */
export async function getGateIOFuturesAccount(
    settle: 'usdt' | 'btc' = 'usdt',
    apiKey?: string,
    secretKey?: string
): Promise<GateIOFuturesAccountResponse> {
    const baseUrl = 'https://api.gateio.ws/api/v4';
    const url = `${baseUrl}/futures/${settle}/accounts`;

    try {
        console.log(`Gate.io Futures 계정 조회 중... (${settle.toUpperCase()})`);
        console.log(`URL: ${url}`);

        const headers: Record<string, string> = {
            'Content-Type': 'application/json'
        };

        // 인증 정보가 있으면 헤더에 추가
        if (apiKey && secretKey) {
            const timestamp = Math.floor(Date.now() / 1000).toString();
            const method = 'GET';
            const path = `/api/v4/futures/${settle}/accounts`;
            const queryString = '';
            const body = '';

            // Gate.io API 서명 생성: [method, URL, queryString, hashedPayload, ts].join("\n")
            const hashedPayload = crypto.createHash('sha512').update(body).digest('hex');
            const signatureString = [method, path, queryString, hashedPayload, timestamp].join('\n');
            const sign = crypto.createHmac('sha512', secretKey).update(signatureString).digest('hex');

            headers['KEY'] = apiKey;
            headers['Timestamp'] = timestamp;
            headers['SIGN'] = sign;

            // console.log('인증 헤더 추가됨');
            // console.log(`서명 문자열: ${signatureString}`);
            // console.log(`해시된 페이로드: ${hashedPayload}`);
            // console.log(`서명: ${sign}`);
        } else {
            console.log('⚠️  인증 정보가 없어 공개 API만 사용합니다.');
            console.log('⚠️  Futures 계정 조회는 인증이 필요합니다.');
            throw new Error('Gate.io Futures 계정 조회는 인증이 필요합니다.');
        }

        const response = await fetch(url, {
            method: 'GET',
            headers
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Gate.io API 오류 (${response.status}): ${errorText}`);
        }

        const result = await response.json() as GateIOFuturesAccountResponse;

        console.log('✅ Gate.io Futures 계정 조회 성공');
        console.log(`통화: ${result.currency}`);
        console.log(`총 잔고: ${result.total}`);
        console.log(`사용 가능한 잔고: ${result.available}`);

        return result;
    } catch (error) {
        console.error('Gate.io Futures 계정 조회 실패:', error);
        throw error;
    }
}

/**
 * USDT Futures 계정 정보 조회
 * @returns USDT futures 계정 정보
 */
export async function getGateIOUSDTFuturesAccount(): Promise<GateIOFuturesAccountResponse> {
    return await getGateIOFuturesAccount('usdt');
}

/**
 * BTC Futures 계정 정보 조회
 * @returns BTC futures 계정 정보
 */
export async function getGateIOBTCFuturesAccount(): Promise<GateIOFuturesAccountResponse> {
    return await getGateIOFuturesAccount('btc');
}

/**
 * Futures 계정 정보를 보기 좋게 출력
 */
export function printFuturesAccount(account: GateIOFuturesAccountResponse, settle: string): void {
    console.log(`\n=== Gate.io ${settle.toUpperCase()} Futures 계정 정보 ===`);
    console.log(`통화: ${account.currency}`);
    console.log(`총 잔고: ${account.total}`);
    console.log(`사용 가능한 잔고: ${account.available}`);
    console.log(`미실현 손익: ${account.unrealised_pnl}`);
    console.log(`포지션 마진: ${account.position_margin}`);
    console.log(`주문 마진: ${account.order_margin}`);
    console.log(`포인트: ${account.point}`);
    console.log(`보너스: ${account.bonus}`);
    console.log(`이중 모드: ${account.in_dual_mode ? '활성화' : '비활성화'}`);
    console.log(`신용 거래: ${account.enable_credit ? '활성화' : '비활성화'}`);
    console.log(`마진 모드: ${account.margin_mode}`);
    console.log(`새 이중 모드: ${account.enable_new_dual_mode ? '활성화' : '비활성화'}`);
    console.log(`계층화된 유지보수 마진: ${account.enable_tiered_mm ? '활성화' : '비활성화'}`);

    console.log('\n--- 통계 데이터 ---');
    console.log(`입출금 총액: ${account.history.dnw}`);
    console.log(`거래 손익 총액: ${account.history.pnl}`);
    console.log(`수수료 총액: ${account.history.fee}`);
    console.log(`추천인 리베이트 총액: ${account.history.refr}`);
    console.log(`자금 조달 비용 총액: ${account.history.fund}`);
    console.log(`포인트 입출금 총액: ${account.history.point_dnw}`);
    console.log(`포인트 수수료 총액: ${account.history.point_fee}`);
    console.log(`포인트 추천인 리베이트 총액: ${account.history.point_refr}`);
    console.log(`보너스 전송 총액: ${account.history.bonus_dnw}`);
    console.log(`보너스 차감 총액: ${account.history.bonus_offset}`);
}

/**
 * USDT 잔고 정보만 간단히 출력
 */
export function printUSDTBalance(account: GateIOFuturesAccountResponse): void {
    console.log('\n=== Gate.io USDT Futures 잔고 ===');
    // console.log(`총 잔고: ${account.total} USDT`);
    // console.log(`사용 가능한 잔고: ${account.available} USDT`);
    // console.log(`미실현 손익: ${account.unrealised_pnl} USDT`);
    // console.log(`포지션 마진: ${account.position_margin} USDT`);
    // console.log(`주문 마진: ${account.order_margin} USDT`);
    // console.log(`보너스: ${account.bonus} USDT`);

    const totalBalance = parseFloat(account.total);
    const availableBalance = parseFloat(account.available);
    const unrealisedPnl = parseFloat(account.unrealised_pnl);

    // console.log(`\n=== 잔고 분석 ===`);
    console.log(`총 잔고 (숫자): ${totalBalance.toFixed(6)} USDT`);
    console.log(`사용 가능한 잔고 (숫자): ${availableBalance.toFixed(6)} USDT`);
    console.log(`미실현 손익 (숫자): ${unrealisedPnl.toFixed(6)} USDT`);

    if (totalBalance > 0) {
        const availablePercent = (availableBalance / totalBalance) * 100;
        console.log(`사용 가능한 잔고 비율: ${availablePercent.toFixed(2)}%`);
    }
}
