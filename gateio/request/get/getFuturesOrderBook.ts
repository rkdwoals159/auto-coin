interface OrderBookEntry {
    price: string;
    size: string;
}

interface FuturesOrderBookResponse {
    asks: OrderBookEntry[];
    bids: OrderBookEntry[];
    ts: number;
    version: number;
}

async function getFuturesOrderBook(
    settle: 'usdt' | 'btc',
    contract: string,
    limit: number = 10
): Promise<FuturesOrderBookResponse> {
    const baseUrl = 'https://api.gateio.ws/api/v4';
    const endpoint = `/futures/${settle}/order_book`;
    const url = `${baseUrl}${endpoint}?contract=${encodeURIComponent(contract)}&limit=${limit}`;

    try {
        const res = await fetch(url, {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });

        if (!res.ok) {
            throw new Error(`HTTP error! Status: ${res.status}`);
        }

        const data = await res.json() as FuturesOrderBookResponse;
        return data;
    } catch (error) {
        console.error('Failed to fetch futures order book:', error);
        throw error;
    }
}
export default getFuturesOrderBook;