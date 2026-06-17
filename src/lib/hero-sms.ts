export class HeroSMSClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    // Common standard endpoint for SMS-activate API clones
    this.baseUrl = 'https://hero-sms.com/stubs/handler_api.php';
  }

  private async request(action: string, params: Record<string, string | number> = {}): Promise<string> {
    if (this.apiKey === 'test_fake_api_key') {
      if (action === 'getPrices') return JSON.stringify({ "0": { "tg": { cost: "15.00", count: 1200 }, "wa": { cost: "25.00", count: 800 }, "openai": { cost: "10.00", count: 500 }, "ig": { cost: "12.50", count: 200 } } });
      if (action === 'getNumber') return "ACCESS_NUMBER:999111222:79991112233";
      if (action === 'getStatus') return "STATUS_OK:987654";
      if (action === 'setStatus') return "ACCESS_CANCEL";
    }

    const url = new URL(this.baseUrl);
    url.searchParams.append('api_key', this.apiKey);
    url.searchParams.append('action', action);
    
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.append(key, value.toString());
    }

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.text();
  }

  /**
   * Get account balance
   */
  async getBalance(): Promise<number> {
    const text = await this.request('getBalance');
    if (text.startsWith('ACCESS_BALANCE:')) {
      const balanceStr = text.split(':')[1];
      return parseFloat(balanceStr);
    }
    throw new Error(`Failed to get balance. Response: ${text}`);
  }

  /**
   * Get prices and inventory
   */
  async getPrices(service?: string, country?: string): Promise<any> {
    const params: Record<string, string | number> = {};
    if (service) params.service = service;
    if (country) params.country = country;
    const text = await this.request('getPrices', params);
    try {
      return JSON.parse(text);
    } catch (e) {
      throw new Error(`Failed to parse prices. Response: ${text}`);
    }
  }

  /**
   * Get a phone number
   * @param service Service code (e.g. 'tg' for Telegram)
   * @param country Country ID (e.g. 0 for Russia)
   */
  async getNumber(service: string, country: string = '0'): Promise<{ id: string, phone: string }> {
    const text = await this.request('getNumber', { service, country });
    if (text.startsWith('ACCESS_NUMBER:')) {
      const parts = text.split(':');
      if (parts.length === 3) {
        return {
          id: parts[1],
          phone: parts[2]
        };
      }
    }
    throw new Error(`Failed to get number. Response: ${text}`);
  }

  /**
   * Set status for an order
   * @param id Order ID
   * @param status Status code (1=Ready, 3=Retry, 6=Complete, 8=Cancel)
   */
  async setStatus(id: string, status: number): Promise<string> {
    return await this.request('setStatus', { id, status });
  }

  /**
   * Get order status / SMS code
   * @param id Order ID
   */
  async getStatus(id: string): Promise<string> {
    return await this.request('getStatus', { id });
  }
}
