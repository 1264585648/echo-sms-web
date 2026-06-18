"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Clock, Smartphone, Copy, CheckCircle2, AlertCircle } from "lucide-react";

export default function DashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const orderId = resolvedParams.id;
  
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState<number>(10 * 60); // 10 minutes default
  const [copied, setCopied] = useState(false);
  const router = useRouter();

  // Poll order status
  useEffect(() => {
    if (!orderId) return;

    const fetchOrder = async () => {
      try {
        const cardSecretCode = localStorage.getItem('echo_sms_card_secret')?.trim();
        if (!cardSecretCode) {
          router.push("/");
          return;
        }

        const res = await fetch(`/api/orders/${orderId}`, {
          headers: {
            'x-card-secret-code': cardSecretCode,
          },
        });
        const data = await res.json();
        
        if (data.success && data.order) {
          setOrder(data.order);
        } else {
          toast.error("Order not found");
          router.push("/");
        }
      } catch (err) {
        console.error("Failed to fetch order", err);
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
    const interval = setInterval(fetchOrder, 3000); // Poll every 3s
    return () => clearInterval(interval);
  }, [orderId, router]);

  // Countdown timer
  useEffect(() => {
    if (order?.status === 'COMPLETED' || order?.status === 'REFUNDED') return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          // Auto-cancel or timeout logic would go here
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [order?.status]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Phone number copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  if (!order) return null;

  const number = order.Number;
  const smsList = order.SMSLog || [];

  return (
    <main className="flex min-h-screen flex-col items-center p-4 sm:p-8 relative">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/20 via-zinc-950 to-zinc-950 -z-10" />

      <div className="w-full max-w-3xl mx-auto space-y-6 pt-8">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-2">
              <MessageSquare className="w-8 h-8 text-indigo-400" />
              Echo SMS
            </h1>
            <p className="text-zinc-400 mt-1">Waiting for your verification code</p>
          </div>
          
          <Badge variant={order.status === 'COMPLETED' ? 'default' : 'secondary'} className="text-sm px-4 py-1">
            {order.status === 'COMPLETED' ? (
              <span className="flex items-center gap-2 text-emerald-400"><CheckCircle2 className="w-4 h-4" /> Completed</span>
            ) : order.status === 'REFUNDED' ? (
              <span className="flex items-center gap-2 text-red-400"><AlertCircle className="w-4 h-4" /> Refunded</span>
            ) : (
              <span className="flex items-center gap-2 text-amber-400">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                </span>
                Awaiting SMS
              </span>
            )}
          </Badge>
        </div>

        {/* Assigned Number Card */}
        <Card className="bg-zinc-900/50 border-white/5 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-lg text-zinc-200">Your Assigned Number</CardTitle>
            <CardDescription>Use this number for the `{number.service}` service.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between p-6 bg-zinc-950/50 rounded-xl border border-white/5">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-500/20 rounded-full flex items-center justify-center border border-indigo-500/30">
                  <Smartphone className="w-6 h-6 text-indigo-400" />
                </div>
                <div>
                  <div className="text-3xl font-mono font-semibold tracking-wider text-white">
                    {number.phone}
                  </div>
                  <div className="text-zinc-400 text-sm mt-1">
                    Country: {number.country}
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col gap-2 w-full sm:w-auto">
                <Button 
                  variant="outline" 
                  className="bg-zinc-900 border-zinc-700 hover:bg-zinc-800 text-white"
                  onClick={() => copyToClipboard(number.phone)}
                >
                  {copied ? <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-400" /> : <Copy className="w-4 h-4 mr-2" />}
                  {copied ? "Copied" : "Copy Number"}
                </Button>
              </div>
            </div>

            {order.status !== 'COMPLETED' && order.status !== 'REFUNDED' && (
              <div className="mt-6 flex items-center justify-center gap-2 text-zinc-400 bg-zinc-950/30 py-3 rounded-lg border border-white/5">
                <Clock className="w-5 h-5 text-indigo-400" />
                <span>Time remaining:</span>
                <span className="font-mono text-lg font-medium text-white">{formatTime(timeLeft)}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* SMS Inbox */}
        <Card className="bg-zinc-900/50 border-white/5 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-lg text-zinc-200">Incoming Messages</CardTitle>
            <CardDescription>Messages sent to your assigned number will appear here in real-time.</CardDescription>
          </CardHeader>
          <CardContent>
            {smsList.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mb-4">
                  <MessageSquare className="w-8 h-8 text-zinc-600" />
                </div>
                <h3 className="text-lg font-medium text-zinc-300">No messages yet</h3>
                <p className="text-zinc-500 max-w-sm mt-2">Waiting for the service to send an SMS. Ensure you have entered the number correctly.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {smsList.map((sms: any) => (
                  <div key={sms.id} className="p-4 rounded-xl bg-indigo-950/20 border border-indigo-500/20 transition-all hover:bg-indigo-950/30">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-indigo-300 border-indigo-500/30 bg-indigo-500/10">
                          {sms.sender}
                        </Badge>
                      </div>
                      <span className="text-xs text-zinc-500">
                        {new Date(sms.receivedAt).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-white text-lg font-medium tracking-wide">
                      {sms.message}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
