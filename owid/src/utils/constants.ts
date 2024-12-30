import { environment, Icon } from "@raycast/api";
import { ChartType } from "./types";
import { join } from "path";

export const BROWSER_PATH = "/Applications/Google Chrome.app";
export const BROWSER_NAME = "Google Chrome";

export const ARC_PATH = "/Applications/Arc.app";

export const CHARTS_STORAGE_PATH = join(environment.supportPath, "charts.json");

export const CHART_TYPES = [
  "LineChart",
  "ScatterPlot",
  "DiscreteBar",
  "StackedDiscreteBar",
  "StackedBar",
  "StackedArea",
  "SlopeChart",
  "Marimekko",
] as const;

export const CHART_TYPE_DATA: Record<
  ChartType | "WorldMap",
  { name: string; icon: Icon }
> = {
  LineChart: { name: "Line Chart", icon: Icon.LineChart },
  ScatterPlot: { name: "Scatter Plot", icon: Icon.LineChart },
  StackedArea: { name: "Stacked Area Chart", icon: Icon.BarChart },
  StackedBar: { name: "Stacked Bar Chart", icon: Icon.BarChart },
  DiscreteBar: { name: "Discrete Bar Chart", icon: Icon.BarChart },
  SlopeChart: { name: "Slope Chart", icon: Icon.LineChart },
  StackedDiscreteBar: {
    name: "Stacked Discrete Bar Chart",
    icon: Icon.BarChart,
  },
  Marimekko: { name: "Marimekko Chart", icon: Icon.BarChart },
  WorldMap: { name: "World Map", icon: Icon.Globe },
};
