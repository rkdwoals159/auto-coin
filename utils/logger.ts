/**
 * 로깅 유틸리티 클래스
 * 중복된 console.log들을 통합 관리
 */
export class Logger {
    /**
     * 차익거래 진입 정보 로그
     */
    static logArbitrageEntry(
        coinSymbol: string,
        orderlyPrice: number,
        gateioPrice: number,
        quantity: number,
        direction: string
    ): void {
        console.log(`\n💰 ${coinSymbol} 차익거래 진입 완료! ===`);
        console.log(`📈 진입 시점 정보:`);
        console.log(`  - Orderly 진입가: $${orderlyPrice.toFixed(6)}`);
        console.log(`  - Gate.io 진입가: $${gateioPrice.toFixed(6)}`);
        if (quantity > 0) {
            console.log(`  - 거래 수량: ${quantity.toFixed(6)}`);
        }
        console.log(`  - 거래 방향: ${direction}`);
        console.log(`  - 진입 시 가격차이율: ${((orderlyPrice - gateioPrice) / gateioPrice * 100).toFixed(4)}%`);
        console.log(`  - 예상 수익률: ${((orderlyPrice - gateioPrice) / gateioPrice * 100).toFixed(4)}%`);
    }

    /**
     * API 인증 정보 없음 경고
     */
    static logNoAuthWarning(service: string, requiredVars?: string[]): void {
        console.log(`⚠️  ${service} API 인증 정보가 없어 해당 기능을 건너뜁니다.`);
        if (requiredVars && requiredVars.length > 0) {
            console.log(`환경 변수 설정: ${requiredVars.join(', ')}`);
        }
    }

    /**
     * 주문 생성 성공 로그
     */
    static logOrderSuccess(orderId: string, symbol: string, quantity: number, price?: number): void {
        console.log(`✅ 주문 생성 성공!`);
        console.log(`주문 ID: ${orderId}`);
        console.log(`심볼: ${symbol}`);
        console.log(`수량: ${quantity}`);
        if (price) {
            console.log(`가격: $${price.toFixed(6)}`);
        }
    }

    /**
     * 주문 생성 실패 로그
     */
    static logOrderFailure(error: string, symbol?: string): void {
        console.log(`❌ 주문 생성 실패`);
        if (symbol) {
            console.log(`심볼: ${symbol}`);
        }
        console.log(`오류: ${error}`);
    }

    /**
     * 포지션 정보 로그
     */
    static logPositionInfo(
        symbol: string,
        quantity: number,
        entryPrice: number,
        markPrice: number,
        pnl: number
    ): void {
        console.log(`\n📊 ${symbol} 포지션 정보`);
        console.log(`수량: ${quantity}`);
        console.log(`진입가: $${entryPrice.toFixed(6)}`);
        console.log(`마크가: $${markPrice.toFixed(6)}`);
        console.log(`PnL: $${pnl.toFixed(6)}`);
    }

    /**
     * 모니터링 시작 로그
     */
    static logMonitoringStart(
        startTime: Date,
        durationHours: number,
        intervalMs: number,
        pauseThreshold: number
    ): void {
        console.log(`시장 모니터링 시작: ${startTime.toLocaleString()}`);
        console.log(`모니터링 시간: ${durationHours}시간`);
        console.log(`실행 간격: ${intervalMs}ms (최적화됨)`);
        console.log(`일시중단 임계값: ${pauseThreshold}%`);
    }

    /**
     * 가격차이율 임계값 초과 로그
     */
    static logThresholdExceeded(pauseThreshold: number): void {
        console.log(`\n⚠️  가격차이율이 ${pauseThreshold}%를 초과했습니다!`);
        console.log(`모니터링을 일시 중단하고 orderbook 분석을 시작합니다...`);
        console.log(`현재 시간: ${new Date().toLocaleString()}`);
        console.log('---');
    }

    /**
     * 새로운 최고 가격차이율 발견 로그
     */
    static logNewHighestPriceDifference(
        timestamp: Date,
        coin: string,
        priceDifferencePercent: number,
        gateioPrice: number,
        orderlyPrice: number,
        gateioVolume: number,
        orderlyVolume: number
    ): void {
        console.log(`\n새로운 최고 가격차이율 발견!`);
        console.log(`시간: ${timestamp.toLocaleString()}`);
        console.log(`코인: ${coin}`);
        console.log(`가격차이율: ${priceDifferencePercent.toFixed(4)}%`);
        console.log(`Gate.io 가격: ${gateioPrice}`);
        console.log(`Orderly 가격: ${orderlyPrice}`);
        console.log(`Gate.io 24시간 거래금액: ${gateioVolume.toLocaleString()} USDT`);
        console.log(`Orderly 24시간 거래금액: ${orderlyVolume.toLocaleString()} USDT`);
        console.log('---');
    }

    /**
     * 병렬 주문 성공 로그
     */
    static logParallelOrderSuccess(orderlyOrderId: string, gateioOrderId: string): void {
        console.log(`[최적화] 병렬 주문 성공!`);
        console.log(`Orderly 주문ID: ${orderlyOrderId}`);
        console.log(`Gate.io 주문ID: ${gateioOrderId}`);
    }

    /**
     * 병렬 주문 실패 로그
     */
    static logParallelOrderFailure(error?: string): void {
        console.log(`[최적화] 병렬 주문 실패`);
        if (error) {
            console.log(`오류: ${error}`);
        }
    }

    /**
     * 진행 상황 로그
     */
    static logProgress(elapsedMinutes: number, totalExecutions: number): void {
        console.log(`진행 상황: ${elapsedMinutes}분 경과, 총 실행 횟수: ${totalExecutions}`);
    }

    /**
     * 모니터링 완료 로그
     */
    static logMonitoringComplete(endTime: Date, totalExecutions: number): void {
        console.log(`모니터링 완료: ${endTime.toLocaleString()}`);
        console.log(`총 실행 횟수: ${totalExecutions}`);
    }

    /**
     * 모니터링 결과 로그
     */
    static logMonitoringResult(result: {
        startTime: Date;
        endTime: Date;
        totalExecutions: number;
        averagePriceDifference: number;
        highestPriceDifference?: {
            timestamp: Date;
            coin: string;
            gateio_price: number;
            orderly_price: number;
            price_difference: number;
            price_difference_percent: number;
        } | null;
    }): void {
        console.log('\n=== 시장 모니터링 최종 결과 ===');
        console.log(`시작 시간: ${result.startTime.toLocaleString()}`);
        console.log(`종료 시간: ${result.endTime.toLocaleString()}`);
        console.log(`총 실행 횟수: ${result.totalExecutions}`);
        console.log(`평균 가격차이율: ${result.averagePriceDifference.toFixed(4)}%`);

        if (result.highestPriceDifference && result.highestPriceDifference !== null) {
            console.log('\n=== 최고 가격차이율 데이터 ===');
            console.log(`발견 시간: ${result.highestPriceDifference.timestamp.toLocaleString()}`);
            console.log(`코인: ${result.highestPriceDifference.coin}`);
            console.log(`Gate.io 가격: ${result.highestPriceDifference.gateio_price}`);
            console.log(`Orderly 가격: ${result.highestPriceDifference.orderly_price}`);
            console.log(`가격 차이: ${result.highestPriceDifference.price_difference.toFixed(6)}`);
            console.log(`가격차이율: ${result.highestPriceDifference.price_difference_percent.toFixed(4)}%`);
        }
    }
} 