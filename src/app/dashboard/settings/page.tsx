"use client";

import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { LogOut, Plus, Save, Trash } from "lucide-react";

type ServiceConfig = {
  id: string;
  name: string;
};

type CountryConfig = {
  id: string;
  name: string;
  flag: string;
};

type ConfigResponse = {
  success: boolean;
  config?: Record<string, string>;
  hasHeroApiKey?: boolean;
  error?: string;
};

type SessionResponse = {
  success: boolean;
  configured?: boolean;
  authenticated?: boolean;
  error?: string;
  code?: string;
};

type AuthStatus = "checking" | "guest" | "authenticated";

function parseConfigArray<T>(value: string | undefined, fallback: T[]): T[] {
  if (!value) return fallback;
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as T[]) : fallback;
  } catch {
    return fallback;
  }
}

export default function SettingsPage() {
  const [authStatus, setAuthStatus] = useState<AuthStatus>("checking");
  const [adminPassword, setAdminPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [hasHeroApiKey, setHasHeroApiKey] = useState(false);
  const [exchangeRate, setExchangeRate] = useState("1");
  const [services, setServices] = useState<ServiceConfig[]>([]);
  const [countries, setCountries] = useState<CountryConfig[]>([]);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadConfig = async () => {
    setLoadingConfig(true);
    try {
      const res = await fetch("/api/system/config?admin=1");
      if (res.status === 401) {
        setAuthStatus("guest");
        toast.error("Admin session expired. Please log in again.");
        return;
      }

      const data = (await res.json()) as ConfigResponse;
      if (!data.success || !data.config) {
        toast.error(data.error || "Failed to load settings.");
        return;
      }

      setApiKey("");
      setHasHeroApiKey(Boolean(data.hasHeroApiKey));
      setExchangeRate(data.config.EXCHANGE_RATE || "1");
      setServices(parseConfigArray<ServiceConfig>(data.config.SERVICES, []));
      setCountries(parseConfigArray<CountryConfig>(data.config.COUNTRIES, []));
    } catch {
      toast.error("Failed to load settings.");
    } finally {
      setLoadingConfig(false);
    }
  };

  useEffect(() => {
    fetch("/api/admin/session")
      .then((res) => res.json())
      .then((data: SessionResponse) => {
        if (data.authenticated) {
          setAuthStatus("authenticated");
          void loadConfig();
          return;
        }
        setAuthStatus("guest");
        if (data.configured === false) {
          toast.error("ADMIN_PASSWORD is not configured on the server.");
        }
      })
      .catch(() => {
        setAuthStatus("guest");
        toast.error("Unable to check admin session.");
      });
  }, []);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoginLoading(true);
    try {
      const res = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: adminPassword }),
      });
      const data = (await res.json()) as SessionResponse;

      if (!res.ok || !data.success) {
        if (data.code === "ADMIN_PASSWORD_NOT_CONFIGURED") {
          toast.error("ADMIN_PASSWORD is not configured on the server.");
        } else if (res.status === 401) {
          toast.error("Invalid admin password.");
        } else {
          toast.error(data.error || "Login failed.");
        }
        return;
      }

      setAdminPassword("");
      setAuthStatus("authenticated");
      void loadConfig();
      toast.success("Logged in.");
    } catch {
      toast.error("Login failed.");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/admin/session", { method: "DELETE" });
    setAuthStatus("guest");
    setApiKey("");
    toast.success("Logged out.");
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/system/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([
          { key: "HERO_API_KEY", value: apiKey },
          { key: "EXCHANGE_RATE", value: exchangeRate },
          { key: "SERVICES", value: JSON.stringify(services) },
          { key: "COUNTRIES", value: JSON.stringify(countries) },
        ]),
      });
      const data = (await res.json()) as ConfigResponse;

      if (res.status === 401) {
        setAuthStatus("guest");
        toast.error("Unauthorized. Please log in again.");
        return;
      }

      if (data.success) {
        if (apiKey.trim()) {
          setHasHeroApiKey(true);
          setApiKey("");
        }
        toast.success("Settings saved.");
      } else {
        toast.error(data.error || "Save failed.");
      }
    } catch {
      toast.error("Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const addService = () => setServices([...services, { id: "", name: "" }]);
  const updateService = (index: number, field: keyof ServiceConfig, value: string) => {
    const newServices = [...services];
    newServices[index] = { ...newServices[index], [field]: value };
    setServices(newServices);
  };
  const removeService = (index: number) => {
    const newServices = [...services];
    newServices.splice(index, 1);
    setServices(newServices);
  };

  const addCountry = () => setCountries([...countries, { id: "", name: "", flag: "" }]);
  const updateCountry = (index: number, field: keyof CountryConfig, value: string) => {
    const newCountries = [...countries];
    newCountries[index] = { ...newCountries[index], [field]: value };
    setCountries(newCountries);
  };
  const removeCountry = (index: number) => {
    const newCountries = [...countries];
    newCountries.splice(index, 1);
    setCountries(newCountries);
  };

  if (authStatus === "checking") {
    return <div className="p-4 sm:p-8">Checking admin session...</div>;
  }

  if (authStatus === "guest") {
    return (
      <div className="w-full max-w-md mx-auto bg-surface min-h-screen text-on-surface flex items-center px-4 py-6 sm:p-8">
        <form
          onSubmit={handleLogin}
          className="w-full min-w-0 space-y-5 bg-surface-container-low p-4 sm:p-6 rounded-xl border border-outline-variant"
        >
          <div>
            <h1 className="text-headline-lg font-headline-lg">Admin Login</h1>
            <p className="text-body-sm text-outline mt-2">
              Enter ADMIN_PASSWORD to manage system settings.
            </p>
          </div>
          <div className="space-y-2">
            <label className="text-label-md" htmlFor="admin-password">
              Admin password
            </label>
            <input
              id="admin-password"
              type="password"
              value={adminPassword}
              onChange={(event) => setAdminPassword(event.target.value)}
              className="w-full p-2 rounded bg-surface border border-outline-variant"
              autoComplete="current-password"
            />
          </div>
          <button
            type="submit"
            disabled={loginLoading || !adminPassword}
            className="w-full bg-primary text-on-primary px-4 py-2 rounded hover:bg-primary/90 disabled:opacity-50"
          >
            {loginLoading ? "Logging in..." : "Log in"}
          </button>
        </form>
      </div>
    );
  }

  if (loadingConfig) return <div className="p-4 sm:p-8">Loading settings...</div>;

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 sm:space-y-8 bg-surface min-h-screen text-on-surface px-4 py-6 sm:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-headline-lg font-headline-lg min-w-0">System Settings</h1>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={handleLogout}
            className="border border-outline-variant px-4 py-2 rounded flex items-center justify-center gap-2 hover:bg-surface-container-low"
          >
            <LogOut className="w-4 h-4" /> Logout
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="bg-primary text-on-primary px-4 py-2 rounded flex items-center justify-center gap-2 hover:bg-primary/90 disabled:opacity-50"
          >
            <Save className="w-4 h-4" /> {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </div>

      <div className="min-w-0 space-y-4 bg-surface-container-low p-4 sm:p-6 rounded-xl border border-outline-variant">
        <h2 className="text-title-lg font-title-lg">Basic Settings</h2>
        <div className="space-y-2">
          <label className="text-label-md" htmlFor="hero-api-key">
            HeroSMS API Key
          </label>
          <input
            id="hero-api-key"
            type="password"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            className="w-full min-w-0 p-2 rounded bg-surface border border-outline-variant"
            placeholder={hasHeroApiKey ? "Already set. Leave blank to keep unchanged." : "Enter API key"}
            autoComplete="new-password"
          />
          {hasHeroApiKey && (
            <p className="text-body-sm text-outline">API key is set. Leave blank to keep it unchanged.</p>
          )}
        </div>
        <div className="space-y-2">
          <label className="text-label-md" htmlFor="exchange-rate">
            Exchange Rate
          </label>
          <input
            id="exchange-rate"
            type="number"
            step="0.001"
            value={exchangeRate}
            onChange={(event) => setExchangeRate(event.target.value)}
            className="w-full min-w-0 p-2 rounded bg-surface border border-outline-variant"
          />
          <p className="text-body-sm text-outline">Actual charge = Math.ceil(upstream price * exchange rate)</p>
        </div>
      </div>

      <div className="min-w-0 space-y-4 bg-surface-container-low p-4 sm:p-6 rounded-xl border border-outline-variant">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-title-lg font-title-lg">Country List</h2>
          <button
            type="button"
            onClick={addCountry}
            className="bg-secondary-container text-on-secondary-container px-3 py-1 rounded flex items-center justify-center gap-1 hover:bg-secondary-container/80 sm:w-auto"
          >
            <Plus className="w-4 h-4" /> Add Country
          </button>
        </div>

        <div className="space-y-3">
          {countries.map((country, index) => (
            <div
              key={index}
              className="grid grid-cols-1 gap-3 bg-surface p-3 rounded border border-outline-variant sm:grid-cols-[8rem_minmax(0,1fr)_8rem_auto] sm:items-center"
            >
              <input
                type="text"
                value={country.id}
                onChange={(event) => updateCountry(index, "id", event.target.value)}
                placeholder="Country code"
                className="w-full min-w-0 p-2 rounded bg-surface-container-lowest border border-outline-variant"
              />
              <input
                type="text"
                value={country.name}
                onChange={(event) => updateCountry(index, "name", event.target.value)}
                placeholder="Display name"
                className="w-full min-w-0 p-2 rounded bg-surface-container-lowest border border-outline-variant"
              />
              <input
                type="text"
                value={country.flag}
                onChange={(event) => updateCountry(index, "flag", event.target.value)}
                placeholder="Flag"
                className="w-full min-w-0 p-2 rounded bg-surface-container-lowest border border-outline-variant"
              />
              <button
                type="button"
                onClick={() => removeCountry(index)}
                className="p-2 text-error hover:bg-error-container rounded justify-self-start sm:justify-self-auto"
                aria-label={`Remove country ${country.name || country.id || index + 1}`}
              >
                <Trash className="w-5 h-5" />
              </button>
            </div>
          ))}
          {countries.length === 0 && (
            <p className="text-body-sm text-outline">No countries configured.</p>
          )}
        </div>
      </div>

      <div className="min-w-0 space-y-4 bg-surface-container-low p-4 sm:p-6 rounded-xl border border-outline-variant">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-title-lg font-title-lg">Service List</h2>
          <button
            type="button"
            onClick={addService}
            className="bg-secondary-container text-on-secondary-container px-3 py-1 rounded flex items-center justify-center gap-1 hover:bg-secondary-container/80 sm:w-auto"
          >
            <Plus className="w-4 h-4" /> Add Service
          </button>
        </div>

        <div className="space-y-3">
          {services.map((service, index) => (
            <div
              key={index}
              className="grid grid-cols-1 gap-3 bg-surface p-3 rounded border border-outline-variant sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-center"
            >
              <input
                type="text"
                value={service.id}
                onChange={(event) => updateService(index, "id", event.target.value)}
                placeholder="Service code"
                className="w-full min-w-0 p-2 rounded bg-surface-container-lowest border border-outline-variant"
              />
              <input
                type="text"
                value={service.name}
                onChange={(event) => updateService(index, "name", event.target.value)}
                placeholder="Display name"
                className="w-full min-w-0 p-2 rounded bg-surface-container-lowest border border-outline-variant"
              />
              <button
                type="button"
                onClick={() => removeService(index)}
                className="p-2 text-error hover:bg-error-container rounded justify-self-start sm:justify-self-auto"
                aria-label={`Remove service ${service.name || service.id || index + 1}`}
              >
                <Trash className="w-5 h-5" />
              </button>
            </div>
          ))}
          {services.length === 0 && (
            <p className="text-body-sm text-outline">No services configured.</p>
          )}
        </div>
      </div>
    </div>
  );
}
