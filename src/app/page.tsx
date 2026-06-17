"use client";

import { 
  MessageSquare, Ticket, Home, History, Code, Settings, 
  Search, Send, MessageCircle, Bot, Camera, 
  Timer, Copy, Loader, CheckCircle, X, Plus, RefreshCw, AlertCircle
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import Link from 'next/link';
import { ALL_COUNTRIES } from "@/lib/countries";

// Helper to map icon names or services to actual Lucide components
const IconMap: Record<string, any> = {
  'tg': Send,
  'wa': MessageCircle,
  'openai': Bot,
  'dr': Bot,
  'ig': Camera,
  'default': MessageSquare
};

function ActiveOrderCard({ order, updateOrder, removeOrder }: { order: any, updateOrder: (order: any) => void, removeOrder: (id: string) => void }) {
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [copied, setCopied] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (order.status === 'COMPLETED' || order.status === 'REFUNDED' || order.status === 'CANCELLED') return;

    const createdAt = new Date(order.createdAt).getTime();
    const expiry = createdAt + 15 * 60 * 1000;

    const timer = setInterval(() => {
      const now = new Date().getTime();
      const diff = Math.floor((expiry - now) / 1000);
      if (diff <= 0) {
        clearInterval(timer);
        setTimeLeft(0);
      } else {
        setTimeLeft(diff);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [order.status, order.createdAt]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("已复制!");
    setTimeout(() => setCopied(false), 2000);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleCancel = async () => {
    setCancelling(true);
    try {
      const res = await fetch(`/api/orders/${order.id}/cancel`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        toast.success("订单已取消，卡密额度已退还");
        updateOrder({ ...order, status: 'REFUNDED' });
        setTimeout(() => removeOrder(order.id), 3000);
      } else {
        toast.error(data.error || "取消失败");
      }
    } catch(e) {
      toast.error("网络错误");
    } finally {
      setCancelling(false);
    }
  };

  const handleComplete = () => {
    removeOrder(order.id);
  };

  const number = order.Number || {};
  const smsList = order.SMSLog || [];
  const ServiceIcon = IconMap[number.service] || IconMap['default'];

  if (order.status === 'REFUNDED' || order.status === 'CANCELLED') {
    return (
      <div className="bg-surface rounded-xl border border-outline-variant shadow-sm p-5 text-center text-outline">
        此订单已被取消
      </div>
    );
  }

  return (
    <div className={`bg-surface rounded-xl border border-outline-variant shadow-sm overflow-hidden transition-opacity ${order.status === 'COMPLETED' ? 'opacity-70 hover:opacity-100' : ''}`}>
      <div className="p-5 border-b border-outline-variant/30 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
            <ServiceIcon className="w-4 h-4" />
          </div>
          <div>
            <div className="text-label-md font-label-md text-on-surface">{number.service || '服务'}</div>
            <div className="text-body-sm font-body-sm text-outline">ID: #{order.id.slice(-6)}</div>
          </div>
        </div>
        
        {order.status === 'COMPLETED' ? (
          <div className="bg-[#10B981]/10 px-2 py-1 rounded text-[#10B981] font-label-sm text-label-sm border border-[#10B981]/20 flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />
            成功
          </div>
        ) : (
          <div className="bg-surface-container-low px-2 py-1 rounded text-error font-mono text-label-sm font-label-sm border border-error/20 flex items-center gap-1">
            <Timer className="w-3 h-3" />
            {formatTime(timeLeft)}
          </div>
        )}
      </div>

      <div className="p-5 space-y-5">
        <div className="bg-surface-container-low rounded-lg p-4 flex items-center justify-between border border-outline-variant/50">
          <div className="font-display text-headline-lg tracking-wider text-on-surface">{number.phone || '分配中...'}</div>
          <button 
            className="text-outline hover:text-primary transition-colors"
            onClick={() => copyToClipboard(number.phone || "")}
          >
            {copied ? <CheckCircle className="w-5 h-5 text-emerald-500" /> : <Copy className="w-5 h-5" />}
          </button>
        </div>
        
        {order.status === 'COMPLETED' ? (
           <div className="space-y-2">
            <div className="text-on-surface-variant font-label-sm text-label-sm">验证码已收到:</div>
            <div className="border-2 border-primary/30 rounded-lg p-6 flex flex-col items-center justify-center bg-primary/5 h-28 relative">
              <div className="text-primary font-display text-display tracking-widest font-mono">
                {smsList[0]?.message?.match(/\d{4,6}/)?.[0] || smsList[0]?.message || "已完成"}
              </div>
              <button 
                className="absolute right-3 top-3 text-primary hover:text-primary-container p-2 rounded-md hover:bg-primary/10 transition-colors"
                onClick={() => copyToClipboard(smsList[0]?.message || "")}
              >
                <Copy className="w-5 h-5" />
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-primary font-label-sm text-label-sm animate-pulse-soft">
              <Loader className="w-4 h-4 animate-spin" />
              正在等待短信...
            </div>
            {smsList.length > 0 ? (
               <div className="border-2 border-primary/30 rounded-lg p-6 flex flex-col items-center justify-center bg-primary/5 h-28 relative overflow-y-auto">
                 <div className="text-primary text-body-md text-center">{smsList[smsList.length - 1]?.message}</div>
               </div>
            ) : (
              <div className="border-2 border-dashed border-outline-variant rounded-lg p-6 flex flex-col items-center justify-center bg-surface-container-lowest h-28">
                <div className="text-outline text-headline-lg font-mono tracking-[0.5em] opacity-30">----</div>
                <div className="text-body-sm text-outline mt-2">收到后将在此显示</div>
              </div>
            )}
          </div>
        )}
        
        <div className="flex gap-3 pt-2">
          {order.status !== 'COMPLETED' ? (
             <button 
                onClick={handleCancel}
                disabled={cancelling}
                className="flex-1 min-h-11 px-4 py-2.5 rounded-lg border border-outline-variant text-on-surface-variant text-label-md font-label-md hover:bg-surface-container-low transition-colors shadow-sm disabled:opacity-50"
              >
                {cancelling ? '取消中...' : '取消订单 (退款)'}
              </button>
          ) : (
             <button 
                onClick={handleComplete}
                className="flex-1 min-h-11 px-4 py-2.5 rounded-lg bg-surface-container-highest text-on-surface-variant text-label-md font-label-md hover:bg-outline-variant transition-colors shadow-sm"
              >
                完成并关闭
              </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function EchoSMSPage() {
  const [globalCardSecret, setGlobalCardSecret] = useState("");
  const [activeOrders, setActiveOrders] = useState<any[]>([]);
  
  const [popularCountries, setPopularCountries] = useState<any[]>([]);
  const [tempCountry, setTempCountry] = useState<any>(null); // To store a non-popular country if selected
  const [selectedCountryId, setSelectedCountryId] = useState<string>("");
  
  const [inventory, setInventory] = useState<any[]>([]);
  const [loadingInventory, setLoadingInventory] = useState(true);
  const [inventoryError, setInventoryError] = useState<string | null>(null);

  // Modal State
  const [selectedService, setSelectedService] = useState<any>(null);
  const [modalCardSecret, setModalCardSecret] = useState("");
  const [isRedeeming, setIsRedeeming] = useState(false);
  
  // All Countries Modal
  const [showAllCountries, setShowAllCountries] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");

  useEffect(() => {
    fetch('/api/system/config')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.config) {
          try {
            const parsedCountries = JSON.parse(data.config['COUNTRIES'] || "[]");
            setPopularCountries(parsedCountries);
            if (parsedCountries.length > 0) {
              setSelectedCountryId(parsedCountries[0].id);
            } else {
              setLoadingInventory(false);
            }
          } catch(e) {
            setLoadingInventory(false);
          }
        } else {
          setLoadingInventory(false);
        }
      })
      .catch(() => setLoadingInventory(false));
  }, []);

  const fetchInventory = useCallback(async (countryId: string) => {
    if (!countryId) return;
    setLoadingInventory(true);
    setInventoryError(null);

    try {
      const res = await fetch(`/api/inventory?countryId=${countryId}`);
      const data = await res.json();

      if (data.success) {
        setInventory(Array.isArray(data.inventory) ? data.inventory : []);
      } else {
        setInventory([]);
        const fallback = data.code === 'API_KEY_MISSING'
          ? '库存接口尚未配置 API Key，请前往后台设置后再刷新。'
          : '库存暂时加载失败，请稍后重试。';
        setInventoryError(data.code === 'API_KEY_MISSING' ? fallback : data.error || fallback);
      }
    } catch {
      setInventory([]);
      setInventoryError('网络异常，无法加载库存，请稍后重试。');
    } finally {
      setLoadingInventory(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedCountryId) return;
    const timer = window.setTimeout(() => {
      fetchInventory(selectedCountryId);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [selectedCountryId, fetchInventory]);

  useEffect(() => {
    if (activeOrders.length === 0) return;

    const interval = setInterval(async () => {
      const updatedOrders = await Promise.all(activeOrders.map(async (order) => {
        if (order.status === 'COMPLETED' || order.status === 'REFUNDED' || order.status === 'CANCELLED') return order;
        
        try {
          const res = await fetch(`/api/orders/${order.id}`);
          const data = await res.json();
          if (data.success) {
            return data.order;
          }
        } catch (e) {
          console.error("Poll error", e);
        }
        return order;
      }));
      
      setActiveOrders(updatedOrders);
    }, 5000);

    return () => clearInterval(interval);
  }, [activeOrders]);

  const openConfirmModal = (svc: any) => {
    setSelectedService(svc);
    setModalCardSecret(globalCardSecret);
  };

  const closeConfirmModal = () => {
    setSelectedService(null);
    setModalCardSecret("");
  };

  const handleConfirmRedeem = async () => {
    if (!modalCardSecret.trim()) {
      toast.error("请输入有效的卡密");
      return;
    }

    if (isRedeeming) return;
    setIsRedeeming(true);

    try {
      const res = await fetch('/api/card-secret/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          code: modalCardSecret.trim(), 
          targetService: selectedService.id,
          countryId: selectedCountryId 
        })
      });
      const data = await res.json();

      if (data.success) {
        toast.success(`支付成功！已为您分配号码`);
        setActiveOrders(prev => [data.order, ...prev]);
        setGlobalCardSecret(modalCardSecret);
        closeConfirmModal();
      } else {
        toast.error(data.error || "兑换失败");
      }
    } catch (err) {
      toast.error("网络错误，请重试");
    } finally {
      setIsRedeeming(false);
    }
  };

  const updateOrder = (updatedOrder: any) => {
    setActiveOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
  };
  const removeOrder = (id: string) => {
    setActiveOrders(prev => prev.filter(o => o.id !== id));
  }

  const handleSelectAnyCountry = (id: string, name: string, flag: string) => {
    const isPopular = popularCountries.find(c => c.id === id);
    if (!isPopular) {
      setTempCountry({ id, name, flag });
    }
    setSelectedCountryId(id);
    setShowAllCountries(false);
    setCountrySearch("");
  };

  const currentDisplayCountries = [...popularCountries];
  if (tempCountry && !popularCountries.find(c => c.id === tempCountry.id)) {
    currentDisplayCountries.push(tempCountry);
  }

  let selectedCountry = currentDisplayCountries.find(c => c.id === selectedCountryId);
  if (!selectedCountry && ALL_COUNTRIES[selectedCountryId]) {
    selectedCountry = { id: selectedCountryId, ...ALL_COUNTRIES[selectedCountryId] };
  }

  const hasInventory = inventory.length > 0;
  const hasAvailableInventory = inventory.some(svc => svc.count > 0 && svc.cost > 0);
  const retryInventory = () => fetchInventory(selectedCountryId);

  return (
    <div className="bg-surface text-on-surface font-body-md min-h-screen lg:h-screen flex flex-col lg:flex-row overflow-x-hidden lg:overflow-hidden">
      
      {/* Side Navigation */}
      <aside className="relative lg:fixed lg:left-0 lg:top-0 w-full lg:h-full lg:w-[260px] border-b lg:border-b-0 lg:border-r border-outline-variant bg-surface flex flex-col p-4 sm:p-6 space-y-4 lg:space-y-6 z-30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary text-on-primary flex items-center justify-center shadow-sm">
            <MessageSquare className="w-6 h-6" />
          </div>
          <span className="text-headline-lg font-headline-lg text-primary">Echo SMS</span>
        </div>
        
        <div className="bg-surface-container-low rounded-xl p-4 border border-outline-variant shadow-sm mt-2">
          <div className="text-label-sm font-label-sm text-on-surface-variant mb-2">卡密暂存区</div>
          <div className="flex flex-col gap-2">
            <input 
              className="w-full min-h-11 px-3 py-2 bg-surface rounded-lg border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary outline-none text-body-sm transition-all shadow-sm" 
              placeholder="可预先填入卡密" 
              type="text"
              value={globalCardSecret}
              onChange={(e) => setGlobalCardSecret(e.target.value)}
            />
          </div>
        </div>

        <nav className="flex-none lg:flex-1 flex flex-row lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-1 lg:pb-0">
          <a className="shrink-0 min-h-11 flex items-center gap-3 px-4 py-3 bg-secondary-container/50 text-primary font-bold rounded-lg transition-transform duration-150 active:scale-95" href="#">
            <Home className="w-5 h-5" />
            <span className="font-label-md text-label-md">接码主页</span>
          </a>
          <a className="shrink-0 min-h-11 flex items-center gap-3 px-4 py-3 text-on-surface-variant hover:text-primary hover:bg-surface-container-high transition-all rounded-lg active:scale-95 duration-150" href="#">
            <Ticket className="w-5 h-5" />
            <span className="font-label-md text-label-md">卡密兑换</span>
          </a>
          <a className="shrink-0 min-h-11 flex items-center gap-3 px-4 py-3 text-on-surface-variant hover:text-primary hover:bg-surface-container-high transition-all rounded-lg active:scale-95 duration-150" href="#">
            <History className="w-5 h-5" />
            <span className="font-label-md text-label-md">订单记录</span>
          </a>
          
          <Link href="/dashboard/settings" className="shrink-0 min-h-11 flex items-center gap-3 px-4 py-3 text-on-surface-variant hover:text-primary hover:bg-surface-container-high transition-all rounded-lg active:scale-95 duration-150 lg:mt-auto">
            <Settings className="w-5 h-5" />
            <span className="font-label-md text-label-md">后台设置</span>
          </Link>
        </nav>
      </aside>

      {/* Main Area */}
      <main className="flex-1 flex flex-col lg:flex-row min-w-0 lg:ml-[260px] lg:h-full overflow-visible lg:overflow-hidden">
        <div className="flex-1 flex flex-col min-w-0 overflow-visible lg:overflow-y-auto bg-background relative">
          
          <header className="sticky top-0 z-20 w-full bg-surface/80 backdrop-blur-md border-b border-outline-variant/30 px-4 sm:px-8 min-h-16 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-4 text-body-md font-body-md">
              <a className="text-primary border-b-2 border-primary py-5" href="#">动态服务</a>
            </div>
          </header>

          <div className="p-4 sm:p-8 max-w-5xl mx-auto w-full space-y-8 pb-8 lg:pb-32">
            
            {/* Countries selection */}
            <div className="space-y-4">
              <h2 className="text-headline-sm font-headline-sm text-on-surface flex items-center gap-2">
                国家地区
                {loadingInventory && <Loader className="w-4 h-4 animate-spin text-outline" />}
              </h2>
              {popularCountries.length === 0 && !loadingInventory ? (
                <div className="text-outline text-body-sm bg-surface-container p-4 rounded-xl">请前往后台配置国家列表。</div>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  {currentDisplayCountries.map(c => (
                    <button
                      key={c.id}
                      onClick={() => setSelectedCountryId(c.id)}
                      className={`min-h-11 px-4 py-2 rounded-full border transition-all flex items-center gap-2 ${
                        selectedCountryId === c.id 
                          ? 'bg-primary text-on-primary border-primary shadow-md transform scale-105' 
                          : 'bg-surface text-on-surface-variant border-outline-variant hover:border-primary hover:text-primary'
                      }`}
                    >
                      <span className="text-xl">{c.flag}</span>
                      <span className="font-label-md">{c.name}</span>
                    </button>
                  ))}
                  
                  <button
                    onClick={() => setShowAllCountries(true)}
                    className="min-h-11 px-4 py-2 rounded-full border border-dashed border-outline-variant text-outline hover:text-primary hover:border-primary transition-all flex items-center gap-2 bg-surface-container-lowest"
                  >
                    <Plus className="w-4 h-4" />
                    <span className="font-label-md">更多国家...</span>
                  </button>
                </div>
              )}
            </div>

            {/* Services for selected country */}
            {selectedCountryId && (
              <div>
                <h2 className="text-headline-sm font-headline-sm text-on-surface mb-4">
                  选择应用服务 
                  <span className="text-body-md text-outline font-normal ml-2">
                    ({selectedCountry?.flag} {selectedCountry?.name})
                  </span>
                </h2>
                
                {loadingInventory ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1,2,3].map(i => (
                      <div key={i} className="h-32 bg-surface-container-low animate-pulse rounded-2xl border border-outline-variant/50"></div>
                    ))}
                  </div>
                ) : inventoryError ? (
                  <div className="border border-error/30 bg-error-container/20 p-6 sm:p-8 text-center rounded-xl">
                    <AlertCircle className="w-10 h-10 text-error mx-auto mb-3" />
                    <div className="text-on-surface text-headline-sm font-headline-sm mb-2">库存加载失败</div>
                    <p className="text-on-surface-variant text-body-md max-w-xl mx-auto">
                      {inventoryError} 可以前往后台设置检查接口配置，或稍后重试当前国家库存。
                    </p>
                    <button
                      onClick={retryInventory}
                      className="mt-5 inline-flex min-h-11 items-center gap-2 px-4 py-2 rounded-lg bg-primary text-on-primary text-label-md font-label-md hover:bg-primary/90 transition-colors shadow-sm"
                    >
                      <RefreshCw className="w-4 h-4" />
                      重新加载
                    </button>
                  </div>
                ) : !hasInventory ? (
                  <div className="text-center border border-dashed border-outline p-6 sm:p-8 rounded-xl bg-surface-container-lowest">
                    <div className="text-on-surface text-headline-sm font-headline-sm mb-2">暂无服务配置</div>
                    <p className="text-outline text-body-md max-w-xl mx-auto">
                      当前国家还没有可展示的接码服务，请前往后台设置服务列表，或切换其他国家后刷新。
                    </p>
                    <button
                      onClick={retryInventory}
                      className="mt-5 inline-flex min-h-11 items-center gap-2 px-4 py-2 rounded-lg border border-outline-variant text-on-surface-variant hover:text-primary hover:border-primary transition-colors"
                    >
                      <RefreshCw className="w-4 h-4" />
                      刷新库存
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {!hasAvailableInventory && (
                      <div className="border border-dashed border-outline-variant bg-surface-container-lowest p-5 rounded-xl">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                          <div>
                            <div className="text-on-surface text-headline-sm font-headline-sm mb-1">当前国家暂无可用库存/报价</div>
                            <p className="text-outline text-body-md">
                              下方服务仅作参考展示，库存为 0 或暂无报价时暂不能下单。请稍后刷新，或选择其他国家。
                            </p>
                          </div>
                          <button
                            onClick={retryInventory}
                            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 px-4 py-2 rounded-lg border border-outline-variant text-on-surface-variant hover:text-primary hover:border-primary transition-colors"
                          >
                            <RefreshCw className="w-4 h-4" />
                            刷新库存
                          </button>
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {inventory.filter(svc => svc.isPopular !== false).map(svc => {
                        const SvcIcon = IconMap[svc.id] || IconMap['default'];
                        const hasQuote = svc.cost > 0;
                        const isUnavailable = svc.count <= 0 || !hasQuote;
                        
                        return (
                          <div 
                            key={svc.id}
                            className={`group bg-surface rounded-2xl border border-outline-variant p-5 transition-all duration-300 flex flex-col justify-between ${
                              isUnavailable ? 'opacity-60 grayscale' : 'hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] hover:-translate-y-1 cursor-pointer'
                            }`}
                            onClick={() => !isUnavailable && openConfirmModal(svc)}
                          >
                            <div className="flex items-start justify-between mb-4">
                              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                                <SvcIcon className="w-6 h-6" />
                              </div>
                              <div className={`px-2.5 py-1 rounded-md text-label-sm font-label-sm border ${!isUnavailable ? 'bg-surface-container-low text-primary border-primary/20' : 'bg-error-container text-error border-error/20'}`}>
                                库存: {svc.count}
                              </div>
                            </div>
                            <div>
                              <h3 className="text-headline-sm font-headline-sm text-on-surface mb-1">{svc.name}</h3>
                              <div className="flex items-end justify-between gap-3">
                                <span className={`whitespace-nowrap font-headline-md ${hasQuote ? 'text-headline-md text-primary' : 'text-body-md text-outline'}`}>
                                  {hasQuote ? (
                                    <>
                                      ¥{svc.cost}
                                      <span className="text-body-sm text-outline font-normal">/次</span>
                                    </>
                                  ) : (
                                    '暂无报价'
                                  )}
                                </span>
                                <button 
                                  className="min-h-11 sm:min-h-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 bg-primary text-on-primary px-4 py-2 sm:py-1.5 rounded-lg text-label-sm font-label-sm transition-opacity duration-300 shadow-sm disabled:bg-surface-container-highest disabled:text-outline disabled:shadow-none"
                                  disabled={isUnavailable}
                                >
                                  {isUnavailable ? '不可用' : '选择'}
                                </button>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {inventory.some(svc => svc.isPopular === false) && (
                      <div className="mt-8 pt-6 border-t border-outline-variant/30">
                        <h3 className="text-title-md font-bold mb-4 text-outline flex items-center gap-2">
                          更多服务
                          <span className="text-label-sm font-normal bg-surface-container-low px-2 py-0.5 rounded-md">
                            {inventory.filter(svc => svc.isPopular === false).length}
                          </span>
                        </h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                          {inventory.filter(svc => svc.isPopular === false).map(svc => {
                            const SvcIcon = IconMap[svc.id] || IconMap['default'];
                            const hasQuote = svc.cost > 0;
                            const isUnavailable = svc.count <= 0 || !hasQuote;
                            
                            return (
                              <div 
                                key={svc.id}
                                className={`group bg-surface rounded-xl border border-outline-variant p-3 transition-all duration-300 flex flex-col justify-between ${
                                  isUnavailable ? 'opacity-60 grayscale' : 'hover:border-primary hover:shadow-sm cursor-pointer hover:-translate-y-0.5'
                                }`}
                                onClick={() => !isUnavailable && openConfirmModal(svc)}
                              >
                                <div className="flex items-center gap-2 mb-2">
                                  <div className="w-8 h-8 shrink-0 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                                    <SvcIcon className="w-4 h-4" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <h4 className="text-label-md font-bold text-on-surface truncate" title={svc.name}>{svc.name}</h4>
                                    <div className={`text-[10px] leading-tight ${!isUnavailable ? 'text-primary' : 'text-error'}`}>
                                      库存 {svc.count}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center justify-between mt-auto pt-1">
                                  <span className={`text-label-md font-bold ${hasQuote ? 'text-primary' : 'text-outline'}`}>
                                    {hasQuote ? `¥${svc.cost}` : '-'}
                                  </span>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar - Active Orders */}
        <aside className="w-full lg:w-[380px] bg-surface border-t lg:border-t-0 lg:border-l border-outline-variant flex flex-col shadow-[-4px_0_24px_rgba(0,0,0,0.02)] z-20 shrink-0">
          <div className="p-6 border-b border-outline-variant/50 flex items-center justify-between bg-surface-container-lowest">
            <h2 className="text-headline-md font-headline-md text-on-surface">当前活动订单</h2>
            <div className="bg-primary/10 text-primary w-8 h-8 rounded-full flex items-center justify-center text-label-sm font-label-sm">
              {activeOrders.length}
            </div>
          </div>
          
          <div className="lg:flex-1 lg:overflow-y-auto p-4 sm:p-6 space-y-6 bg-background/50">
            {activeOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center min-h-40 lg:h-full text-outline/50 space-y-4">
                <Code className="w-12 h-12" />
                <p>暂无活动订单，请在左侧下单</p>
              </div>
            ) : (
              activeOrders.map(order => (
                <ActiveOrderCard 
                  key={order.id} 
                  order={order} 
                  updateOrder={updateOrder} 
                  removeOrder={removeOrder} 
                />
              ))
            )}
          </div>
        </aside>

        {/* Modal Overlay for Payment Confirmation */}
        {selectedService && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-surface rounded-2xl w-full max-w-md shadow-2xl border border-outline-variant overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="p-6 border-b border-outline-variant/50 flex items-center justify-between bg-surface-container-lowest">
                <h3 className="text-headline-sm font-headline-sm text-on-surface">支付确认</h3>
                <button onClick={closeConfirmModal} className="text-outline hover:text-on-surface-variant transition-colors p-1 rounded-md hover:bg-surface-container-highest">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-6 space-y-6">
                
                <div className="bg-surface-container-low p-4 rounded-xl space-y-3 border border-outline-variant/50">
                  <div className="flex justify-between items-center text-body-md text-on-surface-variant">
                    <span>接码服务</span>
                    <span className="font-medium text-on-surface">{selectedService.name}</span>
                  </div>
                  <div className="flex justify-between items-center text-body-md text-on-surface-variant">
                    <span>国家/地区</span>
                    <span className="font-medium text-on-surface flex items-center gap-1">
                      {selectedCountry?.flag} {selectedCountry?.name}
                    </span>
                  </div>
                  <div className="pt-3 mt-3 border-t border-outline-variant/50 flex justify-between items-center">
                    <span className="text-body-lg text-on-surface-variant">扣费金额</span>
                    <span className="text-headline-md font-headline-md text-primary">¥{selectedService.cost}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-label-md text-on-surface-variant">请验证卡密</label>
                  <input 
                    type="text"
                    value={modalCardSecret}
                    onChange={e => setModalCardSecret(e.target.value)}
                    placeholder="请输入卡密"
                    className="w-full px-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-xl focus:border-primary focus:ring-1 focus:ring-primary outline-none text-body-lg"
                    disabled={isRedeeming}
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button 
                    onClick={closeConfirmModal}
                    className="flex-1 px-4 py-3 rounded-xl border border-outline-variant text-on-surface text-label-lg font-label-lg hover:bg-surface-container-low transition-colors"
                  >
                    取消
                  </button>
                  <button 
                    onClick={handleConfirmRedeem}
                    disabled={isRedeeming || !modalCardSecret.trim()}
                    className="flex-1 px-4 py-3 rounded-xl bg-primary text-on-primary text-label-lg font-label-lg hover:bg-primary/90 transition-colors shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isRedeeming ? <Loader className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                    确认并支付
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* All Countries Modal */}
        {showAllCountries && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200 p-4">
            <div className="bg-surface rounded-2xl w-full max-w-2xl max-h-[85vh] shadow-2xl border border-outline-variant flex flex-col animate-in zoom-in-95 duration-200">
              <div className="p-6 border-b border-outline-variant/50 flex items-center justify-between bg-surface-container-lowest">
                <h3 className="text-headline-sm font-headline-sm text-on-surface">选择全部国家</h3>
                <button onClick={() => setShowAllCountries(false)} className="text-outline hover:text-on-surface-variant transition-colors p-1 rounded-md hover:bg-surface-container-highest">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-4 border-b border-outline-variant/50">
                <div className="relative">
                  <Search className="w-5 h-5 text-outline absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="搜索国家名称..."
                    value={countrySearch}
                    onChange={(e) => setCountrySearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-xl focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                  />
                </div>
              </div>
              <div className="p-4 overflow-y-auto flex-1 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {Object.entries(ALL_COUNTRIES)
                  .filter(([id, data]) => data.name.includes(countrySearch))
                  .map(([id, data]) => (
                    <button
                      key={id}
                      onClick={() => handleSelectAnyCountry(id, data.name, data.flag)}
                      className="p-3 border border-outline-variant rounded-xl flex items-center gap-3 hover:border-primary hover:bg-primary/5 transition-colors text-left"
                    >
                      <span className="text-2xl">{data.flag}</span>
                      <span className="font-label-md text-on-surface line-clamp-1" title={data.name}>{data.name}</span>
                    </button>
                  ))}
                {Object.entries(ALL_COUNTRIES).filter(([id, data]) => data.name.includes(countrySearch)).length === 0 && (
                  <div className="col-span-full py-8 text-center text-outline">
                    未搜索到匹配的国家
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </main>
      
      <style dangerouslySetInnerHTML={{__html: `
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes pulse-soft { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }
        .animate-pulse-soft { animation: pulse-soft 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
      `}} />
    </div>
  );
}
