import { createSignal, Match, Switch, type JSX } from "solid-js";
import type { RxdbDebugger } from "../../core.js";
import { css, flex, resetStyles } from "../styles/css.js";
import type { Theme } from "../styles/theme.js";
import { CollectionsPanel } from "./panels/CollectionsPanel.js";
import { DocumentsPanel } from "./panels/DocumentsPanel.js";
import { EventsPanel } from "./panels/EventsPanel.js";
import { ExportPanel } from "./panels/ExportPanel.js";
import { PerformancePanel } from "./panels/PerformancePanel.js";
import { QueryPanel } from "./panels/QueryPanel.js";
import { Tabs, type TabItem } from "./shared/Tabs.js";

export type PanelId =
  | "collections"
  | "documents"
  | "query"
  | "events"
  | "performance"
  | "export";

export interface DebuggerProps {
  debugger: RxdbDebugger;
  theme: Theme;
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
  { id: "export", label: "Export" },
];

export function Debugger(props: DebuggerProps): JSX.Element {
  const [activeTab, setActiveTab] = createSignal<PanelId>(
    props.initialPanel ?? "collections"
  );

  const { theme } = props;
  const allowMutations = props.allowMutations ?? false;

  const containerStyle = css(resetStyles, flex.col, {
    width: props.width,
    height: props.height,
    background: theme.colors.bg,
    color: theme.colors.text,
    "font-family": theme.fonts.sans,
    "font-size": "13px",
    "line-height": "1.5",
    "border-radius": theme.sizing.borderRadius,
    overflow: "hidden",
    border: `1px solid ${theme.colors.border}`,
  });

  const contentStyle = css(flex.col, {
    flex: "1",
    "min-height": "0",
    overflow: "hidden",
  });

  return (
    <div style={containerStyle}>
      <Tabs
        theme={theme}
        tabs={TABS}
        activeTab={activeTab()}
        onTabChange={(id) => setActiveTab(id as PanelId)}
      />
      <div style={contentStyle}>
        <Switch>
          <Match when={activeTab() === "collections"}>
            <CollectionsPanel theme={theme} debugger={props.debugger} />
          </Match>
          <Match when={activeTab() === "documents"}>
            <DocumentsPanel
              theme={theme}
              debugger={props.debugger}
              allowMutations={allowMutations}
            />
          </Match>
          <Match when={activeTab() === "query"}>
            <QueryPanel theme={theme} debugger={props.debugger} />
          </Match>
          <Match when={activeTab() === "events"}>
            <EventsPanel theme={theme} debugger={props.debugger} />
          </Match>
          <Match when={activeTab() === "performance"}>
            <PerformancePanel theme={theme} debugger={props.debugger} />
          </Match>
          <Match when={activeTab() === "export"}>
            <ExportPanel
              theme={theme}
              debugger={props.debugger}
              allowMutations={allowMutations}
            />
          </Match>
        </Switch>
      </div>
    </div>
  );
}
