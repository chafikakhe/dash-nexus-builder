import { create } from "zustand";

type Org = { id: string; name: string; plan: "Free" | "Pro" | "Enterprise" };

type AppState = {
  orgs: Org[];
  currentOrgId: string;
  setCurrentOrg: (id: string) => void;
  paletteOpen: boolean;
  setPaletteOpen: (v: boolean) => void;
};

export const useAppStore = create<AppState>((set) => ({
  orgs: [
    { id: "org_1", name: "Acme Inc.", plan: "Pro" },
    { id: "org_2", name: "Northwind Labs", plan: "Free" },
    { id: "org_3", name: "Globex Corp", plan: "Enterprise" },
  ],
  currentOrgId: "org_1",
  setCurrentOrg: (id) => set({ currentOrgId: id }),
  paletteOpen: false,
  setPaletteOpen: (v) => set({ paletteOpen: v }),
}));
