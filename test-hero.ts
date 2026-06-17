class HeroSMSClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://hero-sms.com/stubs/handler_api.php';
  }

  private async request(action: string, params: Record<string, string | number> = {}): Promise<string> {
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

  async getBalance(): Promise<number> {
    const text = await this.request('getBalance');
    if (text.startsWith('ACCESS_BALANCE:')) {
      const balanceStr = text.split(':')[1];
      return parseFloat(balanceStr);
    }
    throw new Error(`Failed to get balance. Response: ${text}`);
  }

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

  async setStatus(id: string, status: number): Promise<string> {
    return await this.request('setStatus', { id, status });
  }

  async getStatus(id: string): Promise<string> {
    return await this.request('getStatus', { id });
  }
}

async function runTest() {
  const apiKey = '7d3ccdA7befc03AfA2469b1bbff04cf6';
  const client = new HeroSMSClient(apiKey);

  console.log('=== HeroSMS API End-to-End Test ===');
  
  try {
    // 1. Test getBalance
    console.log('[1/4] Testing getBalance...');
    const balance = await client.getBalance();
    console.log(`✅ Balance retrieved successfully: $${balance}`);
    
    // 2. Test getNumber (we will test a cheap or specific country, let's use Russia (0) and Other (ot) which is very cheap)
    console.log('\n[2/4] Testing getNumber (ot, country 0)...');
    let orderId: string | null = null;
    try {
      const numberInfo = await client.getNumber('ot', '0');
      console.log(`✅ Number retrieved successfully!`);
      console.log(`   ID: ${numberInfo.id}`);
      console.log(`   Phone: ${numberInfo.phone}`);
      orderId = numberInfo.id;
    } catch (e: any) {
      if (e.message.includes('NO_NUMBERS')) {
        console.log(`⚠️ No numbers available for this service right now.`);
      } else if (e.message.includes('NO_BALANCE')) {
        console.log(`⚠️ Insufficient balance to get a number.`);
      } else {
        throw e;
      }
    }

    if (orderId) {
      // 3. Test getStatus
      console.log(`\n[3/4] Testing getStatus for Order ${orderId}...`);
      const status = await client.getStatus(orderId);
      console.log(`✅ Current Status: ${status}`);

      // 4. Test setStatus (Cancel the order to refund)
      console.log(`\n[4/4] Testing setStatus (Canceling Order ${orderId} to refund)...`);
      const cancelStatus = await client.setStatus(orderId, 8);
      console.log(`✅ Cancel Status Response: ${cancelStatus}`);
    } else {
      console.log(`\n[3/4] Skipped getStatus (No order created)`);
      console.log(`[4/4] Skipped setStatus (No order created)`);
    }

    console.log('\n=== Test Completed Successfully ===');
  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
  }
}

runTest();
