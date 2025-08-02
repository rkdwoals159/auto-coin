import { getPublicKeyAsync, signAsync } from '@noble/ed25519';
import { encodeBase58 } from 'ethers';

/**
 * Orderly Network API 인증 헤더 생성
 */
interface OrderlyAuthHeaders {
    'orderly-account-id': string;
    'orderly-key': string;
    'orderly-signature': string;
    'orderly-timestamp': string;
}

/**
 * Asset History 응답 데이터 타입
 */
export interface AssetHistoryData {
    meta: {
        total: number;
        records_per_page: number;
        current_page: number;
    };
    rows: Array<{
        id: string;
        tx_id: string;
        side: 'DEPOSIT' | 'WITHDRAW';
        token: string;
        amount: number;
        fee: number;
        trans_status: 'NEW' | 'CONFIRM' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'PENDING_REBALANCE';
        created_time: number;
        updated_time: number;
        chain_id: string;
    }>;
}

/**
 * Asset History API 응답 타입
 */
export interface AssetHistoryApiResponse {
    success: boolean;
    timestamp: number;
    data: AssetHistoryData;
}

/**
 * Current Holding 응답 데이터 타입
 */
export interface CurrentHoldingData {
    token: string;
    holding: number;
    frozen: number;
    pending_short: number;
    updated_time: number;
}

/**
 * Current Holding API 응답 타입
 */
export interface CurrentHoldingApiResponse {
    success: boolean;
    timestamp: number;
    data: {
        holding: CurrentHoldingData[];
    };
}

/**
 * Orderly Network API 인증 헤더 생성
 */
export async function createOrderlyAuthHeaders(
    accountId: string,
    secretKey: Uint8Array,
    url: URL
): Promise<OrderlyAuthHeaders> {
    const timestamp = Date.now();
    const message = `${timestamp}GET${url.pathname}${url.search}`;

    const encoder = new TextEncoder();
    const orderlySignature = await signAsync(encoder.encode(message), secretKey);
    const publicKey = await getPublicKeyAsync(secretKey);

    return {
        'orderly-account-id': accountId,
        'orderly-key': `ed25519:${encodeBase58(publicKey)}`,
        'orderly-signature': Buffer.from(orderlySignature).toString('base64url'),
        'orderly-timestamp': String(timestamp)
    };
}

/**
 * 현재 보유 자산 조회 (Current Holding)
 * @param accountId - Orderly 계정 ID
 * @param secretKey - Orderly 시크릿 키
 * @param isTestnet - 테스트넷 사용 여부 (기본값: false)
 * @returns 현재 보유 자산 데이터
 */
export async function getCurrentHoldings(
    accountId: string,
    secretKey: Uint8Array,
    isTestnet: boolean = false
): Promise<CurrentHoldingData[]> {
    const baseUrl = isTestnet
        ? 'https://testnet-api.orderly.org'
        : 'https://api.orderly.org';

    const url = new URL('/v1/client/holding', baseUrl);
    const headers = await createOrderlyAuthHeaders(accountId, secretKey, url);

    try {
        console.log('Orderly 현재 보유 자산 조회 중...');
        console.log(`URL: ${url.toString()}`);

        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...headers
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Orderly API 오류 (${response.status}): ${errorText}`);
        }

        const result = await response.json() as CurrentHoldingApiResponse;

        if (!result.success) {
            throw new Error('Orderly API 응답이 성공하지 않았습니다.');
        }

        console.log('✅ Orderly 현재 보유 자산 조회 성공');
        console.log(`총 자산 수: ${result.data.holding.length}`);

        return result.data.holding;
    } catch (error) {
        console.error('Orderly 현재 보유 자산 조회 실패:', error);
        throw error;
    }
}

/**
 * USDC 잔고 조회
 * @param accountId - Orderly 계정 ID
 * @param secretKey - Orderly 시크릿 키
 * @param isTestnet - 테스트넷 사용 여부 (기본값: false)
 * @returns USDC 잔고 정보
 */
export async function getUSDCBalance(
    accountId: string,
    secretKey: Uint8Array,
    isTestnet: boolean = false
): Promise<CurrentHoldingData | null> {
    try {
        const holdings = await getCurrentHoldings(accountId, secretKey, isTestnet);
        const usdcHolding = holdings.find(holding => holding.token === 'USDC');

        if (usdcHolding) {
            console.log('✅ USDC 잔고 조회 성공');
            return usdcHolding;
        } else {
            console.log('⚠️  USDC 잔고가 없습니다.');
            return null;
        }
    } catch (error) {
        console.error('USDC 잔고 조회 실패:', error);
        throw error;
    }
}

/**
 * 자산 내역 조회 (Asset History)
 * @param accountId - Orderly 계정 ID
 * @param secretKey - Orderly 시크릿 키
 * @param options - 조회 옵션
 * @param isTestnet - 테스트넷 사용 여부 (기본값: false)
 * @returns 자산 내역 데이터
 */
export async function getAssetHistory(
    accountId: string,
    secretKey: Uint8Array,
    options: {
        token?: string;
        side?: 'DEPOSIT' | 'WITHDRAW';
        status?: 'NEW' | 'CONFIRM' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'PENDING_REBALANCE';
        start_t?: number;
        end_t?: number;
        page?: number;
        size?: number;
    } = {},
    isTestnet: boolean = false
): Promise<AssetHistoryData> {
    const baseUrl = isTestnet
        ? 'https://testnet-api.orderly.org'
        : 'https://api.orderly.org';

    const url = new URL('/v1/asset/history', baseUrl);

    // 쿼리 파라미터 추가
    if (options.token) url.searchParams.append('token', options.token);
    if (options.side) url.searchParams.append('side', options.side);
    if (options.status) url.searchParams.append('status', options.status);
    if (options.start_t) url.searchParams.append('start_t', options.start_t.toString());
    if (options.end_t) url.searchParams.append('end_t', options.end_t.toString());
    if (options.page) url.searchParams.append('page', options.page.toString());
    if (options.size) url.searchParams.append('size', options.size.toString());

    const headers = await createOrderlyAuthHeaders(accountId, secretKey, url);

    try {
        console.log('Orderly 자산 내역 조회 중...');
        console.log(`URL: ${url.toString()}`);

        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...headers
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Orderly API 오류 (${response.status}): ${errorText}`);
        }

        const result = await response.json() as AssetHistoryApiResponse;

        if (!result.success) {
            throw new Error('Orderly API 응답이 성공하지 않았습니다.');
        }

        console.log('✅ Orderly 자산 내역 조회 성공');
        console.log(`총 레코드 수: ${result.data.meta.total}`);

        return result.data;
    } catch (error) {
        console.error('Orderly 자산 내역 조회 실패:', error);
        throw error;
    }
}

