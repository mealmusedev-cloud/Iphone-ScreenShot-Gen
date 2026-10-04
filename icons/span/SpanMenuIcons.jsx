/**
 * Span · menu icon set (Store, Versus, Create, Arcade)
 *
 * One shared 96×96 canvas, a pale circular tint well (r44 @ 14%), 7-unit
 * rounded strokes and flat Porcelain colors. Every icon is rendered through
 * the same <SpanIcon> frame so canvas, padding, well and scale stay identical.
 *
 * Usage:
 *   <StoreIcon size={24} />
 *   <VersusIcon size={24} well={false} />
 *   <SpanIconSheet size={96} gap={64} />
 */
import React from "react";

export const PORCELAIN = Object.freeze({
  ink: "#202124",
  blue: "#3973E6",
  deepBlue: "#2859B8",
  yellow: "#FFC14A",
  coral: "#E5655B",
});

const CANVAS = 96;
const WELL_RADIUS = 44;
const WELL_OPACITY = 0.14;
const STROKE = 7;

/** Shared frame: fixed canvas, optional tint well, consistent a11y wiring. */
export function SpanIcon({
  size = 24,
  tint,
  well = true,
  title,
  className,
  style,
  children,
  ...rest
}) {
  const labelled = Boolean(title);
  return (
    <svg
      viewBox={`0 0 ${CANVAS} ${CANVAS}`}
      width={size}
      height={size}
      className={className}
      style={{ display: "inline-block", flexShrink: 0, ...style }}
      role={labelled ? "img" : undefined}
      aria-label={labelled ? title : undefined}
      aria-hidden={labelled ? undefined : true}
      focusable="false"
      {...rest}
    >
      {well && (
        <circle
          cx={CANVAS / 2}
          cy={CANVAS / 2}
          r={WELL_RADIUS}
          fill={tint}
          fillOpacity={WELL_OPACITY}
        />
      )}
      {children}
    </svg>
  );
}

/** Store: rounded paint palette, three wells, one thumb opening. */
export function StoreIcon({ title = "Store", ...props }) {
  return (
    <SpanIcon tint={PORCELAIN.blue} title={title} {...props}>
      <path
        d="M70.9 55.3A24 24 0 1 0 55.3 70.9A11 11 0 0 1 70.9 55.3Z"
        fill="none"
        stroke={PORCELAIN.blue}
        strokeWidth={STROKE}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx="38" cy="41" r="5.5" fill={PORCELAIN.deepBlue} />
      <circle cx="51" cy="35.5" r="5.5" fill={PORCELAIN.deepBlue} />
      <circle cx="37" cy="55" r="5.5" fill={PORCELAIN.deepBlue} />
    </SpanIcon>
  );
}

/** Versus: two mirrored player silhouettes with a centered spark. */
export function VersusIcon({ title = "Versus", ...props }) {
  return (
    <SpanIcon tint={PORCELAIN.coral} title={title} {...props}>
      <g fill={PORCELAIN.coral}>
        <circle cx="29" cy="37.5" r="7" />
        <path d="M17 68V60A12 12 0 0 1 41 60V68A2.5 2.5 0 0 1 38.5 70.5H19.5A2.5 2.5 0 0 1 17 68Z" />
        <circle cx="67" cy="37.5" r="7" />
        <path d="M55 68V60A12 12 0 0 1 79 60V68A2.5 2.5 0 0 1 76.5 70.5H57.5A2.5 2.5 0 0 1 55 68Z" />
      </g>
      <path
        d="M48 40Q48.6 47.4 56 48Q48.6 48.6 48 56Q47.4 48.6 40 48Q47.4 47.4 48 40Z"
        fill={PORCELAIN.yellow}
      />
    </SpanIcon>
  );
}

/** Create: rounded-square board outline with a pencil crossing its lower-right edge. */
export function CreateIcon({ title = "Create", ...props }) {
  return (
    <SpanIcon tint={PORCELAIN.blue} title={title} {...props}>
      <path
        d="M66 50.9V31A9 9 0 0 0 57 22H37A9 9 0 0 0 28 31V51A9 9 0 0 0 37 60"
        fill="none"
        stroke={PORCELAIN.blue}
        strokeWidth={STROKE}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path
        transform="translate(44 48) rotate(45)"
        d="M0 0L10 -5.5H33Q38 -5.5 38 0Q38 5.5 33 5.5H10Z"
        fill={PORCELAIN.deepBlue}
        stroke={PORCELAIN.deepBlue}
        strokeWidth={3}
        strokeLinejoin="round"
      />
    </SpanIcon>
  );
}

/** Arcade: single forward-leaning lightning bolt. */
export function ArcadeIcon({ title = "Arcade", ...props }) {
  return (
    <SpanIcon tint={PORCELAIN.yellow} title={title} {...props}>
      <path
        d="M55 21L31 53H46L41 75L65 43H50Z"
        fill={PORCELAIN.yellow}
        stroke={PORCELAIN.yellow}
        strokeWidth={4}
        strokeLinejoin="round"
      />
    </SpanIcon>
  );
}

export const SPAN_MENU_ICONS = Object.freeze([
  { key: "store", label: "Store", Icon: StoreIcon },
  { key: "versus", label: "Versus", Icon: VersusIcon },
  { key: "create", label: "Create", Icon: CreateIcon },
  { key: "arcade", label: "Arcade", Icon: ArcadeIcon },
]);

/** 2×2 presentation grid with generous, uniform separation. */
export function SpanIconSheet({ size = 96, gap = 64, style, ...rest }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(2, ${size}px)`,
        gap,
        padding: gap / 2,
        width: "max-content",
        ...style,
      }}
      {...rest}
    >
      {SPAN_MENU_ICONS.map(({ key, Icon }) => (
        <Icon key={key} size={size} />
      ))}
    </div>
  );
}

export default SPAN_MENU_ICONS;
