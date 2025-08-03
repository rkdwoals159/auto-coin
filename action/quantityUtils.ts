import { CommonUtils } from '../utils/commonUtils';

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
    return CommonUtils.quantityUtils.roundByPrice(quantity, price);
}

/**
 * 금액을 가격으로 나누어 수량을 계산하고 적절한 단위로 반올림
 * @param amount - 매수/매도 금액 (USDC)
 * @param price - 현재 가격
 * @returns 반올림된 수량
 */
export function calculateQuantityFromAmount(amount: number, price: number): number {
    return CommonUtils.quantityUtils.calculateFromAmount(amount, price);
}

/**
 * 가격별 수량 단위 정보 출력
 * @param price - 현재 가격
 * @returns 단위 설명
 */
export function getQuantityUnitInfo(price: number): string {
    return CommonUtils.quantityUtils.getUnitInfo(price);
} 