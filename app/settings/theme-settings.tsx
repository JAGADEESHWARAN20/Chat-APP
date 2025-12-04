// // components/settings/theme-settings.tsx
// "use client";

// import React, { useState } from 'react';
// import { useTheme } from '@/lib/hooks/use-theme';
// import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
// import { Label } from '@/components/ui/label';
// import { Input } from '@/components/ui/input';
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
// import { Switch } from '@/components/ui/switch';
// import { Button } from '@/components/ui/button';
// import { Separator } from '@/components/ui/separator';
// import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
// import { Slider } from '@/components/ui/slider';

// export function ThemeSettings() {
//   const theme = useTheme();
//   const [activeTab, setActiveTab] = useState('general');
  
//   // Local state for editing values
//   const [editingSpacing, setEditingSpacing] = useState<Record<string, string>>({});
//   const [editingFontSizes, setEditingFontSizes] = useState<Record<string, string>>({});
  
//   const handleSpacingChange = (scale: string, value: string) => {
//     setEditingSpacing(prev => ({ ...prev, [scale]: value }));
//   };
  
//   const handleFontSizeChange = (scale: string, value: string) => {
//     setEditingFontSizes(prev => ({ ...prev, [scale]: value }));
//   };
  
//   const saveSpacing = (scale: string) => {
//     const value = editingSpacing[scale];
//     if (value) {
//       theme.updateSpacing(scale as any, value);
//     }
//   };
  
//   const saveFontSize = (scale: string) => {
//     const value = editingFontSizes[scale];
//     if (value) {
//       theme.updateFontSize(scale as any, value);
//     }
//   };
  
//   return (
//     <div className="container mx-auto py-6 space-y-6">
//       <div>
//         <h1 className="text-3xl font-bold">Theme Settings</h1>
//         <p className="text-muted-foreground">
//           Customize spacing, typography, and layout for all devices
//         </p>
//       </div>
      
//       <Tabs value={activeTab} onValueChange={setActiveTab}>
//         <TabsList className="grid grid-cols-4 w-full">
//           <TabsTrigger value="general">General</TabsTrigger>
//           <TabsTrigger value="spacing">Spacing</TabsTrigger>
//           <TabsTrigger value="typography">Typography</TabsTrigger>
//           <TabsTrigger value="layout">Layout</TabsTrigger>
//         </TabsList>
        
//         {/* GENERAL SETTINGS */}
//         <TabsContent value="general" className="space-y-4">
//           <Card>
//             <CardHeader>
//               <CardTitle>Appearance</CardTitle>
//               <CardDescription>Customize the overall look and feel</CardDescription>
//             </CardHeader>
//             <CardContent className="space-y-4">
//               <div className="space-y-2">
//                 <Label>Theme Mode</Label>
//                 <Select value={theme.mode} onValueChange={theme.setMode}>
//                   <SelectTrigger>
//                     <SelectValue />
//                   </SelectTrigger>
//                   <SelectContent>
//                     <SelectItem value="light">Light</SelectItem>
//                     <SelectItem value="dark">Dark</SelectItem>
//                     <SelectItem value="system">System</SelectItem>
//                   </SelectContent>
//                 </Select>
//               </div>
              
//               <div className="space-y-2">
//                 <Label>Density</Label>
//                 <Select value={theme.density} onValueChange={theme.setDensity}>
//                   <SelectTrigger>
//                     <SelectValue />
//                   </SelectTrigger>
//                   <SelectContent>
//                     <SelectItem value="compact">Compact</SelectItem>
//                     <SelectItem value="normal">Normal</SelectItem>
//                     <SelectItem value="comfortable">Comfortable</SelectItem>
//                   </SelectContent>
//                 </Select>
//                 <p className="text-sm text-muted-foreground">
//                   {theme.density === 'compact' && 'Tighter spacing for more content'}
//                   {theme.density === 'normal' && 'Balanced spacing for most users'}
//                   {theme.density === 'comfortable' && 'More spacious for better readability'}
//                 </p>
//               </div>
              
//               <div className="space-y-2">
//                 <Label>Font Family</Label>
//                 <Select value={theme.fontFamily} onValueChange={theme.setFontFamily}>
//                   <SelectTrigger>
//                     <SelectValue />
//                   </SelectTrigger>
//                   <SelectContent>
//                     <SelectItem value="system-ui, sans-serif">System UI</SelectItem>
//                     <SelectItem value="Inter, sans-serif">Inter</SelectItem>
//                     <SelectItem value="Roboto, sans-serif">Roboto</SelectItem>
//                     <SelectItem value="Helvetica, Arial, sans-serif">Helvetica</SelectItem>
//                   </SelectContent>
//                 </Select>
//               </div>
              
