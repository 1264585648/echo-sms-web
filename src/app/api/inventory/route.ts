import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { HeroSMSClient } from '@/lib/hero-sms';
import { readSystemConfigMap } from '@/lib/system-config';
import {
  createInventoryCache,
  getInventoryCacheKey,
  INVENTORY_CACHE_TTL_MS,
  type InventorySuccessBody,
  isValidInventoryCountryId,
} from '@/lib/inventory-cache';

type ServiceConfig = {
  id: string;
  [key: string]: unknown;
};

type PriceEntry = {
  cost?: string | number;
  count?: string | number;
};

type PriceMap = Record<string, Record<string, PriceEntry>>;

const inventoryCache = createInventoryCache();

function inventoryError(code: string, message: string, status: number) {
  return NextResponse.json(
    {
      success: false,
      inventory: [],
      code,
      error: message,
    },
    { status }
  );
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const countryId = searchParams.get('countryId') || '0'; // default to Russia if not provided
    if (!isValidInventoryCountryId(countryId)) {
      return inventoryError(
        'COUNTRY_ID_INVALID',
        'countryId is invalid.',
        400,
      );
    }

    const config = await readSystemConfigMap(db.systemConfig, [
      'HERO_API_KEY',
      'EXCHANGE_RATE',
      'SERVICES',
    ]);

    const apiKey = config['HERO_API_KEY'];
    if (!apiKey) {
      return inventoryError(
        'API_KEY_MISSING',
        'Hero SMS API Key is not configured.',
        503
      );
    }

    const exchangeRateConfig = config['EXCHANGE_RATE'] || '1';
    const exchangeRate = parseFloat(exchangeRateConfig);
    const servicesStr = config['SERVICES'] || '[]';
    let servicesConfig: ServiceConfig[] = [];
    try {
      servicesConfig = JSON.parse(servicesStr);
      if (!Array.isArray(servicesConfig)) {
        return inventoryError(
          'SERVICE_CONFIG_INVALID',
          'Service configuration is invalid.',
          500
        );
      }
    } catch (e) {
      console.error('Inventory service config parse error:', e);
      return inventoryError(
        'SERVICE_CONFIG_INVALID',
        'Service configuration is invalid.',
        500
      );
    }

    if (servicesConfig.length === 0 && !apiKey) {
      return NextResponse.json({ success: true, inventory: [] });
    }

    const cacheKey = getInventoryCacheKey({
      countryId,
      apiKey,
      exchangeRateConfig,
      servicesConfig: servicesStr,
    });
    const cachedInventory = inventoryCache.get(cacheKey);
    if (cachedInventory) {
      return NextResponse.json(cachedInventory);
    }

    const client = new HeroSMSClient(apiKey);
    let apiPrices: PriceMap;
    try {
      const prices = await client.getPrices(undefined, countryId);
      if (!prices || typeof prices !== 'object' || Array.isArray(prices)) {
        return inventoryError(
          'UPSTREAM_INVENTORY_ERROR',
          'Inventory provider returned an invalid response.',
          502
        );
      }
      apiPrices = prices as PriceMap;
    } catch (error) {
      console.error('Fetch upstream inventory error:', error);
      return inventoryError(
        'UPSTREAM_INVENTORY_ERROR',
        'Unable to fetch inventory from provider.',
        502
      );
    }

    const inventory: any[] = [];
    const configuredServiceIds = new Set<string>();

    for (const svc of servicesConfig) {
      const serviceId = svc.id;
      configuredServiceIds.add(serviceId);
      
      let apiCost = 0;
      let apiCount = 0;
      
      if (apiPrices[countryId] && apiPrices[countryId][serviceId]) {
        apiCost = Number(apiPrices[countryId][serviceId].cost || 0);
        apiCount = Number(apiPrices[countryId][serviceId].count || 0);
      }

      const finalCost = Math.ceil(apiCost * exchangeRate);

      inventory.push({
        ...svc,
        originalCost: apiCost,
        cost: finalCost,
        count: apiCount,
        countryId,
        isPopular: true
      });
    }

    if (apiPrices[countryId]) {
      for (const [serviceId, serviceData] of Object.entries(apiPrices[countryId])) {
        if (!configuredServiceIds.has(serviceId)) {
          const apiCost = Number(serviceData.cost || 0);
          const apiCount = Number(serviceData.count || 0);
          
          if (apiCost > 0 || apiCount > 0) {
            inventory.push({
              id: serviceId,
              name: serviceId.toUpperCase(),
              originalCost: apiCost,
              cost: Math.ceil(apiCost * exchangeRate),
              count: apiCount,
              countryId,
              isPopular: false
            });
          }
        }
      }
    }

    const body: InventorySuccessBody = { success: true, inventory };
    inventoryCache.set(cacheKey, body, INVENTORY_CACHE_TTL_MS);
    return NextResponse.json(body);
  } catch (error) {
    console.error('Fetch inventory error:', error);
    return inventoryError(
      'INVENTORY_UNKNOWN_ERROR',
      'Unable to load inventory right now.',
      500
    );
  }
}
