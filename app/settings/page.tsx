"use client";

import { usePreferencesStore } from "@/lib/store/usePreferencesStore";
import { Slider } from "@/components/ui/slider";
import { Select, SelectItem, SelectTrigger, SelectValue, SelectContent } from "@/components/ui/select";

export default function SettingsPage() {
  const {
    appFontScale,
    chatFontScale,
    sidebarFontScale,
    headerFontScale,
    fontMode,
    density,

    setAppFontScale,
    setChatFontScale,
    setSidebarFontScale,
    setHeaderFontScale,
    setFontMode,
    setDensity,
  } = usePreferencesStore();

  return (
    <div className="p-6 space-y-8 max-w-xl mx-auto">
      <h2 className="text-3xl font-bold mb-2">Appearance Settings</h2>

      {/* FONT FAMILY */}
      <div>
        <label className="font-semibold">Font Style</label>
        <Select value={fontMode} onValueChange={setFontMode}>
          <SelectTrigger className="mt-2">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default">Default</SelectItem>
            <SelectItem value="modern">Modern</SelectItem>
            <SelectItem value="rounded">Rounded</SelectItem>
            <SelectItem value="mono">Monospace</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* LAYOUT */}
      <div>
        <label className="font-semibold">Layout Density</label>
        <Select value={density} onValueChange={setDensity}>
          <SelectTrigger className="mt-2">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="compact">Compact</SelectItem>
            <SelectItem value="comfortable">Comfortable</SelectItem>
            <SelectItem value="spacious">Spacious</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* TYPOGRAPHY */}
      <div className="space-y-6">
        <div>
          <label className="font-semibold">App Font Size</label>
          <Slider value={[appFontScale]} min={0.8} max={1.4} step={0.05}
            onValueChange={([v]) => setAppFontScale(v)} />
        </div>

        <div>
          <label className="font-semibold">Chat Messages</label>
          <Slider value={[chatFontScale]} min={0.8} max={1.4} step={0.05}
            onValueChange={([v]) => setChatFontScale(v)} />
        </div>

        <div>
          <label className="font-semibold">Sidebar</label>
          <Slider value={[sidebarFontScale]} min={0.8} max={1.4} step={0.05}
            onValueChange={([v]) => setSidebarFontScale(v)} />
        </div>

        <div>
          <label className="font-semibold">Header</label>
          <Slider value={[headerFontScale]} min={0.8} max={1.4} step={0.05}
            onValueChange={([v]) => setHeaderFontScale(v)} />
        </div>
      </div>
    </div>
  );
}