//               <div className="flex items-center justify-between">
//                 <div className="space-y-0.5">
//                   <Label>Device Detection</Label>
//                   <p className="text-sm text-muted-foreground">
//                     Current: {theme.deviceType.toUpperCase()}
//                   </p>
//                 </div>
//                 <Button variant="outline" size="sm" onClick={theme.detectDeviceType}>
//                   Re-detect
//                 </Button>
//               </div>
//             </CardContent>
//           </Card>
          
//           <Card>
//             <CardHeader>
//               <CardTitle>Preview</CardTitle>
//               <CardDescription>See how your changes look</CardDescription>
//             </CardHeader>
//             <CardContent>
//               <div className="border rounded-lg p-4 space-y-4" style={{ fontFamily: theme.fontFamily }}>
//                 <div className="flex items-center gap-4">
//                   <div 
//                     className="rounded-md bg-primary text-primary-foreground flex items-center justify-center"
//                     style={{ 
//                       width: theme.avatarSize('md'),
//                       height: theme.avatarSize('md'),
//                       borderRadius: theme.radius('md')
//                     }}
//                   >
//                     A
//                   </div>
//                   <div>
//                     <div style={{ fontSize: theme.fontSize('base') }} className="font-semibold">
//                       Avatar Preview
//                     </div>
//                     <div style={{ fontSize: theme.fontSize('sm') }} className="text-muted-foreground">
//                       Size: {theme.avatarSize('md')}
//                     </div>
//                   </div>
//                 </div>
                
//                 <div className="space-y-2">
//                   <div style={{ fontSize: theme.fontSize('lg') }} className="font-bold">
//                     Heading Text
//                   </div>
//                   <div style={{ fontSize: theme.fontSize('base') }}>
//                     Body text with normal spacing and line height.
//                   </div>
//                   <div style={{ fontSize: theme.fontSize('sm') }} className="text-muted-foreground">
//                     Small caption or helper text
//                   </div>
//                 </div>
                
//                 <div className="flex gap-2">
//                   <button 
//                     className="px-4 py-2 rounded-md bg-primary text-primary-foreground font-medium"
//                     style={{ 
//                       height: theme.buttonHeight('md'),
//                       paddingLeft: theme.components.button.paddingX.md,
//                       paddingRight: theme.components.button.paddingX.md,
//                       borderRadius: theme.radius('md')
//                     }}
//                   >
//                     Button
//                   </button>
//                   <input 
//                     type="text" 
//                     placeholder="Input field"
//                     className="border px-3 rounded-md"
//                     style={{ 
//                       height: theme.components.input.heights.md,
//                       borderRadius: theme.radius('md')
//                     }}
//                   />
//                 </div>
//               </div>
//             </CardContent>
//           </Card>
//         </TabsContent>
        
//         {/* SPACING SETTINGS */}
//         <TabsContent value="spacing" className="space-y-4">
//           <Card>
//             <CardHeader>
//               <CardTitle>Spacing Scale</CardTitle>
//               <CardDescription>Control padding, margin, and gaps throughout the app</CardDescription>
//             </CardHeader>
//             <CardContent className="space-y-6">
//               {Object.entries(theme.spacing).map(([scale, value]) => (
//                 <div key={scale} className="space-y-2">
//                   <div className="flex items-center justify-between">
//                     <Label className="font-mono">{scale}</Label>
//                     <span className="text-sm text-muted-foreground">{value}</span>
//                   </div>
//                   <div className="flex gap-2">
//                     <Input
//                       value={editingSpacing[scale] || value}
//                       onChange={(e) => handleSpacingChange(scale, e.target.value)}
//                       className="flex-1"
//                     />
//                     <Button 
//                       variant="outline" 
//                       size="sm"
//                       onClick={() => saveSpacing(scale)}
//                       disabled={!editingSpacing[scale]}
//                     >
//                       Update
//                     </Button>
//                   </div>
//                   <div className="h-8 bg-muted rounded flex items-center px-2">
//                     <div 
//                       className="bg-primary rounded"
//                       style={{ 
//                         width: value,
//                         height: '1rem'
//                       }}
//                     />
//                     <span className="ml-2 text-xs">Preview: {value}</span>
//                   </div>
//                 </div>
//               ))}
              
