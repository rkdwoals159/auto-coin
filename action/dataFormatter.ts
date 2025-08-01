import { PriceComparisonData } from './dataMatcher';

/**
 * 한국어 key로 변환된 가격 비교 데이터 타입
 */
export interface KoreanPriceComparisonData {
    코인: string;
    gateio_가격: number;
    orderly_가격: number;
    가격_차이: number;
    가격_차이율: string;
}

/**
 * 가격 비교 데이터의 key를 한국어로 변환
 */
export function convertToKoreanKeys(data: PriceComparisonData): KoreanPriceComparisonData {
    return {
        코인: data.symbol,
        gateio_가격: data.gateio_price,
        orderly_가격: data.orderly_price,
        가격_차이: data.price_difference,
        가격_차이율: (data.price_difference_percent).toFixed(2) + '%'
    };
}

/**
 * 가격 비교 데이터 배열의 모든 key를 한국어로 변환
 */
export function convertPriceComparisonToKorean(dataArray: PriceComparisonData[]): KoreanPriceComparisonData[] {
    return dataArray.map(convertToKoreanKeys);
}

/**
 * 숫자 포맷팅 함수들
 */
export const NumberFormatter = {
    /**
     * 가격을 소수점 6자리까지 포맷팅
     */
    formatPrice: (price: number): string => price.toFixed(6),

    /**
     * 백분율을 소수점 4자리까지 포맷팅
     */
    formatPercentage: (percentage: number): string => percentage.toFixed(4),

    /**
     * 가격 차이를 소수점 6자리까지 포맷팅
     */
    formatPriceDifference: (difference: number): string => difference.toFixed(6)
};

/**
 * 한국어 key로 변환하고 숫자 포맷팅까지 적용
 */
export function formatPriceComparisonWithKorean(data: PriceComparisonData): KoreanPriceComparisonData {
    return {
        코인: data.symbol,
        gateio_가격: parseFloat(NumberFormatter.formatPrice(data.gateio_price)),
        orderly_가격: parseFloat(NumberFormatter.formatPrice(data.orderly_price)),
        가격_차이: parseFloat(NumberFormatter.formatPriceDifference(data.price_difference)),
        가격_차이율: (data.price_difference_percent).toFixed(2) + '%'
    };
}

/**
 * 가격 비교 데이터 배열을 한국어 key로 변환하고 포맷팅
 */
export function formatPriceComparisonArray(dataArray: PriceComparisonData[]): KoreanPriceComparisonData[] {
    return dataArray.map(formatPriceComparisonWithKorean);
} 