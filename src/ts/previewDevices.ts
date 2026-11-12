// Device presets for the preview pane's device simulation (see Preview.vue).
// Sizes are CSS pixels, i.e. the viewport LiaScript's media queries see.

export type DeviceFrame =
  | "none"
  | "notch"
  | "android"
  | "homebutton"
  | "kaios"
  | "tablet"
  | "monitor"
  | "beamer";

export type DeviceGroup = "phones" | "tablets" | "desktop";

export interface PreviewDevice {
  id: string;
  // literal name, or an i18n key under preview.device.* when `i18n` is set
  name: string;
  i18n?: boolean;
  icon: string;
  group?: DeviceGroup;
  width: number;
  height: number;
  frame: DeviceFrame;
  rotatable: boolean;
}

export const RESPONSIVE: PreviewDevice = {
  id: "responsive",
  name: "responsive",
  i18n: true,
  icon: "bi-aspect-ratio",
  width: 0,
  height: 0,
  frame: "none",
  rotatable: false,
};

export const DEVICES: PreviewDevice[] = [
  RESPONSIVE,
  { id: "iphone", name: "iPhone 15", icon: "bi-phone", group: "phones", width: 393, height: 852, frame: "notch", rotatable: true },
  { id: "iphone-se", name: "iPhone SE", icon: "bi-phone", group: "phones", width: 375, height: 667, frame: "homebutton", rotatable: true },
  { id: "android", name: "Android", icon: "bi-phone", group: "phones", width: 412, height: 915, frame: "android", rotatable: true },
  { id: "kaios", name: "KaiOS (Nokia 2780)", icon: "bi-phone-flip", group: "phones", width: 240, height: 320, frame: "kaios", rotatable: false },
  { id: "tablet", name: "tablet", i18n: true, icon: "bi-tablet", group: "tablets", width: 820, height: 1180, frame: "tablet", rotatable: true },
  { id: "laptop", name: "laptop", i18n: true, icon: "bi-laptop", group: "desktop", width: 1366, height: 768, frame: "monitor", rotatable: false },
  { id: "fullhd", name: "fullhd", i18n: true, icon: "bi-display", group: "desktop", width: 1920, height: 1080, frame: "monitor", rotatable: false },
  { id: "ultrawide", name: "ultrawide", i18n: true, icon: "bi-display", group: "desktop", width: 3440, height: 1440, frame: "monitor", rotatable: false },
  { id: "beamer4k", name: "beamer4k", i18n: true, icon: "bi-projector", group: "desktop", width: 3840, height: 2160, frame: "beamer", rotatable: false },
];

export const DEVICE_GROUPS: DeviceGroup[] = ["phones", "tablets", "desktop"];

export function findDevice(id: string | undefined): PreviewDevice {
  return DEVICES.find((d) => d.id === id) || RESPONSIVE;
}

export type PreviewZoom = "fit" | "100";

// display scaling inside the device, like the OS setting or browser zoom
export const SCALINGS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];

export interface PreviewDeviceState {
  device: string;
  landscape: boolean;
  zoom: PreviewZoom;
  scaling: number;
}

const STORAGE_KEY = "liaeditor:previewDevice";

export function loadPreviewDevice(): PreviewDeviceState {
  const state: PreviewDeviceState = { device: RESPONSIVE.id, landscape: false, zoom: "fit", scaling: 1 };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    state.device = findDevice(saved.device).id;
    state.landscape = saved.landscape === true;
    state.zoom = saved.zoom === "100" ? "100" : "fit";
    state.scaling = SCALINGS.includes(saved.scaling) ? saved.scaling : 1;
  } catch (_) {
    // storage blocked or corrupt: fall back to the responsive preview
  }
  return state;
}

export function savePreviewDevice(state: PreviewDeviceState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (_) {
    // not persisting is fine
  }
}
