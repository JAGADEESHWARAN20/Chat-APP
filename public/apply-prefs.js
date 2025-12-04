// (() => {
//     try {
//       const item = localStorage.getItem("flychat-preferences-v7");
//       if (!item) return;
//       const state = JSON.parse(item).state;
//       if (!state) return;
//       const r = document.documentElement;
//       Object.entries(state).forEach(([k, v]) => {
//         if (k === "sidebarWidth" || k === "borderRadius" || k === "glassBlur" || k === "spacingUnit") {
//           r.style.setProperty(`--${k}`, `${v}px`);
//         } else if (k !== "set" && k !== "reset") {
//           r.style.setProperty(`--${k}`, String(v));
//         }
//       });
//       r.dataset.fontMode = state.fontMode;
//       r.dataset.density = state.density;
//       if (state.reduceMotion) r.dataset.reducedMotion = "true";
//     } catch (e) {}
//   })();