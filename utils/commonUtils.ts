/**
 * 공통 유틸리티 클래스
 * 중복된 기능들을 통합하여 관리
 */
export class CommonUtils {
    /**
     * 심볼 정규화 관련 함수들
     */
    static normalizeSymbol = {
        /**
         * Gate.io 심볼에서 _USDT 제거
         * 예: ORBS_USDT -> ORBS
         */
        gateio: (symbol: string): string => {
            if (!symbol) {
                console.warn('normalizeGateIOSymbol: symbol이 undefined입니다.');
                return '';
            }
            return symbol.replace('_USDT', '');
        },

        /**
         * Orderly 심볼에서 PERP_와 _USDC 제거하여 중간 부분만 추출
         * 예: PERP_RUNE_USDC -> RUNE
         */
        orderly: (symbol: string): string => {
            if (!symbol) {
                console.warn('normalizeOrderlySymbol: symbol이 undefined입니다.');
                return '';
            }
            return symbol.replace('PERP_', '').replace('_USDC', '');
        }
    };

    /**
     * 가격별 수량 반올림 유틸리티
     */
    static quantityUtils = {
        /**
         * 가격에 따른 적절한 수량 단위로 반올림
         */
        roundByPrice: (quantity: number, price: number): number => {
            if (price <= 0.1) {
                return Math.round(quantity / 10) * 10;
            } else if (price <= 1) {
                return Math.round(quantity);
            } else if (price <= 10) {
                return Math.round(quantity * 10) / 10;
            } else if (price <= 3000) {
                return Math.round(quantity * 100) / 100;
            } else if (price <= 50000) {
                return Math.round(quantity * 1000) / 1000;
            } else {
                return Math.round(quantity * 100000) / 100000;
            }
        },

        /**
         * 금액을 가격으로 나누어 수량을 계산하고 적절한 단위로 반올림
         */
        calculateFromAmount: (amount: number, price: number): number => {
            const rawQuantity = amount / price;
            return CommonUtils.quantityUtils.roundByPrice(rawQuantity, price);
        },

        /**
         * 가격별 수량 단위 정보 출력
         */
        getUnitInfo: (price: number): string => {
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
    };

    /**
     * 가격 비교 및 분석 유틸리티
     */
    static priceAnalysis = {
        /**
         * 가격 차이 계산
         */
        calculateDifference: (price1: number, price2: number): { difference: number; percent: number } => {
            const difference = Math.abs(price1 - price2);
            const percent = (difference / price1) * 100;
            return { difference, percent };
        },

        /**
         * 가격 비교 결과 정렬
         */
        sortByPriceDifference: (comparisons: Array<{ symbol: string; price1: number; price2: number; difference: number; percent: number }>) => {
            return comparisons.sort((a, b) => b.percent - a.percent);
        }
    };

    /**
     * 데이터 매칭 유틸리티
     */
    static dataMatching = {
        /**
         * 두 API의 데이터를 매칭하여 같은 심볼끼리 비교
         */
        matchSymbolData: (gateioData: any[], orderlyData: any[]): Array<{ symbol: string; gateio_mark_price: string; orderly_mark_price: number }> => {
            const matchedData: Array<{ symbol: string; gateio_mark_price: string; orderly_mark_price: number }> = [];

            // Gate.io 데이터를 정규화된 심볼로 매핑
            const gateioMap = new Map<string, any>();
            gateioData.forEach(item => {
                const normalizedSymbol = CommonUtils.normalizeSymbol.gateio(item.symbol || item.name);
                gateioMap.set(normalizedSymbol, item);
            });

            // Orderly 데이터를 정규화된 심볼로 매핑
            const orderlyMap = new Map<string, any>();
            orderlyData.forEach(item => {
                const normalizedSymbol = CommonUtils.normalizeSymbol.orderly(item.symbol);
                orderlyMap.set(normalizedSymbol, item);
            });

            // 공통 심볼 찾기
            const commonSymbols = new Set([...gateioMap.keys(), ...orderlyMap.keys()]);

            commonSymbols.forEach(symbol => {
                const gateioItem = gateioMap.get(symbol);
                const orderlyItem = orderlyMap.get(symbol);

                if (gateioItem && orderlyItem) {
                    matchedData.push({
                        symbol: symbol,
                        gateio_mark_price: gateioItem.mark_price,
                        orderly_mark_price: orderlyItem.mark_price
                    });
                }
            });

            return matchedData;
        },

        /**
         * 매칭된 데이터를 기반으로 가격 차이를 분석
         */
        analyzePriceDifference: (matchedData: Array<{ symbol: string; gateio_mark_price: string; orderly_mark_price: number }>) => {
            return matchedData.map(item => {
                const gateioPrice = parseFloat(item.gateio_mark_price);
                const orderlyPrice = item.orderly_mark_price;
                const { difference, percent } = CommonUtils.priceAnalysis.calculateDifference(gateioPrice, orderlyPrice);

                return {
                    symbol: item.symbol,
                    gateio_price: gateioPrice,
                    orderly_price: orderlyPrice,
                    price_difference: difference,
                    price_difference_percent: percent
                };
            }).sort((a, b) => b.price_difference_percent - a.price_difference_percent);
        }
    };

    /**
     * 공통 코인 필터링 유틸리티
     */
    static coinFiltering = {
        /**
         * 두 거래소의 데이터에서 공통 코인을 찾고 거래금액 기준을 적용
         */
        filterCommonCoinsWithVolume: (
            gateioData: any[],
            orderlyData: any[],
            minAmount: number = 300000
        ): Array<{
            symbol: string;
            gateio_price: number;
            orderly_price: number;
            avgVolume: number;
            gateio_volume: number;
            orderly_volume: number;
        }> => {
            // Gate.io 데이터를 정규화된 심볼로 매핑
            const gateioMap = new Map<string, any>();
            gateioData.forEach(item => {
                const normalizedSymbol = CommonUtils.normalizeSymbol.gateio(item.name);
                gateioMap.set(normalizedSymbol, item);
            });

            // Orderly 데이터를 정규화된 심볼로 매핑
            const orderlyMap = new Map<string, any>();
            orderlyData.forEach(item => {
                const normalizedSymbol = CommonUtils.normalizeSymbol.orderly(item.symbol);
                orderlyMap.set(normalizedSymbol, item);
            });

            // 공통 심볼 찾기
            const commonSymbols = new Set([...gateioMap.keys(), ...orderlyMap.keys()]);

            const commonCoins: Array<{
                symbol: string;
                gateio_price: number;
                orderly_price: number;
                avgVolume: number;
                gateio_volume: number;
                orderly_volume: number;
            }> = [];

            // 공통 심볼에 대해 거래량 조건 확인
            for (const symbol of commonSymbols) {
                const gateioItem = gateioMap.get(symbol);
                const orderlyItem = orderlyMap.get(symbol);

                if (gateioItem && orderlyItem) {
                    const gateioVolume = (gateioItem as any).quote_volume || 0;
                    const orderlyVolume = orderlyItem['24h_amount'] || 0;

                    // 두 거래소 모두에서 최소 거래량을 만족하는 경우만 포함
                    if (gateioVolume >= minAmount && orderlyVolume >= minAmount) {
                        const avgVolume = (gateioVolume + orderlyVolume) / 2;
                        commonCoins.push({
                            symbol: symbol,
                            gateio_price: parseFloat(gateioItem.mark_price),
                            orderly_price: orderlyItem.mark_price,
                            avgVolume: avgVolume,
                            gateio_volume: gateioVolume,
                            orderly_volume: orderlyVolume
                        });
                    }
                }
            }

            return commonCoins;
        }
    };
} 