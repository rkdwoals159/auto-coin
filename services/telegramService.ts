import { TelegramNotification } from '../types/common';
import { EnvironmentManager } from '../config/environment';
import { getUSDCBalance } from '../aden/request/get/getAssetHistory';
import { getGateIOFuturesAccount } from '../gateio/request/get/getAssetHistory';
import { getAllPositionsInfo } from '../aden/request/get/getAllPositionsInfo';

/**
 * 포지션 진입 시점 가격 정보
 */
export interface PositionEntryPrice {
    orderlyPrice: number;
    gateioPrice: number;
}

/**
 * 텔레그램 API 응답 타입
 */
interface TelegramApiResponse {
    ok: boolean;
    description?: string;
    result?: any;
}

/**
 * 텔레그램 알림 서비스
 */
export class TelegramService {
    private static instance: TelegramService;
    private envManager: EnvironmentManager;
    private isEnabled: boolean;

    private constructor() {
        this.envManager = EnvironmentManager.getInstance();
        this.isEnabled = this.envManager.hasTelegramAuth();
    }

    public static getInstance(): TelegramService {
        if (!TelegramService.instance) {
            TelegramService.instance = new TelegramService();
        }
        return TelegramService.instance;
    }

    /**
     * 텔레그램 알림 전송
     */
    public async sendNotification(notification: TelegramNotification): Promise<boolean> {
        if (!this.isEnabled) {
            console.log('텔레그램 알림이 비활성화되어 있습니다.');
            return false;
        }

        try {
            const auth = this.envManager.getTelegramAuth();
            const message = this.formatMessage(notification);

            const url = `https://api.telegram.org/bot${auth.botToken}/sendMessage`;
            const params = new URLSearchParams({
                chat_id: auth.chatId!,
                text: message,
                parse_mode: 'HTML'
            });

            const response = await fetch(`${url}?${params}`);
            const result = await response.json() as TelegramApiResponse;

            if (result.ok) {
                console.log(`✅ 텔레그램 알림 전송 성공: ${notification.type}`);
                return true;
            } else {
                console.error(`❌ 텔레그램 알림 전송 실패: ${result.description}`);
                return false;
            }
        } catch (error) {
            console.error('텔레그램 알림 전송 중 오류 발생:', error);
            return false;
        }
    }





    /**
     * 포지션 진입 텔레그램 알림 전송 (상세 정보 포함)
     */
    public async sendPositionEntryNotificationWithDetails(
        symbol: string,
        orderlyPrice: number,
        gateioPrice: number,
        quantity: number = 1
    ): Promise<boolean> {
        try {
            const priceDifference = ((orderlyPrice - gateioPrice) / gateioPrice) * 100;
            const side = orderlyPrice > gateioPrice ? 'long' : 'short';

            // Orderly와 Gate.io 방향 결정
            const orderlySide = orderlyPrice > gateioPrice ? '숏' : '롱';
            const gateioSide = orderlyPrice > gateioPrice ? '롱' : '숏';

            const message = `📊 <b>진입가격:</b>\n` +
                `  - Orderly: $${orderlyPrice.toFixed(6)} (${orderlySide})\n` +
                `  - Gate.io: $${gateioPrice.toFixed(6)} (${gateioSide})\n` +
                `📊 <b>가격차이율:</b> ${priceDifference.toFixed(4)}%`;

            const notification: TelegramNotification = {
                type: 'position_entry',
                symbol,
                side,
                quantity,
                price: orderlyPrice,
                timestamp: new Date(),
                message
            };

            return this.sendNotification(notification);
        } catch (error) {
            console.error('포지션 진입 텔레그램 알림 전송 실패:', error);
            return false;
        }
    }

