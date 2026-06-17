import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ShieldCheck, Server, Globe2 } from "lucide-react";

export default function GeneralDashboard() {
  return (
    <main className="flex min-h-screen flex-col items-center p-4 sm:p-8 relative">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/20 via-zinc-950 to-zinc-950 -z-10" />

      <div className="w-full max-w-4xl mx-auto space-y-6 pt-8">
        <div className="flex items-center gap-2 mb-8">
          <ShieldCheck className="w-8 h-8 text-indigo-400" />
          <h1 className="text-3xl font-bold tracking-tight text-white">Echo SMS Platform</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="bg-zinc-900/50 border-white/5 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-lg text-zinc-200 flex items-center gap-2">
                <Server className="w-5 h-5 text-emerald-400" />
                System Status
              </CardTitle>
              <CardDescription>Platform operational metrics</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-zinc-400">API Status</span>
                <span className="text-emerald-400 font-medium">Online</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-zinc-400">Active Numbers</span>
                <span className="text-white font-medium">1,245</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-zinc-400">Success Rate</span>
                <span className="text-white font-medium">99.8%</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900/50 border-white/5 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-lg text-zinc-200 flex items-center gap-2">
                <Globe2 className="w-5 h-5 text-indigo-400" />
                Available Regions
              </CardTitle>
              <CardDescription>Supported countries for SMS</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {['United States (+1)', 'United Kingdom (+44)', 'Canada (+1)', 'Germany (+49)', 'France (+33)', 'Australia (+61)'].map((region) => (
                  <div key={region} className="px-3 py-1.5 rounded-md bg-white/5 border border-white/10 text-sm text-zinc-300">
                    {region}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-indigo-600/10 border-indigo-500/20 backdrop-blur-xl mt-6">
          <CardContent className="flex flex-col sm:flex-row items-center justify-between p-6 gap-4">
            <div>
              <h3 className="text-lg font-medium text-white">Ready to get a number?</h3>
              <p className="text-indigo-200/80 text-sm mt-1">Return to the homepage and enter your card secret to instantly receive a verification number.</p>
            </div>
            <a 
              href="/"
              className="inline-flex h-10 items-center justify-center rounded-md bg-indigo-600 px-8 text-sm font-medium text-white shadow transition-colors hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500"
            >
              Enter Card Secret
            </a>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
