import * as echarts from "echarts/core";
import { BarChart, LineChart, MapChart } from "echarts/charts";
import {
  AriaComponent,
  DataZoomComponent,
  GridComponent,
  TooltipComponent,
  VisualMapComponent,
} from "echarts/components";
import { SVGRenderer } from "echarts/renderers";

echarts.use([
  BarChart,
  LineChart,
  MapChart,
  AriaComponent,
  DataZoomComponent,
  GridComponent,
  TooltipComponent,
  VisualMapComponent,
  SVGRenderer,
]);

export const init = echarts.init;
export const registerMap = echarts.registerMap;
export type Chart = echarts.EChartsType;
