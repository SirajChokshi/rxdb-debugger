import { h, type FunctionalComponent } from "vue";

function svgIcon(
  paths: ReturnType<typeof h>[],
  className = "w-5 h-5",
  attrs: Record<string, string> = {},
): FunctionalComponent {
  return () =>
    h(
      "svg",
      {
        class: className,
        fill: attrs.fill ?? "currentColor",
        viewBox: attrs.viewBox ?? "0 0 20 20",
        stroke: attrs.stroke,
        strokeWidth: attrs.strokeWidth,
      },
      paths,
    );
}

export const HomeIcon = svgIcon([
  h("path", {
    d: "M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z",
  }),
]);

export const MusicIcon = svgIcon([
  h("path", {
    d: "M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z",
  }),
]);

export const ArtistIcon = svgIcon([
  h("path", {
    fillRule: "evenodd",
    d: "M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z",
    clipRule: "evenodd",
  }),
]);

export const AlbumIcon = svgIcon([
  h("path", {
    d: "M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z",
  }),
]);

export const PlaylistIcon = svgIcon([
  h("path", {
    d: "M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM14 11a1 1 0 011 1v1h1a1 1 0 110 2h-1v1a1 1 0 11-2 0v-1h-1a1 1 0 110-2h1v-1a1 1 0 011-1z",
  }),
]);

export const PlusIcon = () =>
  h(
    "svg",
    { class: "w-4 h-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", strokeWidth: "2" },
    h("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M12 5v14M5 12h14" }),
  );

export const MoreIcon = svgIcon([
  h("path", { d: "M3 10a2 2 0 114 0 2 2 0 01-4 0zm5 0a2 2 0 114 0 2 2 0 01-4 0zm5 0a2 2 0 114 0 2 2 0 01-4 0z" }),
], "w-4 h-4");

export const PlayIcon = svgIcon([
  h("path", {
    fillRule: "evenodd",
    d: "M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z",
    clipRule: "evenodd",
  }),
]);

export const SkipBackIcon = svgIcon([
  h("path", {
    d: "M8.445 14.832A1 1 0 0010 14v-2.798l5.445 3.63A1 1 0 0017 14V6a1 1 0 00-1.555-.832L10 8.798V6a1 1 0 00-1.555-.832l-6 4a1 1 0 000 1.664l6 4z",
  }),
]);

export const SkipForwardIcon = svgIcon([
  h("path", {
    d: "M4.555 5.168A1 1 0 003 6v8a1 1 0 001.555.832L10 11.202V14a1 1 0 001.555.832l6-4a1 1 0 000-1.664l-6-4A1 1 0 0010 6v2.798L4.555 5.168z",
  }),
]);

export const TerminalIcon = () =>
  h(
    "svg",
    { class: "w-5 h-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", strokeWidth: "2" },
    h("path", {
      strokeLinecap: "round",
      strokeLinejoin: "round",
      d: "M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
    }),
  );

const strokeIcon = (child: ReturnType<typeof h>, className = "w-4 h-4") => () =>
  h(
    "svg",
    { class: className, fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", strokeWidth: "2" },
    child,
  );

export const DockBottomIcon = () =>
  h(
    "svg",
    { class: "w-4 h-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", strokeWidth: "2" },
    [
      h("rect", { x: "3", y: "3", width: "18", height: "18", rx: "2" }),
      h("path", { d: "M3 15h18" }),
    ],
  );

export const DockRightIcon = () =>
  h(
    "svg",
    { class: "w-4 h-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", strokeWidth: "2" },
    [
      h("rect", { x: "3", y: "3", width: "18", height: "18", rx: "2" }),
      h("path", { d: "M15 3v18" }),
    ],
  );

export const ChevronDownIcon = strokeIcon(
  h("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M19 9l-7 7-7-7" }),
);

export const ChevronUpIcon = strokeIcon(
  h("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M5 15l7-7 7 7" }),
);

export const ChevronLeftIcon = strokeIcon(
  h("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M15 19l-7-7 7-7" }),
);

export const ChevronRightIcon = strokeIcon(
  h("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M9 5l7 7-7 7" }),
);

export const CloseIcon = strokeIcon(
  h("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M6 18L18 6M6 6l12 12" }),
);
