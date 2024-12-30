import { Action, Icon, open } from "@raycast/api";
import { ARC_PATH, BROWSER_NAME, BROWSER_PATH } from "./constants";

export function OpenInBrowserAction({ url }: { url: string }) {
  return (
    <Action
      title={`Open in ${BROWSER_NAME}`}
      icon={Icon.Globe}
      onAction={() => {
        open(url, BROWSER_PATH);
      }}
    />
  );
}

export function OpenInArcAction({ url }: { url: string }) {
  return (
    <Action
      title="Open in Little Arc"
      icon={Icon.Globe}
      onAction={() => {
        open(url, ARC_PATH);
      }}
    />
  );
}
