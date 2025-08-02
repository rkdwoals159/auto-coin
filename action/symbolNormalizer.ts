/**
 * 심볼 정규화 관련 함수들
 * Gate.io와 Orderly API의 심볼 형식을 통일
 */

/**
 * Gate.io 심볼에서 _USDT 제거
 * 예: ORBS_USDT -> ORBS
 */
export function normalizeGateIOSymbol(symbol: string): string {
    if (!symbol) {
        console.warn('normalizeGateIOSymbol: symbol이 undefined입니다.');
        return '';
    }
    return symbol.replace('_USDT', '');
}

/**
 * Orderly 심볼에서 PERP_와 _USDC 제거하여 중간 부분만 추출
 * 예: PERP_RUNE_USDC -> RUNE
 */
export function normalizeOrderlySymbol(symbol: string): string {
    if (!symbol) {
        console.warn('normalizeOrderlySymbol: symbol이 undefined입니다.');
        return '';
    }
    return symbol.replace('PERP_', '').replace('_USDC', '');
}

/**
 * 모든 심볼 정규화 함수들을 한 곳에서 관리
 */
export const SymbolNormalizer = {
    gateio: normalizeGateIOSymbol,
    orderly: normalizeOrderlySymbol
}; 