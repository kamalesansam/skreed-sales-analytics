"use client";;
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { useChart } from "./chart-context";

function XAxisLabel({
  label,
  x,
  crosshairX,
  isHovering,
  tickerHalfWidth
}) {
  const fadeBuffer = 20;
  const fadeRadius = tickerHalfWidth + fadeBuffer;

  let opacity = 1;
  if (isHovering && crosshairX !== null) {
    const distance = Math.abs(x - crosshairX);
    if (distance < tickerHalfWidth) {
      opacity = 0;
    } else if (distance < fadeRadius) {
      opacity = (distance - tickerHalfWidth) / fadeBuffer;
    }
  }

  // Zero-width container approach for perfect centering
  // The wrapper is positioned exactly at x with width:0
  // The inner span overflows and is centered via text-align
  return (
    <div
      className="absolute"
      style={{
        left: x,
        bottom: 12,
        width: 0,
        display: "flex",
        justifyContent: "center",
      }}>
      <span
        className={cn("whitespace-nowrap text-chart-label text-xs")}
        style={{
          opacity,
          transition: "opacity 0.4s ease-in-out",
        }}>
        {label}
      </span>
    </div>
  );
}

export function XAxis({
  numTicks = 5,
  tickerHalfWidth = 50,
  tickMode = "domain"
}) {
  const {
    xScale,
    margin,
    tooltipData,
    containerRef,
    data,
    xAccessor,
    dateLabels,
  } = useChart();
  const [mounted, setMounted] = useState(false);

  // Only render on client side after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  // Generate tick labels: evenly spaced along the domain, or one per data row
  const labelsToShow = useMemo(() => {
    if (tickMode === "data") {
      return data.map((d, i) => ({
        date: xAccessor(d),
        x: (xScale(xAccessor(d)) ?? 0) + margin.left,
        label:
          dateLabels[i] ??
          xAccessor(d).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          }),
      }));
    }

    const domain = xScale.domain();
    const startDate = domain[0];
    const endDate = domain[1];

    if (!(startDate && endDate)) {
      return [];
    }

    const startTime = startDate.getTime();
    const endTime = endDate.getTime();
    const timeRange = endTime - startTime;

    // Create evenly spaced dates from start to end
    const tickCount = Math.max(2, numTicks); // At least first and last
    const dates = [];

    for (let i = 0; i < tickCount; i++) {
      const t = i / (tickCount - 1); // 0 to 1
      const time = startTime + t * timeRange;
      dates.push(new Date(time));
    }

    return dates.map((date) => ({
      date,
      x: (xScale(date) ?? 0) + margin.left,
      label: date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
    }));
  }, [tickMode, data, xAccessor, xScale, margin.left, dateLabels, numTicks]);

  const isHovering = tooltipData !== null;
  const crosshairX = tooltipData ? tooltipData.x + margin.left : null;

  // Use portal to render into the chart container
  // Only render after mount on client side
  const container = containerRef.current;
  if (!(mounted && container)) {
    return null;
  }

  // Dynamic import to avoid SSR issues
  const { createPortal } = require("react-dom");

  return createPortal(<div className="pointer-events-none absolute inset-0">
    {labelsToShow.map((item) => (
      <XAxisLabel
        crosshairX={crosshairX}
        isHovering={isHovering}
        key={`${item.date.getTime()}-${item.x}`}
        label={item.label}
        tickerHalfWidth={tickerHalfWidth}
        x={item.x} />
    ))}
  </div>, container);
}

XAxis.displayName = "XAxis";

export default XAxis;
