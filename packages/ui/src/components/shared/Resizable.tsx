import { createSignal, onCleanup, onMount, Show, splitProps } from "solid-js";
import type { JSX } from "solid-js";
import type { Theme } from "../../styles/theme.js";

export interface ResizableProps {
  theme: Theme;
  direction: "horizontal" | "vertical";
  initialSize?: number;
  minSize?: number;
  maxSize?: number;
  sizeFromEnd?: boolean;
  children: [JSX.Element, JSX.Element];
  class?: string;
  onResize?: (size: number) => void;
}

const HANDLE_HIT_AREA = 8;

export function Resizable(props: ResizableProps) {
  const [local, rest] = splitProps(props, [
    "theme",
    "direction",
    "initialSize",
    "minSize",
    "maxSize",
    "sizeFromEnd",
    "children",
    "class",
    "onResize",
  ]);

  const [size, setSize] = createSignal(local.initialSize ?? 240);
  const [isDragging, setIsDragging] = createSignal(false);
  const [isHovering, setIsHovering] = createSignal(false);

  let containerRef: HTMLDivElement | undefined;

  const isHorizontal = () => local.direction === "horizontal";
  const sizeFromEnd = () => local.sizeFromEnd ?? false;

  const handleMouseDown = (e: MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging() || !containerRef) return;

    const rect = containerRef.getBoundingClientRect();
    let newSize: number;

    if (sizeFromEnd()) {
      if (isHorizontal()) {
        newSize = rect.right - e.clientX;
      } else {
        newSize = rect.bottom - e.clientY;
      }
    } else {
      if (isHorizontal()) {
        newSize = e.clientX - rect.left;
      } else {
        newSize = e.clientY - rect.top;
      }
    }

    const minSize = local.minSize ?? 100;
    const maxDimension = isHorizontal() ? rect.width : rect.height;
    const maxSize = local.maxSize ?? maxDimension - 100;

    newSize = Math.max(minSize, Math.min(maxSize, newSize));
    setSize(newSize);
    local.onResize?.(newSize);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  onMount(() => {
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  });

  onCleanup(() => {
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
  });

  const containerClasses = () => {
    const base = "flex overflow-hidden relative";
    const direction = isHorizontal() ? "flex-row" : "flex-col";
    return `${base} ${direction} ${local.class ?? ""}`;
  };

  const sizedPaneStyle = (): JSX.CSSProperties => {
    if (isHorizontal()) {
      return {
        width: `${size()}px`,
        "flex-shrink": 0,
        overflow: "hidden",
      };
    }
    return {
      height: `${size()}px`,
      "flex-shrink": 0,
      overflow: "hidden",
    };
  };

  const flexPaneStyle = (): JSX.CSSProperties => ({
    flex: 1,
    overflow: "hidden",
    "min-width": isHorizontal() ? "0" : undefined,
    "min-height": isHorizontal() ? undefined : "0",
  });

  const handleStyle = (): JSX.CSSProperties => {
    const cursor = isHorizontal() ? "col-resize" : "row-resize";
    const halfHandle = HANDLE_HIT_AREA / 2;

    if (sizeFromEnd()) {
      if (isHorizontal()) {
        return {
          position: "absolute",
          top: 0,
          bottom: 0,
          right: `${size() - halfHandle}px`,
          width: `${HANDLE_HIT_AREA}px`,
          cursor,
          "z-index": 10,
          "user-select": "none",
        };
      }
      return {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: `${size() - halfHandle}px`,
        height: `${HANDLE_HIT_AREA}px`,
        cursor,
        "z-index": 10,
        "user-select": "none",
      };
    }

    if (isHorizontal()) {
      return {
        position: "absolute",
        top: 0,
        bottom: 0,
        left: `${size() - halfHandle}px`,
        width: `${HANDLE_HIT_AREA}px`,
        cursor,
        "z-index": 10,
        "user-select": "none",
      };
    }
    return {
      position: "absolute",
      left: 0,
      right: 0,
      top: `${size() - halfHandle}px`,
      height: `${HANDLE_HIT_AREA}px`,
      cursor,
      "z-index": 10,
      "user-select": "none",
    };
  };

  const borderStyle = (): JSX.CSSProperties => {
    const halfHandle = HANDLE_HIT_AREA / 2;
    
    if (isHorizontal()) {
      return {
        position: "absolute",
        top: 0,
        bottom: 0,
        left: `${halfHandle}px`,
        width: "1px",
        "background-color": "var(--border)",
        "pointer-events": "none",
      };
    }
    return {
      position: "absolute",
      left: 0,
      right: 0,
      top: `${halfHandle}px`,
      height: "1px",
      "background-color": "var(--border)",
      "pointer-events": "none",
    };
  };

  return (
    <div ref={containerRef} class={containerClasses()} style={{ position: "relative" }}>
      <Show
        when={!sizeFromEnd()}
        fallback={
          <>
            <div style={flexPaneStyle()}>{local.children[0]}</div>
            <div
              style={handleStyle()}
              onMouseDown={handleMouseDown}
              onMouseEnter={() => setIsHovering(true)}
              onMouseLeave={() => setIsHovering(false)}
            >
              <div style={borderStyle()} />
            </div>
            <div style={sizedPaneStyle()}>{local.children[1]}</div>
          </>
        }
      >
        <div style={sizedPaneStyle()}>{local.children[0]}</div>
        <div
          style={handleStyle()}
          onMouseDown={handleMouseDown}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
        >
          <div style={borderStyle()} />
        </div>
        <div style={flexPaneStyle()}>{local.children[1]}</div>
      </Show>

      <Show when={isDragging()}>
        <div
          style={{
            position: "fixed",
            inset: 0,
            "z-index": 9999,
            cursor: isHorizontal() ? "col-resize" : "row-resize",
          }}
        />
      </Show>
    </div>
  );
}
