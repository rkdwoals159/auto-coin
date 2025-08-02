/**
 * 가격별 수량 반올림 유틸리티
 */

/**
 * 가격에 따른 적절한 수량 단위로 반올림
 * @param quantity - 원본 수량
 * @param price - 현재 가격
 * @returns 반올림된 수량
 */
export function roundQuantityByPrice(quantity: number, price: number): number {
    if (price <= 0.1) {
        // 0.1달러 이하: 10개 단위
        return Math.round(quantity / 10) * 10;
    } else if (price <= 1) {
        // 1달러 이하: 정수
        return Math.round(quantity);
    } else if (price <= 10) {
        // 1달러 초과 ~ 10달러: 소수점 1자리
        return Math.round(quantity * 10) / 10;
    } else if (price <= 3000) {
        // 10달러 초과 ~ 3천달러: 소수점 2자리
        return Math.round(quantity * 100) / 100;
    } else if (price <= 50000) {
        // 3천달러 초과 ~ 5만달러: 소수점 3자리
        return Math.round(quantity * 1000) / 1000;
    } else {
        // 5만달러 초과: 소수점 5자리
        return Math.round(quantity * 100000) / 100000;
    }
}

/**
 * 금액을 가격으로 나누어 수량을 계산하고 적절한 단위로 반올림
 * @param amount - 매수/매도 금액 (USDC)
 * @param price - 현재 가격
 * @returns 반올림된 수량
 */
export function calculateQuantityFromAmount(amount: number, price: number): number {
    const rawQuantity = amount / price;
    return roundQuantityByPrice(rawQuantity, price);
}

/**
 * 가격별 수량 단위 정보 출력
 * @param price - 현재 가격
 * @returns 단위 설명
 */
export function getQuantityUnitInfo(price: number): string {
    if (price <= 0.1) {
        return "10개 단위";
    } else if (price <= 1) {
        return "정수 단위";
    } else if (price <= 10) {
        return "소수점 1자리";
    } else if (price <= 3000) {
        return "소수점 2자리";
    } else if (price <= 50000) {
        return "소수점 3자리";
    } else {
        return "소수점 5자리";
    }
} 