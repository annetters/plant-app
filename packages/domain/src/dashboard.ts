export interface DashboardTile {
  id: string;
  label: string;
  path: string;
}

export const DASHBOARD_TILES: readonly DashboardTile[] = [
  { id: "map", label: "Map", path: "/map" },
  { id: "registry", label: "Registry", path: "/registry" },
  { id: "bloom-timeline", label: "Bloom Timeline", path: "/bloom-timeline" },
];
