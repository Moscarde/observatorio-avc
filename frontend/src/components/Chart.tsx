import { useEffect, useRef } from "react";
import * as echarts from "../lib/charts";
export function Chart({
  option,
  label,
  onClick,
  className = "",
}: {
  option: Record<string, unknown>;
  label: string;
  onClick?: (name: string) => void;
  className?: string;
}) {
  const element = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.Chart | null>(null);
  useEffect(() => {
    if (!element.current) return;
    const instance = echarts.init(element.current, undefined, {
      renderer: "svg",
    });
    chart.current = instance;
    const observer = new ResizeObserver(() => instance.resize());
    observer.observe(element.current);
    return () => {
      observer.disconnect();
      instance.dispose();
      chart.current = null;
    };
  }, []);
  useEffect(() => {
    chart.current?.setOption(
      {
        animationDuration: 350,
        textStyle: {
          fontFamily: "system-ui, Arial, sans-serif",
          color: "#5d716a",
        },
        aria: { enabled: true },
        ...option,
      },
      { notMerge: true },
    );
    chart.current?.off("click");
    if (onClick) chart.current?.on("click", (params) => onClick(params.name));
  }, [option, onClick]);
  return (
    <div
      ref={element}
      role="img"
      aria-label={label}
      className={`chart ${className}`}
    />
  );
}
export function Empty({
  message = "Nenhuma internação disponível para este recorte.",
  detail = "Experimente ajustar os filtros.",
}: {
  message?: string;
  detail?: string;
}) {
  return (
    <div className="empty" role="status">
      <span aria-hidden="true">↗</span>
      <strong>{message}</strong>
      <p>{detail}</p>
    </div>
  );
}