//               <Separator />
              
//               <div className="space-y-2">
//                 <Label>Density Multiplier</Label>
//                 <Slider
//                   value={[
//                     theme.density === 'compact' ? 0.75 :
//                     theme.density === 'normal' ? 1 :
//                     1.25
//                   ]}
//                   onValueChange={([value]) => {
//                     if (value <= 0.8) theme.setDensity('compact');
//                     else if (value <= 1.1) theme.setDensity('normal');
//                     else theme.setDensity('comfortable');
//                   }}
//                   min={0.5}
//                   max={1.5}
//                   step={0.05}
//                   className="w-full"
//                 />
//                 <div className="flex justify-between text-sm text-muted-foreground">
//                   <span>Compact (0.75x)</span>
//                   <span>Normal (1x)</span>
//                   <span>Comfortable (1.25x)</span>
//                 </div>
//               </div>
//             </CardContent>
//           </Card>
//         </TabsContent>
        
//         {/* TYPOGRAPHY SETTINGS */}
//         <TabsContent value="typography" className="space-y-4">
//           <Card>
//             <CardHeader>
//               <CardTitle>Typography Scale</CardTitle>
//               <CardDescription>Control font sizes, weights, and line heights</CardDescription>
//             </CardHeader>
//             <CardContent className="space-y-6">
//               {Object.entries(theme.typography.fontSizes).map(([scale, value]) => (
//                 <div key={scale} className="space-y-2">
//                   <div className="flex items-center justify-between">
//                     <Label className="font-mono">{scale}</Label>
//                     <span className="text-sm text-muted-foreground">{value}</span>
//                   </div>
//                   <div className="flex gap-2">
//                     <Input
//                       value={editingFontSizes[scale] || value}
//                       onChange={(e) => handleFontSizeChange(scale, e.target.value)}
//                       className="flex-1"
//                     />
//                     <Button 
//                       variant="outline" 
//                       size="sm"
//                       onClick={() => saveFontSize(scale)}
//                       disabled={!editingFontSizes[scale]}
//                     >
//                       Update
//                     </Button>
//                   </div>
//                   <div 
//                     className="border-l-4 border-primary pl-3 py-1"
//                     style={{ fontSize: value }}
//                   >
//                     The quick brown fox jumps over the lazy dog
//                   </div>
//                 </div>
//               ))}
              
//               <Separator />
              
//               <div className="space-y-4">
//                 <div className="space-y-2">
//                   <Label>Font Weights</Label>
//                   <div className="grid grid-cols-2 gap-4">
//                     {Object.entries(theme.typography.fontWeights).map(([name, weight]) => (
//                       <div key={name} className="space-y-1">
//                         <div className="flex justify-between">
//                           <span className="text-sm capitalize">{name}</span>
//                           <span className="text-sm text-muted-foreground">{weight}</span>
//                         </div>
//                         <div 
//                           className="text-lg"
//                           style={{ fontWeight: weight }}
//                         >
//                           Aa
//                         </div>
//                       </div>
//                     ))}
//                   </div>
//                 </div>
                
//                 <div className="space-y-2">
//                   <Label>Line Heights</Label>
//                   <div className="space-y-2">
//                     {Object.entries(theme.typography.lineHeights).map(([name, height]) => (
//                       <div key={name} className="flex items-center justify-between">
//                         <span className="text-sm capitalize">{name}</span>
//                         <div className="flex items-center gap-2">
//                           <span className="text-sm text-muted-foreground">{height}</span>
//                           <div 
//                             className="w-32 h-px bg-border relative"
//                           >
//                             <div 
//                               className="absolute -top-1 left-0 w-2 h-3 bg-primary rounded-full"
//                               style={{ marginTop: `calc(${height} * 0.5rem - 0.5rem)` }}
//                             />
//                             <div 
//                               className="absolute -top-1 left-8 w-2 h-3 bg-primary rounded-full"
//                               style={{ marginTop: `calc(${height} * 0.5rem - 0.5rem)` }}
//                             />
//                           </div>
//                         </div>
//                       </div>
//                     ))}
//                   </div>
//                 </div>
//               </div>
//             </CardContent>
//           </Card>
//         </TabsContent>
        
