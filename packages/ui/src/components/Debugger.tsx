import { createSignal, createEffect, onCleanup, Match, Switch, type JSX } from "solid-js";
import type { RxdbDebugger } from "@rxdb-debugger/core";
import {
  type Theme,
  type ThemeMode,
  getTheme,
  resolveThemeMode,
  onColorSchemeChange,
} from "../styles/theme.js";
import { CollectionsPanel } from "./panels/CollectionsPanel.js";
import { DocumentsPanel } from "./panels/DocumentsPanel.js";
import { EventsPanel } from "./panels/EventsPanel.js";
import { PerformancePanel } from "./panels/PerformancePanel.js";
import { QueryPanel } from "./panels/QueryPanel.js";
import { Tabs, type TabItem } from "./shared/Tabs.js";

export type PanelId =
  | "collections"
  | "documents"
  | "query"
  | "events"
  | "performance";

export interface DebuggerProps {
  debugger: RxdbDebugger;
  /**
   * Initial theme to use (resolved from themeMode).
   */
  initialTheme: Theme;
  /**
   * Theme mode for reactive color scheme changes.
   * When "auto", theme will update when system preference changes.
   */
  themeMode: ThemeMode;
  width: string;
  height: string;
  initialPanel?: PanelId;
  allowMutations?: boolean;
}

const TABS: TabItem[] = [
  { id: "collections", label: "Collections" },
  { id: "documents", label: "Documents" },
  { id: "query", label: "Query" },
  { id: "events", label: "Events" },
  { id: "performance", label: "Performance" },
];

export function Debugger(props: DebuggerProps): JSX.Element {
  const [activeTab, setActiveTab] = createSignal<PanelId>(
    props.initialPanel ?? "collections"
  );

  const [theme, setTheme] = createSignal<Theme>(props.initialTheme);
  const allowMutations = props.allowMutations ?? false;

  createEffect(() => {
    if (props.themeMode === "auto") {
      const cleanup = onColorSchemeChange((scheme) => {
        setTheme(getTheme(scheme));
      });
      onCleanup(cleanup);
    } else {
      setTheme(getTheme(resolveThemeMode(props.themeMode)));
    }
  });

  const containerStyle = (): JSX.CSSProperties => ({
    width: props.width,
    height: props.height,
  });

  return (
    <div
      class="rxdb-debugger flex flex-col text-[13px] leading-normal overflow-hidden select-none"
      style={containerStyle()}
    >
      <Tabs
        theme={theme()}
        tabs={TABS}
        activeTab={activeTab()}
        onTabChange={(id) => setActiveTab(id as PanelId)}
      />
      <div class="flex flex-col flex-1 min-h-0 overflow-hidden">
        <div
          class={activeTab() === "events" ? "flex flex-col flex-1 min-h-0 overflow-hidden" : "hidden"}
          aria-hidden={activeTab() !== "events"}
        >
          <EventsPanel theme={theme()} debugger={props.debugger} />
        </div>
        <Switch>
          <Match when={activeTab() === "collections"}>
            <CollectionsPanel theme={theme()} debugger={props.debugger} />
          </Match>
          <Match when={activeTab() === "documents"}>
            <DocumentsPanel
              theme={theme()}
              debugger={props.debugger}
              allowMutations={allowMutations}
            />
          </Match>
          <Match when={activeTab() === "query"}>
            <QueryPanel theme={theme()} debugger={props.debugger} />
          </Match>
          <Match when={activeTab() === "performance"}>
            <PerformancePanel theme={theme()} debugger={props.debugger} />
          </Match>
        </Switch>
      </div>
    </div>
  );
}