    /**
     * 포지션 종료 텔레그램 알림 전송 (상세 정보 포함)
     */
    public async sendPositionExitNotificationWithDetails(
        symbol: string,
        side: 'long' | 'short',
        quantity: number,
        orderlyClosePrice: number,
        gateioClosePrice: number,
        entryPrice: PositionEntryPrice,
        netProfit: number,
        orderlyBalance?: number,
        gateioBalance?: number
    ): Promise<boolean> {
        try {
            // 종료 시점의 Orderly와 Gate.io 가격 차이율 계산
            const priceDifference = ((orderlyClosePrice - gateioClosePrice) / gateioClosePrice) * 100;
            // Orderly와 Gate.io 방향 결정
            const orderlySide = entryPrice.orderlyPrice > entryPrice.gateioPrice ? '숏' : '롱';
            const gateioSide = entryPrice.orderlyPrice > entryPrice.gateioPrice ? '롱' : '숏';

            // 잔액 조회 (전달받은 값이 있으면 사용, 없으면 새로 조회)
            const finalOrderlyBalance = orderlyBalance !== undefined ? orderlyBalance : await this.getOrderlyBalance();
            const finalGateioBalance = gateioBalance !== undefined ? gateioBalance : await this.getGateIOBalance();

            const profitLossText = netProfit >= 0 ? `+$${netProfit.toFixed(6)}` : `-$${Math.abs(netProfit).toFixed(6)}`;

            const message = `📊 <b>종료가격:</b>\n` +
                `  - Orderly: $${orderlyClosePrice.toFixed(6)} (${orderlySide})\n` +
                `  - Gate.io: $${gateioClosePrice.toFixed(6)} (${gateioSide})\n\n` +
                `📊 <b>가격차이율:</b> ${priceDifference.toFixed(4)}%\n` +
                `💰 <b>최종 수익/손실:</b> ${profitLossText}\n` +
                `💵 <b>현재 사용가능한 금액:</b>\n` +
                `  - Orderly: $${finalOrderlyBalance.toFixed(2)}\n` +
                `  - Gate.io: $${finalGateioBalance.toFixed(2)}`;

            const notification: TelegramNotification = {
                type: 'position_exit',
                symbol,
                side,
                quantity,
                price: orderlyClosePrice,
                timestamp: new Date(),
                message
            };

            return this.sendNotification(notification);
        } catch (error) {
            console.error('포지션 종료 텔레그램 알림 전송 실패:', error);
            return false;
        }
    }

    /**
     * Orderly 계정 잔액 조회 (실시간 사용 가능한 담보)
     */
    private async getOrderlyBalance(): Promise<number> {
        try {
            if (!this.envManager.hasOrderlyAuth()) {
                return 0;
            }

            const auth = this.envManager.getOrderlyAuth();
            const positions = await getAllPositionsInfo(auth.accountId!, auth.secretKey as Uint8Array, false);

            if (positions) {
                return positions.free_collateral;
            }

            return 0;
        } catch (error) {
            console.error('Orderly 잔액 조회 실패:', error);
            return 0;
        }
    }

    /**
     * Gate.io 계정 잔액 조회
     */
    private async getGateIOBalance(): Promise<number> {
        try {
            if (!this.envManager.hasGateIOAuth()) {
                return 0;
            }

            const auth = this.envManager.getGateIOAuth();
            const secretKey = typeof auth.secretKey === 'string' ? auth.secretKey : Buffer.from(auth.secretKey!).toString('hex');
            const futuresAccount = await getGateIOFuturesAccount('usdt', auth.apiKey!, secretKey);

            if (futuresAccount && futuresAccount.total) {
                return parseFloat(futuresAccount.total);
            }

            return 0;
        } catch (error) {
            console.error('Gate.io 잔액 조회 실패:', error);
            return 0;
        }
    }

    /**
     * 메시지 포맷팅
     */
    private formatMessage(notification: TelegramNotification): string {
        const type = notification.type === 'position_entry' ? '📈 포지션 진입' : '📉 포지션 종료';
        const side = notification.side === 'long' ? '롱' : '숏';
        const emoji = notification.type === 'position_entry' ? '🟢' : '🔴';

        const time = notification.timestamp.toLocaleString('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });

        let message = `${emoji} <b>${type}</b>\n\n`;
        message += `📊 <b>심볼:</b> ${notification.symbol}\n`;
        // message += `📈 <b>방향:</b> ${side}\n`;
        message += `💰 <b>수량:</b> ${notification.quantity}\n`;
        message += `⏰ <b>시간:</b> ${time}`;

        if (notification.message) {
            message += `\n\n${notification.message}`;
        }

        return message;
    }

    /**
     * 텔레그램 서비스 활성화 상태 확인
     */
    public isServiceEnabled(): boolean {
        return this.isEnabled;
    }
} 