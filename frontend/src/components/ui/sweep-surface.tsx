"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type SweepSurfaceProps = {
  as?: "button" | "span";
  variant?: "light" | "dark";
  children: React.ReactNode;
  className?: string;
  type?: React.ButtonHTMLAttributes<HTMLButtonElement>["type"];
  disabled?: boolean;
  onClick?: React.ButtonHTMLAttributes<HTMLButtonElement>["onClick"];
  ariaLabel?: string;
};

export function SweepSurface({
  as = "button",
  variant = "light",
  children,
  className,
  type = "button",
  disabled = false,
  onClick,
  ariaLabel,
}: SweepSurfaceProps) {
  const [active, setActive] = React.useState(false);

  const updatePointer = (
    event: React.PointerEvent<HTMLElement>
  ) => {
    const rect = event.currentTarget.getBoundingClientRect();

    event.currentTarget.style.setProperty(
      "--sweep-x",
      `${event.clientX - rect.left}px`
    );

    event.currentTarget.style.setProperty(
      "--sweep-y",
      `${event.clientY - rect.top}px`
    );
  };

  const handlePointerEnter = (
    event: React.PointerEvent<HTMLElement>
  ) => {
    updatePointer(event);
    setActive(true);
  };

  const contents = (
    <>
      <span className="sweep-surface__base">
        {children}
      </span>

      <span
        className="sweep-surface__reveal"
        aria-hidden="true"
      >
        <span className="sweep-surface__reveal-content">
          {children}
        </span>
      </span>
    </>
  );

  const sharedProps = {
    className: cn(
      "sweep-surface",
      variant === "dark" ? "sweep-surface--dark" : "sweep-surface--light",
      className
    ),
    "data-sweep-active": active ? "true" : "false",
    "data-sweep-element": as,
    onPointerEnter: handlePointerEnter,
    onPointerMove: updatePointer,
    onPointerLeave: () => setActive(false),
  };

  if (as === "span") {
    return (
      <span {...sharedProps} aria-label={ariaLabel}>
        {contents}
      </span>
    );
  }

  return (
    <button
      {...sharedProps}
      type={type}
      disabled={disabled}
      onClick={onClick}
      aria-label={ariaLabel}
      onFocus={() => setActive(true)}
      onBlur={() => setActive(false)}
    >
      {contents}
    </button>
  );
}

export default SweepSurface;