/**
 * USDC 잔고 정보를 보기 좋게 출력
 */
export function printUSDCBalance(usdcHolding: CurrentHoldingData): void {
    console.log('\n=== USDC 잔고 정보 ===');
    console.log(`토큰: ${usdcHolding.token}`);
    console.log(`보유량: ${usdcHolding.holding.toFixed(6)} USDC`);
    // console.log(`동결된 금액: ${usdcHolding.frozen.toFixed(6)} USDC`);
    // console.log(`대기 중인 숏 포지션: ${usdcHolding.pending_short.toFixed(6)} USDC`);
    // console.log(`사용 가능한 잔고: ${(usdcHolding.holding - usdcHolding.frozen).toFixed(6)} USDC`);
    // console.log(`업데이트 시간: ${new Date(usdcHolding.updated_time).toLocaleString()}`);
}

/**
 * 모든 보유 자산 정보를 보기 좋게 출력
 */
export function printAllHoldings(holdings: CurrentHoldingData[]): void {
    console.log('\n=== 전체 보유 자산 ===');
    console.log(`총 자산 수: ${holdings.length}`);

    holdings.forEach((holding, index) => {
        console.log(`\n${index + 1}. ${holding.token}`);
        console.log(`   보유량: ${holding.holding.toFixed(6)}`);
        console.log(`   동결된 금액: ${holding.frozen.toFixed(6)}`);
        console.log(`   대기 중인 숏 포지션: ${holding.pending_short.toFixed(6)}`);
        console.log(`   사용 가능한 잔고: ${(holding.holding - holding.frozen).toFixed(6)}`);
        console.log(`   업데이트 시간: ${new Date(holding.updated_time).toLocaleString()}`);
    });
}

/**
 * 자산 내역을 보기 좋게 출력
 */
export function printAssetHistory(assetHistory: AssetHistoryData): void {
    console.log('\n=== 자산 내역 ===');
    console.log(`총 레코드 수: ${assetHistory.meta.total}`);
    console.log(`현재 페이지: ${assetHistory.meta.current_page}`);
    console.log(`페이지당 레코드 수: ${assetHistory.meta.records_per_page}`);

    assetHistory.rows.forEach((row, index) => {
        console.log(`\n${index + 1}. ${row.side} - ${row.token}`);
        console.log(`   거래 ID: ${row.id}`);
        console.log(`   트랜잭션 ID: ${row.tx_id}`);
        console.log(`   금액: ${row.amount.toFixed(6)} ${row.token}`);
        console.log(`   수수료: ${row.fee.toFixed(6)}`);
        console.log(`   상태: ${row.trans_status}`);
        console.log(`   생성 시간: ${new Date(row.created_time).toLocaleString()}`);
        console.log(`   업데이트 시간: ${new Date(row.updated_time).toLocaleString()}`);
        console.log(`   체인 ID: ${row.chain_id}`);
    });
}
