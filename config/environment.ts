import { config } from 'dotenv';
import bs58 from 'bs58';
import { EnvironmentConfig, AuthConfig } from '../types/common';

// 환경 변수 로드
config();

/**
 * 환경 변수 관리 클래스
 */
export class EnvironmentManager {
    private static instance: EnvironmentManager;
    private config: EnvironmentConfig;

    private constructor() {
        this.config = {
            ORDERLY_ACCOUNT_ID: process.env.ORDERLY_ACCOUNT_ID,
            ORDERLY_API_KEY: process.env.ORDERLY_API_KEY,
            ORDERLY_SECRET_KEY: process.env.ORDERLY_SECRET_KEY,
            GATEIO_API_KEY: process.env.GATEIO_API_KEY,
            GATEIO_SECRET_KEY: process.env.GATEIO_SECRET_KEY,
        };
    }

    public static getInstance(): EnvironmentManager {
        if (!EnvironmentManager.instance) {
            EnvironmentManager.instance = new EnvironmentManager();
        }
        return EnvironmentManager.instance;
    }

    /**
     * Orderly 인증 정보 가져오기
     */
    public getOrderlyAuth(): AuthConfig {
        const secretKey = this.config.ORDERLY_SECRET_KEY
            ? bs58.decode(this.config.ORDERLY_SECRET_KEY)
            : undefined;

        return {
            accountId: this.config.ORDERLY_ACCOUNT_ID,
            apiKey: this.config.ORDERLY_API_KEY,
            secretKey: secretKey,
        };
    }

    /**
     * Gate.io 인증 정보 가져오기
     */
    public getGateIOAuth(): AuthConfig {
        return {
            apiKey: this.config.GATEIO_API_KEY,
            secretKey: this.config.GATEIO_SECRET_KEY
                ? this.config.GATEIO_SECRET_KEY
                : undefined,
        };
    }

    /**
     * Orderly 인증 정보 확인
     */
    public hasOrderlyAuth(): boolean {
        const auth = this.getOrderlyAuth();
        return !!(auth.accountId && auth.apiKey && auth.secretKey);
    }

    /**
     * Gate.io 인증 정보 확인
     */
    public hasGateIOAuth(): boolean {
        const auth = this.getGateIOAuth();
        return !!(auth.apiKey && auth.secretKey);
    }

    /**
     * 인증 정보 출력 (마스킹된 형태)
     */
    public printAuthInfo(): void {
        console.log('=== 인증 정보 확인 ===');

        if (this.hasOrderlyAuth()) {
            const auth = this.getOrderlyAuth();
            console.log('✅ Orderly API 인증 정보 확인 완료');
            console.log(`계정 ID: ${auth.accountId}`);
            console.log(`API 키: ${auth.apiKey!.substring(0, 8)}...`);
            console.log(`시크릿 키: ${this.config.ORDERLY_SECRET_KEY!.substring(0, 8)}...`);
        } else {
            console.log('⚠️  Orderly API 인증 정보가 없습니다.');
        }

        if (this.hasGateIOAuth()) {
            console.log('✅ Gate.io API 인증 정보 확인 완료');
            console.log(`API 키: ${this.config.GATEIO_API_KEY!.substring(0, 8)}...`);
            console.log(`시크릿 키: ${this.config.GATEIO_SECRET_KEY!.substring(0, 8)}...`);
        } else {
            console.log('⚠️  Gate.io API 인증 정보가 없습니다.');
        }
    }
} 