//         {/* LAYOUT SETTINGS */}
//         <TabsContent value="layout" className="space-y-4">
//           <Card>
//             <CardHeader>
//               <CardTitle>Layout Configuration</CardTitle>
//               <CardDescription>Control component sizes and layout dimensions</CardDescription>
//             </CardHeader>
//             <CardContent className="space-y-6">
//               <div className="grid grid-cols-2 gap-4">
//                 <div className="space-y-2">
//                   <Label>Sidebar Width (Expanded)</Label>
//                   <Input
//                     value={theme.layout.sidebarWidth.expanded}
//                     onChange={(e) => theme.updateLayout('sidebarWidth', {
//                       ...theme.layout.sidebarWidth,
//                       expanded: e.target.value
//                     })}
//                   />
//                 </div>
                
//                 <div className="space-y-2">
//                   <Label>Sidebar Width (Collapsed)</Label>
//                   <Input
//                     value={theme.layout.sidebarWidth.collapsed}
//                     onChange={(e) => theme.updateLayout('sidebarWidth', {
//                       ...theme.layout.sidebarWidth,
//                       collapsed: e.target.value
//                     })}
//                   />
//                 </div>
                
//                 <div className="space-y-2">
//                   <Label>Header Height</Label>
//                   <Input
//                     value={theme.layout.headerHeight}
//                     onChange={(e) => theme.updateLayout('headerHeight', e.target.value)}
//                   />
//                 </div>
                
//                 <div className="space-y-2">
//                   <Label>Tabs Trigger Height</Label>
//                   <Input
//                     value={theme.components.tabs.triggerHeight}
//                     onChange={(e) => {
//                       // Note: You'd need to add this to the store update logic
//                     }}
//                   />
//                 </div>
//               </div>
              
//               <Separator />
              
//               <div className="space-y-4">
//                 <Label>Border Radius</Label>
//                 <div className="grid grid-cols-2 gap-4">
//                   {Object.entries(theme.layout.borderRadius).map(([scale, value]) => (
//                     <div key={scale} className="space-y-2">
//                       <div className="flex justify-between">
//                         <span className="text-sm capitalize">{scale}</span>
//                         <span className="text-sm text-muted-foreground">{value}</span>
//                       </div>
//                       <div 
//                         className="w-full h-12 border-2 border-primary flex items-center justify-center"
//                         style={{ borderRadius: value }}
//                       >
//                         <span className="text-xs">Preview</span>
//                       </div>
//                     </div>
//                   ))}
//                 </div>
//               </div>
              
//               <Separator />
              
//               <div className="space-y-4">
//                 <Label>Component Sizes</Label>
//                 <div className="grid grid-cols-3 gap-4">
//                   <div className="space-y-2">
//                     <h4 className="font-medium text-sm">Avatar</h4>
//                     {Object.entries(theme.components.avatar.sizes).map(([size, value]) => (
//                       <div key={size} className="flex items-center justify-between">
//                         <span className="text-xs capitalize">{size}</span>
//                         <span className="text-xs text-muted-foreground">{value}</span>
//                       </div>
//                     ))}
//                   </div>
                  
//                   <div className="space-y-2">
//                     <h4 className="font-medium text-sm">Button Heights</h4>
//                     {Object.entries(theme.components.button.heights).map(([size, value]) => (
//                       <div key={size} className="flex items-center justify-between">
//                         <span className="text-xs capitalize">{size}</span>
//                         <span className="text-xs text-muted-foreground">{value}</span>
//                       </div>
//                     ))}
//                   </div>
                  
//                   <div className="space-y-2">
//                     <h4 className="font-medium text-sm">Input Heights</h4>
//                     {Object.entries(theme.components.input.heights).map(([size, value]) => (
//                       <div key={size} className="flex items-center justify-between">
//                         <span className="text-xs capitalize">{size}</span>
//                         <span className="text-xs text-muted-foreground">{value}</span>
//                       </div>
//                     ))}
//                   </div>
//                 </div>
//               </div>
//             </CardContent>
//           </Card>
//         </TabsContent>
//       </Tabs>
      
//       <div className="flex justify-end gap-2">
//         <Button variant="outline" onClick={() => window.location.reload()}>
//           Reload to Apply
//         </Button>
//         <Button 
//           variant="destructive"
//           onClick={() => {
//             // Reset to defaults
//             if (confirm('Reset all theme settings to defaults?')) {
//               // You'd need to implement reset logic
//               window.location.reload();
//             }
//           }}
//         >
//           Reset to Defaults
//         </Button>
//       </div>
//     </div>
//   );
// }